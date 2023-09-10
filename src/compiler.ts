import { getMemberChain } from './lib/parser/utils';
import { hasTrailingNewLines } from './lib/lexer/utils';
import { getMemberChain } from './lib/parser/utils';
import { hasTrailingNewLines } from './lib/lexer/utils';
import { SymbolKind, destructureIndex } from './lib/analyzer/symbol/symbolIndex';
import { generatePossibleIndexes } from './lib/analyzer/symbol/utils';
import SymbolTable from './lib/analyzer/symbol/symbolTable';
import {
  isOffsetWithinFullSpan,
  isOffsetWithinSpan,
  last,
  returnIfIsOffsetWithinFullSpan,
} from './lib/utils';
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
import { SyntaxToken, isTriviaToken } from './lib/lexer/tokens';
import { None, Option, Some } from './lib/option';

const enum Query {
  _Interpret,
  Parse_Ast,
  Parse_Errors,
  Parse_RawDb,
  Parse_Tokens,
  Parse_Report,
  Parse_PublicSymbolTable,
  Token_NonTrivial_BeforeOrContain,
  Token_NonTrivial_AfterOrContain,
  Token_NonTrivial_FirstOfLine,
  Token_FlatStream,
  Symbol_OfName,
  Symbol_Members,
  MembersOfName,
  ScopeKindOfNode,
  Containers,
  Context,
  Scope,
  /* Not correspond to a query - all meaningful queries should be place above this */
  TOTAL_QUERY_COUNT,
}

type Cache = Map<any, any> | any;

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

export type ContextInfo = Readonly<{
  scope?: { kind: ScopeKind; symbolTable: SymbolTable | undefined };
  element?: {
    node: ElementDeclarationNode;
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
}>;

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

  // A namespace for token-related queries
  readonly token = {
    stream: () => this.parse.tokens(),
    // Invalid tokens (which are guarenteed to be non-trivials) are included in the stream
    flatStream: this.createQuery(Query.Token_FlatStream, (): readonly SyntaxToken[] =>
      this.token
        .stream()
        .flatMap((token) => [...token.leadingInvalid, token, ...token.trailingInvalid])),
    // A namespace for non-trivial token-related queries
    nonTrivial: {
      // Return the index in the flatStream of the last token before/containing the offset
      beforeOrContain: this.createQuery(
        Query.Token_NonTrivial_BeforeOrContain,
        (offset: number): Option<number> => {
          const id = this.token.flatStream().findIndex((token) => token.start > offset) - 1;

          return id >= 0 ? new Some(id) : new None();
        },
      ),
      // Return the index in the flatStream of the first token after/containing the offset
      afterOrContain: this.createQuery(
        Query.Token_NonTrivial_AfterOrContain,
        (offset: number): Option<number> => {
          const id = this.token.nonTrivial.beforeOrContain(offset).unwrap_or(-1);
          if (id === -1) {
            return new Some(0);
          }
          if (isOffsetWithinSpan(offset, this.token.flatStream()[id])) {
            return new Some(id);
          }

          return id === this.token.flatStream().length ? new None() : new Some(id + 1);
        },
      ),
      // Return the index in the flatStream of the last token before the offset
      lastBefore: this.createQuery(
        Query.Token_NonTrivial_BeforeOrContain,
        (offset: number): Option<number> => {
          const id = this.token.nonTrivial.afterOrContain(offset).unwrap_or(-1);

          if (id === -1) {
            const len = this.token.flatStream().length;

            return len === 0 ? new None() : new Some(len - 1);
          }

          return id === 0 ? new None() : new Some(id - 1);
        },
      ),
      // Return the index in the flatStream of the first token after the offset
      firstAfter: this.createQuery(
        Query.Token_NonTrivial_AfterOrContain,
        (offset: number): Option<number> => {
          const id = this.token.nonTrivial.beforeOrContain(offset).unwrap_or(-1);
          const len = this.token.flatStream().length;

          if (id === -1) {
            return len === 0 ? new None() : new Some(0);
          }

          return id === len - 1 ? new None() : new Some(id);
        },
      ),
      beforeOrContainOnSameLine: this.createQuery(
        Query.Token_NonTrivial_FirstOfLine,
        (offset: number): Option<number> => {
          const id = this.token.nonTrivial.beforeOrContain(offset).unwrap_or(-1);
          if (id === -1) {
            return new None();
          }
          const token = this.token.flatStream()[id];
          if (hasTrailingNewLines(token)) {
            return new None();
          }

          return new Some(id);
        },
      ),
    },
  };

  // A namespace for parsing-related utility
  readonly parse = {
    _: this.createQuery(
      Query._Interpret,
      (): Report<
        { ast: Readonly<ProgramNode>; tokens: Readonly<SyntaxToken[]>; rawDb?: Database },
        CompileError
      > => {
        const parseRes = new Lexer(this.source)
          .lex()
          .chain((tokens) => {
            const parser = new Parser(tokens as SyntaxToken[], this.nodeIdGenerator);

            return parser.parse().map((ast) => ({ ast, tokens }));
          })
          .chain(({ ast, tokens }) => {
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
    ): Option<
      Readonly<{
        containerStack: SyntaxNode[];
        token: Readonly<SyntaxToken>;
        isLeadingInvalidToken: boolean;
        isTrailingInvalidToken: boolean;
      }>
    > => {
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
      containersDelegate(this.parse.ast(), offset, res);

      return res.token ? (new Some(res) as any) : new None();
    },
  );

  // A namespace for symbol-related queries
  readonly symbol = {
    ofName: this.createQuery(
      Query.Symbol_OfName,
      (
        nameStack: string[],
      ): readonly Readonly<{ symbol: NodeSymbol; kind: SymbolKind; name: string }>[] => {
        const { symbolTable } = this.parse.ast().symbol!;
        let currentPossibleSymbolTables: SymbolTable[] = [symbolTable!];
        let currentPossibleSymbols: { symbol: NodeSymbol; kind: SymbolKind; name: string }[] = [];
        // eslint-disable-next-line no-restricted-syntax
        for (const name of nameStack) {
          currentPossibleSymbols = currentPossibleSymbolTables.flatMap((st) =>
            generatePossibleIndexes(name).flatMap((index) => {
              const symbol = st.get(index);
              const res = destructureIndex(index).unwrap_or(undefined);

              return !symbol || !res ? [] : { ...res, symbol };
            }));
          currentPossibleSymbolTables = currentPossibleSymbols.flatMap((e) =>
            (e.symbol.symbolTable ? e.symbol.symbolTable : []));
        }

        return currentPossibleSymbols;
      },
    ),
    members: this.createQuery(
      Query.Symbol_Members,
      (
        ownerSymbol: NodeSymbol,
      ): readonly Readonly<{ symbol: NodeSymbol; kind: SymbolKind; name: string }>[] =>
        (ownerSymbol.symbolTable ?
          [...ownerSymbol.symbolTable.entries()].map(([index, symbol]) => ({
              ...destructureIndex(index).unwrap(),
              symbol,
            })) :
          []),
    ),
  };

  // Return all possible symbols corresponding to a stack of name
  membersOfName = this.createQuery(
    Query.MembersOfName,
    (
      nameStack: string[],
    ): readonly Readonly<{ symbol: NodeSymbol; kind: SymbolKind; readonly name: string }>[] =>
      this.symbol.ofName(nameStack).flatMap(({ symbol }) => this.symbol.members(symbol)),
  );

  // Return information about the enclosing scope at the point of `offset`
  scope = this.createQuery(
    Query.Scope,
    (
      offset: number,
    ): Option<Readonly<{ kind: ScopeKind; symbolTable: SymbolTable | undefined }>> => {
      const res = this.containers(offset);
      if (!res.isOk()) {
        return new None();
      }
      const containerStack = [...res.unwrap().containerStack];

      while (last(containerStack)) {
        const container = containerStack.pop()!;

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

      return new None();
    },
  );

  // Return the kind of the scope associated with a symbol
  scopeKindOfNode = this.createQuery(
    Query.ScopeKindOfNode,
    (node: ElementDeclarationNode | ProgramNode): Option<Readonly<ScopeKind>> => {
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

  context = this.createQuery(Query.Context, (offset: number): Option<Readonly<ContextInfo>> => {
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
        node: firstParent,
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

/* Helper for `containers` */
function containersDelegate(
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
    res.isLeadingInvalidToken = foundToken.isInvalid && offset < foundMember.start;
    res.isTrailingInvalidToken = foundToken.isInvalid && offset >= foundMember.end;

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
    containersDelegate(foundMember, offset, res);
  }
}
