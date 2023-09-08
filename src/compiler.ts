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
import {
  EnumSymbol,
  NodeSymbol,
  NodeSymbolIdGenerator,
  SchemaSymbol,
  TableGroupSymbol,
  TableSymbol,
} from './lib/analyzer/symbol/symbols';
import Report from './lib/report';
import Lexer from './lib/lexer/lexer';
import Parser from './lib/parser/parser';
import Analyzer from './lib/analyzer/analyzer';
import Interpreter from './lib/interpreter/interpreter';
import Database from './lib/model_structure/database';
import { SyntaxToken } from './lib/lexer/tokens';
import {
 findNameForSymbol, getMemberChain, isOffsetWithin, returnIfIsOffsetWithin,
} from './utils';
import { None, Option, Some } from './lib/option';

const enum Query {
  Parse,
  EmitRawDb,
  SymbolsOfName,
  NameOfSymbol,
  MembersOfName,
  MembersOfSymbol,
  ScopeKindOfSymbol,
  Containers,
  Context,
  /* Not correspond to a query - all meaning queries should be place above this */
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

  parse = this.createQuery(Query.Parse, (): Report<Readonly<ProgramNode>, CompileError> => {
    const lexer = new Lexer(this.source);

    return lexer
      .lex()
      .chain((tokens) => {
        const parser = new Parser(tokens, this.nodeIdGenerator);

        return parser.parse();
      })
      .chain((ast) => {
        const analyzer = new Analyzer(ast, this.symbolIdGenerator);

        return analyzer.analyze();
      });
  });

  // Find the stack of nodes/tokens, with the latter being nested inside the former
  // that contains `offset`
  containers = this.createQuery(
    Query.Containers,
    (offset: number): Option<{ containerStack: SyntaxNode[]; token: SyntaxToken }> => {
      const res: { containerStack: SyntaxNode[]; token?: SyntaxToken } = {
        containerStack: [],
        token: undefined,
      };
      this.findInNode(this.parse().getValue(), offset, res);

      return res.token ? (new Some(res) as any) : new None();
    },
  );

  /* Helper for `containers` */
  private findInNode(
    node: SyntaxNode,
    offset: number,
    res: { containerStack: SyntaxNode[]; token?: SyntaxToken },
  ) {
    const members = getMemberChain(node);
    const foundMember = members.find((m) => isOffsetWithin(offset, m));

    if (!foundMember) {
      return;
    }

    if (foundMember instanceof SyntaxToken) {
      res.token = foundMember;

      return;
    }

    res.containerStack.push(foundMember);

    if (!(foundMember instanceof SyntaxToken)) {
      this.findInNode(foundMember, offset, res);
    }
  }

  // Return all possible symbols corresponding to a stack of name
  symbolsOfName = this.createQuery(Query.SymbolsOfName, (nameStack: string[]): NodeSymbol[] => {
    const { symbolTable } = this.parse().getValue().symbol!;
    let currentPossibleSymbolTables: SymbolTable[] = [symbolTable!];
    let currentPossibleSymbols: NodeSymbol[] = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const name of nameStack) {
      currentPossibleSymbols = currentPossibleSymbolTables.flatMap((st) =>
        generatePossibleIndexes(name).flatMap((index) => {
          const symbol = st.get(index);

          return !symbol ? [] : [symbol];
        }));
      currentPossibleSymbolTables = currentPossibleSymbols.flatMap((symbol) =>
        (symbol.symbolTable ? [symbol.symbolTable] : []));
    }

    return currentPossibleSymbols;
  });

  membersOfSymbol = this.createQuery(
    Query.MembersOfSymbol,
    (ownerSymbol: NodeSymbol): NodeSymbol[] =>
      (ownerSymbol.symbolTable ?
        [...ownerSymbol.symbolTable.entries()].flatMap(([_, s]) => s) :
        []),
  );

  membersOfName = this.createQuery(Query.MembersOfName, (nameStack: string[]): NodeSymbol[] =>
    this.symbolsOfName(nameStack).flatMap(this.membersOfSymbol));

  nameOfSymbol = this.createQuery(Query.NameOfSymbol, findNameForSymbol);

  // Return information about the enclosing scope at the point of `offset`
  scope(offset: number): Option<{ kind: ScopeKind; symbolTable?: SymbolTable }> {
    const res = this.containers(offset);
    if (!res.isOk()) {
      return new None();
    }
    const { containerStack } = res.unwrap();
    while (true) {
      const container = containerStack.pop();
      if (!container) {
        return new None();
      }
      if (container.symbol && container.symbol.declaration instanceof ElementDeclarationNode) {
        return new Some({
          kind: this.scopeKindOfSymbol(container.symbol).unwrap(),
          symbolTable: container.symbol.symbolTable,
        });
      }
    }
  }

  // Return the kind of the scope associated with a symbol
  private scopeKindOfSymbol(symbol: NodeSymbol): Option<ScopeKind> {
    if (symbol instanceof TableSymbol) {
      return new Some(ScopeKind.TABLE);
    }
    if (symbol instanceof TableGroupSymbol) {
      return new Some(ScopeKind.TABLEGROUP);
    }
    if (symbol instanceof EnumSymbol) {
      return new Some(ScopeKind.ENUM);
    }
    if (symbol.declaration instanceof ElementDeclarationNode) {
      switch (symbol.declaration.type.value.toLowerCase()) {
        case 'indexes':
          return new Some(ScopeKind.INDEXES);
        case 'note':
          return new Some(ScopeKind.NOTE);
        case 'ref':
          return new Some(ScopeKind.REF);
        default:
          break;
      }
    }
    if (symbol === this.parse().getValue().symbol) {
      return new Some(ScopeKind.TOPLEVEL);
    }
    if (symbol instanceof SchemaSymbol) {
      return new Some(ScopeKind.SCHEMA);
    }

    return new None();
  }

  context(offset: number): Option<ContextInfo> {
    const res = this.containers(offset);
    if (!res.isOk()) {
      return new None();
    }
    const { containerStack } = res.unwrap();

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
        type: returnIfIsOffsetWithin(offset, firstParent.type),
        name: returnIfIsOffsetWithin(offset, firstParent.name),
        as: returnIfIsOffsetWithin(offset, firstParent.as),
        alias: returnIfIsOffsetWithin(offset, firstParent.alias),
        settingList: returnIfIsOffsetWithin(offset, firstParent.attributeList) && {
          node: firstParent.attributeList!,
          attribute: maybeAttribute,
          name: returnIfIsOffsetWithin(offset, maybeAttributeName),
          value: returnIfIsOffsetWithin(offset, maybeAttributeValue),
        },
        body: returnIfIsOffsetWithin(offset, firstParent.body),
      },
      subfield: firstSubfield && {
        node: firstSubfield,
        callee:
          firstSubfield instanceof FunctionApplicationNode ?
            returnIfIsOffsetWithin(offset, firstSubfield.callee) :
            firstSubfield,
        arg:
          firstSubfield instanceof FunctionApplicationNode ?
            firstSubfield.args.find((arg) => isOffsetWithin(offset, arg)) :
            undefined,
        settingList: maybeSettingList && {
          node: maybeSettingList,
          attribute: maybeAttribute,
          name: maybeAttributeName,
          value: maybeAttributeValue,
        },
      },
    });
  }
}

export enum ScopeKind {
  TABLE,
  ENUM,
  TABLEGROUP,
  INDEXES,
  NOTE,
  REF,
  SCHEMA,
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
