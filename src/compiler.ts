import { NodeSymbolIndex } from 'lib/analyzer/symbol/symbolIndex';
import { generatePossibleIndexes } from './lib/analyzer/symbol/utils';
import SymbolTable from './lib/analyzer/symbol/symbolTable';
import { last } from './lib/utils';
import { CompileError } from './lib/errors';
import {
  AttributeNode,
  ElementDeclarationNode,
  ExpressionNode,
  FunctionApplicationNode,
  FunctionExpressionNode,
  IdentiferStreamNode,
  ListExpressionNode,
  PrimaryExpressionNode,
  ProgramNode,
  SyntaxNode,
  SyntaxNodeIdGenerator,
} from './lib/parser/nodes';
import { NodeSymbol, NodeSymbolIdGenerator } from './lib/analyzer/symbol/symbols';
import Report from './lib/report';
import Lexer from './lib/lexer/lexer';
import Parser from './lib/parser/parser';
import Analyzer from './lib/analyzer/analyzer';
import Interpreter from './lib/interpreter/interpreter';
import Database from './lib/model_structure/database';
import { SyntaxToken, SyntaxTokenKind, isTriviaToken } from './lib/lexer/tokens';
import {
  findNameForSymbol,
  getMemberChain,
  isOffsetWithinFullSpan,
  isOffsetWithinSpan,
  returnIfIsOffsetWithinFullSpan,
} from './utils';
import { None, Option, Some } from './lib/option';

const enum Query {
  Parse,
  Lex,
  EmitRawDb,
  SymbolsOfName,
  NameOfSymbol,
  MembersOfName,
  MembersOfSymbol,
  ScopeKindOfNode,
  Containers,
  Context,
  Scope,
  /* Not correspond to a query - all meaningful queries should be place above this */
  TOTAL_QUERY_COUNT,
}

type Cache = Map<any, any> | any;

export default class Compiler {
  private source = '';
  private cache: Cache[] = new Array(Query.TOTAL_QUERY_COUNT).fill(null);

  private nodeIdGenerator = new SyntaxNodeIdGenerator();
  private symbolIdGenerator = new NodeSymbolIdGenerator();

  private createQuery<V>(kind: Query, queryCallback: () => V): () => V;
  private createQuery<V, U>(kind: Query, queryCallback: (arg: U) => V): (arg: U) => V;
  private createQuery<V, U>(
    kind: Query,
    queryCallback: (arg: U | undefined) => V,
  ): (arg: U | undefined) => V {
    return (arg: U | undefined): V => {
      const cacheEntry = this.cache[kind];
      if (cacheEntry !== null) {
        if (!(cacheEntry instanceof Map)) {
          return cacheEntry;
        }

        if (cacheEntry.has(arg)) {
          return cacheEntry.get(arg)!;
        }
      }

      const res = queryCallback(arg);

      if (arg !== undefined) {
        if (cacheEntry instanceof Map) {
          cacheEntry.set(arg, res);
        } else {
          this.cache[kind] = new Map();
          this.cache[kind].set(arg, res);
        }
      } else {
        this.cache[kind] = res;
      }

      return res;
    };
  }

  setSource(source: string) {
    this.source = source;
    this.cache = new Array(Query.TOTAL_QUERY_COUNT).fill(null);
    this.nodeIdGenerator.reset();
    this.symbolIdGenerator.reset();
  }

  // Warning: calling this function mutates the cached `parse` query result
  // However, it should not matter in most cases
  emitRawDbFromDBML = this.createQuery(Query.EmitRawDb, (): Database => {
    const parseRes = this.parse();
    const parseErrors = parseRes.getErrors();
    if (parseErrors.length > 0) {
      throw parseErrors;
    }

    const parseValue = parseRes.getValue();
    const intepreter = new Interpreter(parseValue);
    const interpretRes = intepreter.interpret();
    const interpretErrors = interpretRes.getErrors();
    if (interpretErrors.length > 0) {
      throw interpretErrors;
    }

    return new Database(interpretRes.getValue());
  });

  lex = this.createQuery(
    Query.Lex,
    (): Report<Readonly<SyntaxToken[]>, CompileError> => new Lexer(this.source).lex(),
  );

  parse = this.createQuery(
    Query.Parse,
    (): Report<Readonly<ProgramNode>, CompileError> =>
      this.lex()
        .chain((tokens) => {
          const parser = new Parser(tokens as SyntaxToken[], this.nodeIdGenerator);

          return parser.parse();
        })
        .chain((ast) => {
          const analyzer = new Analyzer(ast, this.symbolIdGenerator);

          return analyzer.analyze();
        }),
  );

  // Find the stack of nodes/tokens, with the latter being nested inside the former
  // that contains `offset`
  containers = this.createQuery(
    Query.Containers,
    (
      offset: number,
    ): Option<{
      containerStack: SyntaxNode[];
      token: SyntaxToken;
      isLeadingInvalidToken: boolean;
      isTrailingInvalidToken: boolean;
    }> => {
      const res: {
        containerStack: SyntaxNode[];
        token?: SyntaxToken;
        isLeadingInvalidToken: boolean;
        isTrailingInvalidToken: boolean;
      } = {
        containerStack: [],
        token: undefined,
        isLeadingInvalidToken: false,
        isTrailingInvalidToken: false,
      };
      this.findInNode(this.parse().getValue(), offset, res);

      return res.token ? (new Some(res) as any) : new None();
    },
  );

  /* Helper for `containers` */
  private findInNode(
    node: SyntaxNode,
    offset: number,
    res: {
      containerStack: SyntaxNode[];
      token?: SyntaxToken;
      isLeadingInvalidToken: boolean;
      isTrailingInvalidToken: boolean;
    },
  ) {
    res.containerStack.push(node);
    const members = getMemberChain(node);
    const foundMember = members.find((m) => isOffsetWithinFullSpan(offset, m));

    if (!foundMember) {
      return;
    }

    if (foundMember instanceof SyntaxToken) {
      let foundToken = foundMember;
      while (foundToken && !isOffsetWithinSpan(offset, foundToken)) {
        if (offset < foundToken.start) {
          foundToken = (foundMember as SyntaxToken).leadingTrivia.find((token) =>
            isOffsetWithinFullSpan(offset, token))!;
        } else {
          foundToken = (foundMember as SyntaxToken).trailingTrivia.find((token) =>
            isOffsetWithinFullSpan(offset, token))!;
        }
      }
      res.token = foundToken;
      res.isLeadingInvalidToken =
        foundToken.kind === SyntaxTokenKind.INVALID && offset < foundMember.start;
      res.isTrailingInvalidToken =
        foundToken.kind === SyntaxTokenKind.INVALID && offset >= foundMember.end;

      if (isTriviaToken(foundToken)) {
        while (
          res.containerStack.length !== 0 &&
          !isOffsetWithinSpan(offset, last(res.containerStack)!)
        ) {
          // In this case, the trivia token was added to the node only because it was invalid
          // and it happens to be at right before or after the node
          // so we shouldn't consider the node to be its container
          res.containerStack.pop();
        }
      }

      return;
    }

    if (!(foundMember instanceof SyntaxToken)) {
      this.findInNode(foundMember, offset, res);
    }
  }

  // Return all possible symbols corresponding to a stack of name
  symbolsOfName = this.createQuery(
    Query.SymbolsOfName,
    (nameStack: string[]): { symbol: NodeSymbol; index: NodeSymbolIndex }[] => {
      const { symbolTable } = this.parse().getValue().symbol!;
      let currentPossibleSymbolTables: SymbolTable[] = [symbolTable!];
      let currentPossibleSymbols: { symbol: NodeSymbol; index: NodeSymbolIndex }[] = [];
      // eslint-disable-next-line no-restricted-syntax
      for (const name of nameStack) {
        currentPossibleSymbols = currentPossibleSymbolTables.flatMap((st) =>
          generatePossibleIndexes(name).flatMap((index) => {
            const symbol = st.get(index);

            return !symbol ? [] : { index, symbol };
          }));
        currentPossibleSymbolTables = currentPossibleSymbols.flatMap((e) =>
          (e.symbol.symbolTable ? e.symbol.symbolTable : []));
      }

      return currentPossibleSymbols;
    },
  );

  membersOfSymbol = this.createQuery(
    Query.MembersOfSymbol,
    (ownerSymbol: NodeSymbol): { symbol: NodeSymbol; index: NodeSymbolIndex }[] =>
      (ownerSymbol.symbolTable ?
        [...ownerSymbol.symbolTable.entries()].map(([index, symbol]) => ({ index, symbol })) :
        []),
  );

  membersOfName = this.createQuery(
    Query.MembersOfName,
    (nameStack: string[]): { symbol: NodeSymbol; index: NodeSymbolIndex }[] =>
      this.symbolsOfName(nameStack).flatMap(({ symbol }) => this.membersOfSymbol(symbol)),
  );

  nameOfSymbol = this.createQuery(Query.NameOfSymbol, findNameForSymbol);

  // Return information about the enclosing scope at the point of `offset`
  scope = this.createQuery(
    Query.Scope,
    (offset: number): Option<{ kind: ScopeKind; symbolTable?: SymbolTable }> => {
      const res = this.containers(offset);
      if (!res.isOk()) {
        return new None();
      }
      const containerStack = [...res.unwrap().containerStack];

      while (true) {
        const container = containerStack.pop();
        if (!container) {
          return new None();
        }
        if (container instanceof ElementDeclarationNode || container instanceof ProgramNode) {
          const scopeKind = this.scopeKindOfNode(container).unwrap_or(undefined);

          if (scopeKind !== undefined) {
            return new Some({
              kind: scopeKind,
              symbolTable: container.symbol?.symbolTable,
            });
          }
        }
      }
    },
  );

  // Return the kind of the scope associated with a symbol
  scopeKindOfNode = this.createQuery(
    Query.ScopeKindOfNode,
    (node: ElementDeclarationNode | ProgramNode): Option<ScopeKind> => {
      if (node instanceof ProgramNode) {
        return new Some(ScopeKind.TOPLEVEL);
      }
      switch (node.type.value.toLowerCase()) {
        case 'table':
          return new Some(ScopeKind.TABLE);
        case 'tablegroup':
          return new Some(ScopeKind.TABLEGROUP);
        case 'enum':
          return new Some(ScopeKind.ENUM);
        case 'indexes':
          return new Some(ScopeKind.INDEXES);
        case 'note':
          return new Some(ScopeKind.NOTE);
        case 'ref':
          return new Some(ScopeKind.REF);
        case 'project':
          return new Some(ScopeKind.PROJECT);
        default:
          break;
      }

      return new None();
    },
  );

  context = this.createQuery(Query.Context, (offset: number): Option<ContextInfo> => {
    const res = this.containers(offset);
    if (!res.isOk()) {
      return new None();
    }
    const containerStack = [...res.unwrap().containerStack];

    let firstParent: ElementDeclarationNode | undefined;
    let firstSubfield:
      | FunctionExpressionNode
      | FunctionApplicationNode
      | PrimaryExpressionNode
      | undefined;
    let maybeSubfield:
      | FunctionExpressionNode
      | FunctionApplicationNode
      | PrimaryExpressionNode
      | undefined;
    let maybeAttribute: AttributeNode | undefined;
    let maybeAttributeName: IdentiferStreamNode | undefined;
    let maybeAttributeValue: ExpressionNode | undefined;
    let maybeSettingList: ListExpressionNode | undefined;
    while (last(containerStack)) {
      const container = containerStack.pop()!;
      if (
        container instanceof FunctionApplicationNode ||
        container instanceof FunctionExpressionNode ||
        container instanceof PrimaryExpressionNode
      ) {
        maybeSubfield = container;
      }
      if (container instanceof IdentiferStreamNode) {
        maybeAttributeName ||= container;
      }
      if (container instanceof AttributeNode) {
        maybeAttribute ||= container;
        maybeAttributeValue ||= maybeSubfield;
        maybeSubfield = undefined;
      }
      if (container instanceof ListExpressionNode) {
        maybeSettingList ||= container;
      }
      if (container instanceof ElementDeclarationNode) {
        firstParent = container;
        firstSubfield = maybeSubfield;
        break;
      }
    }

    return new Some({
      scope: this.scope(offset).unwrap_or(undefined),
      element: firstParent && {
        type: returnIfIsOffsetWithinFullSpan(offset, firstParent.type),
        name: returnIfIsOffsetWithinFullSpan(offset, firstParent.name),
        as: returnIfIsOffsetWithinFullSpan(offset, firstParent.as),
        alias: returnIfIsOffsetWithinFullSpan(offset, firstParent.alias),
        settingList: returnIfIsOffsetWithinFullSpan(offset, firstParent.attributeList) && {
          node: firstParent.attributeList!,
          attribute: maybeAttribute,
          name: returnIfIsOffsetWithinFullSpan(offset, maybeAttributeName),
          value: returnIfIsOffsetWithinFullSpan(offset, maybeAttributeValue),
        },
        body: returnIfIsOffsetWithinFullSpan(offset, firstParent.body),
      },
      subfield: firstSubfield && {
        node: firstSubfield,
        callee:
          firstSubfield instanceof FunctionApplicationNode ?
            returnIfIsOffsetWithinFullSpan(offset, firstSubfield.callee) :
            firstSubfield,
        arg:
          firstSubfield instanceof FunctionApplicationNode ?
            firstSubfield.args.find((arg) => isOffsetWithinFullSpan(offset, arg)) :
            undefined,
        settingList: maybeSettingList && {
          node: maybeSettingList,
          attribute: maybeAttribute,
          name: maybeAttributeName,
          value: maybeAttributeValue,
        },
      },
    });
  });
}

export enum ScopeKind {
  TABLE,
  ENUM,
  TABLEGROUP,
  INDEXES,
  NOTE,
  REF,
  PROJECT,
  TOPLEVEL,
}

export type ContextInfo = {
  scope?: { kind: ScopeKind; symbolTable?: SymbolTable };
  element?: {
    type?: SyntaxToken;
    name?: SyntaxNode;
    as?: SyntaxToken;
    alias?: SyntaxNode;
    settingList?: {
      node: SyntaxNode;
      attribute?: SyntaxNode;
      name?: SyntaxNode;
      value?: SyntaxNode;
    };
    body?: SyntaxNode;
  };

  subfield?: {
    node: SyntaxNode;
    callee?: SyntaxNode;
    arg?: SyntaxNode;
    settingList?: {
      node: SyntaxNode;
      attribute?: SyntaxNode;
      name?: SyntaxNode;
      value?: SyntaxNode;
    };
  };
};
