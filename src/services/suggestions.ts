import Compiler, { ScopeKind } from '../compiler';
import { SyntaxToken, SyntaxTokenKind } from '../lib/lexer/tokens';
import { isOffsetWithinSpan } from '../lib/utils';
import {
  CompletionList,
  TextModel,
  CompletionItemKind,
  CompletionItemProvider,
  CompletionItemInsertTextRule,
  Position,
} from './types';
import { TableSymbol } from '../lib/analyzer/symbol/symbols';
import { SymbolKind, destructureIndex } from '../lib/analyzer/symbol/symbolIndex';
import {
  isAtStartOfSimpleBody,
  pickCompletionItemKind,
  shouldAppendSpace,
  trimLeftMemberAccess,
} from './utils';
import { ElementDeclarationNode, ProgramNode } from '../lib/parser/nodes';
import { ElementKind } from '../lib/analyzer/validator/types';
import { TokenSourceIterator, TokenLineIterator } from '../iterator';

export default class DBMLCompletionItemProvider implements CompletionItemProvider {
  private compiler: Compiler;
  // alphabetic characters implictily invoke the autocompletion provider
  triggerCharacters = ['.', ':', ',', '[', '(', ' ', '>', '<', '-'];

  constructor(compiler: Compiler) {
    this.compiler = compiler;
  }

  provideCompletionItems(model: TextModel, position: Position): CompletionList {
    const offset = model.getOffsetAt(position) - 1;

    const iter = TokenSourceIterator.fromOffset(this.compiler, offset);
    let iterSameLine = TokenLineIterator.fromOffset(this.compiler, offset);
    if (iter.isOutOfBound()) {
      return this.suggestOnFirstNonTrivialToken(model, offset);
    }

    let editedToken: SyntaxToken | undefined;
    let lastToken: SyntaxToken | undefined = iter.value().unwrap();
    if (isOffsetWithinSpan(offset, lastToken)) {
      switch (lastToken.kind) {
        case SyntaxTokenKind.SINGLE_LINE_COMMENT:
        case SyntaxTokenKind.MULTILINE_COMMENT:
          return noSuggestions();
        // We don't care about the last token in these cases as we're editing this last token
        case SyntaxTokenKind.IDENTIFIER:
        case SyntaxTokenKind.FUNCTION_EXPRESSION:
        case SyntaxTokenKind.COLOR_LITERAL:
        case SyntaxTokenKind.QUOTED_STRING:
        case SyntaxTokenKind.STRING_LITERAL:
        case SyntaxTokenKind.NUMERIC_LITERAL:
          editedToken = lastToken;
          lastToken = iter.back().value().unwrap_or(undefined);
          iterSameLine = iterSameLine.back();
          break;
        default:
          break;
      }
    }

    // This case happens if we're editing the first non-trivial token of the whole program
    if (lastToken === undefined) {
      return this.suggestOnFirstNonTrivialToken(model, offset);
    }

    switch (lastToken?.kind) {
      case SyntaxTokenKind.OP:
        switch (lastToken.value) {
          case '.':
            return this.suggestMembers(model, offset);
          case '<>':
          case '>':
          case '<':
          case '-':
            return this.suggestOnRelOp(model, offset, lastToken);
          default:
            return noSuggestions();
        }
      case SyntaxTokenKind.LBRACKET:
        return this.suggestAttributeName(model, offset);
      case SyntaxTokenKind.COLON:
        return this.suggestOnColon(model, offset, lastToken);
      case SyntaxTokenKind.COMMA:
        return this.suggestOnComma(model, offset, lastToken);
      case SyntaxTokenKind.LPAREN:
        return this.suggestOnLParen(model, offset);
      default:
        break;
    }

    const tokenLine = iterSameLine.collectFromStart().unwrap_or([]);
    // We're editing the last token of an "independent" line at this point

    return this.suggestOnIndependentLine(model, offset, tokenLine, editedToken);
  }

  private suggestOnRelOp(model: TextModel, offset: number, op: SyntaxToken): CompletionList {
    const ctx = this.compiler.context(offset).unwrap_or(undefined);
    if (!ctx || !ctx.scope || !ctx.element?.node) {
      return noSuggestions();
    }

    // Note: An incomplete relationship operation would corrupt the context
    // and `ctx` may fail to hold the precise scope, rather, it would holds the parent's scope
    // e.g
    // Table T {
    //  Ref: S.a > // at this point `ctx.scope` would be `Table`
    // }
    // Therefore, this check also checks for possible parent scopes
    // Which would cover redundant cases, but otherwise complete
    if (
      ctx.scope.kind === ScopeKind.REF ||
      ctx.scope.kind === ScopeKind.TABLE ||
      ctx.scope.kind === ScopeKind.TOPLEVEL
    ) {
      const res = this.suggestNamesInScope(model, offset, ctx.element?.node, [
        SymbolKind.Table,
        SymbolKind.Schema,
        SymbolKind.Column,
      ]);

      return !shouldAppendSpace(op, offset) ? res : prependSpace(res);
    }

    return noSuggestions();
  }

  private suggestNamesInScope(
    model: TextModel,
    offset: number,
    parent: ElementDeclarationNode | ProgramNode | undefined,
    acceptedKinds: SymbolKind[],
  ): CompletionList {
    if (parent === undefined) {
      return noSuggestions();
    }

    let curElement: ElementDeclarationNode | ProgramNode | undefined = parent;
    const res: CompletionList = { suggestions: [] };
    while (curElement) {
      if (curElement?.symbol?.symbolTable) {
        const { symbol } = curElement;
        res.suggestions.push(
          ...this.compiler.symbol
            .members(symbol)
            .filter(({ kind }) => acceptedKinds.includes(kind))
            .map(({ name, kind }) => ({
              label: name,
              insertText: name,
              insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
              kind: pickCompletionItemKind(kind),
              range: undefined as any,
            })),
        );
      }
      curElement =
        curElement instanceof ElementDeclarationNode ? curElement.parentElement : undefined;
    }

    return res;
  }

  private suggestOnFirstNonTrivialToken(model: TextModel, offset: number): CompletionList {
    const ctx = this.compiler.context(offset).unwrap_or(undefined);
    if (ctx?.scope?.kind === undefined) {
      return noSuggestions();
    }
    switch (ctx.scope.kind) {
      case ScopeKind.TOPLEVEL:
        return {
          suggestions: ['Table', 'TableGroup', 'Enum', 'Project', 'Ref'].map((name) => ({
            label: name,
            insertText: name,
            insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
            kind: CompletionItemKind.Class,
            range: undefined as any,
          })),
        };

      case ScopeKind.TABLE:
        return {
          suggestions: ['Ref', 'Note', 'indexes'].map((name) => ({
            label: name,
            insertText: name,
            insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
            kind: CompletionItemKind.Class,
            range: undefined as any,
          })),
        };

      case ScopeKind.PROJECT:
        return {
          suggestions: ['Table', 'TableGroup', 'Enum', 'Note', 'Ref'].map((name) => ({
            label: name,
            insertText: name,
            insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
            kind: CompletionItemKind.Class,
            range: undefined as any,
          })),
        };

      case ScopeKind.INDEXES:
        return this.suggestColumnNameInIndexes(model, offset);

      case ScopeKind.TABLEGROUP:
        return this.suggestTopLevelTableNameInTableGroup(model, offset);

      case ScopeKind.REF:
        return this.suggestNamesInScope(model, offset, ctx.element?.node, [
          SymbolKind.Schema,
          SymbolKind.Table,
          SymbolKind.Column,
        ]);

      default:
        break;
    }

    return noSuggestions();
  }

  private suggestColumnNameInIndexes(model: TextModel, offset: number): CompletionList {
    const ctx = this.compiler.context(offset).unwrap_or(undefined);
    if (ctx?.element === undefined || ctx?.scope?.kind !== ScopeKind.INDEXES) {
      return noSuggestions();
    }

    const indexesNode = ctx.element.node;
    const tableNode = indexesNode.parentElement;
    if (!(tableNode?.symbol instanceof TableSymbol)) {
      return noSuggestions();
    }

    const { symbolTable } = tableNode.symbol;

    return {
      suggestions: [...symbolTable.entries()].flatMap(([index]) => {
        const res = destructureIndex(index).unwrap_or(undefined);
        if (res === undefined) {
          return [];
        }
        const { name } = res;

        return {
          label: name,
          insertText: name,
          insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
          kind: pickCompletionItemKind(SymbolKind.Column),
          range: undefined as any,
        };
      }),
    };
  }

  private suggestTopLevelTableNameInTableGroup(model: TextModel, offset: number): CompletionList {
    const ctx = this.compiler.context(offset).unwrap_or(undefined);
    if (ctx?.element === undefined || ctx?.scope?.kind !== ScopeKind.TABLEGROUP) {
      return noSuggestions();
    }

    return {
      suggestions: [...this.compiler.parse.publicSymbolTable().entries()].flatMap(([index]) => {
        const res = destructureIndex(index).unwrap_or(undefined);
        if (res === undefined) {
          return [];
        }
        const { kind, name } = res;
        if (kind !== SymbolKind.Table && kind !== SymbolKind.Schema) {
          return [];
        }

        return {
          label: name,
          insertText: name,
          insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
          kind: pickCompletionItemKind(kind),
          range: undefined as any,
        };
      }),
    };
  }

  private suggestOnComma(model: TextModel, offset: number, comma: SyntaxToken): CompletionList {
    const ctx = this.compiler.context(offset).unwrap_or(undefined);
    if (ctx?.scope?.kind === undefined) {
      return noSuggestions();
    }

    if (ctx.subfield?.settingList) {
      const res = this.suggestAttributeName(model, offset);

      return !shouldAppendSpace(comma, offset) ? res : prependSpace(res);
    }

    switch (ctx.scope.kind) {
      case ScopeKind.INDEXES:
        if (ctx.subfield?.callee) {
          return this.suggestColumnNameInIndexes(model, offset);
        }

        return noSuggestions();
      default:
        break;
    }

    return noSuggestions();
  }

  private suggestOnLParen(model: TextModel, offset: number): CompletionList {
    const ctx = this.compiler.context(offset).unwrap_or(undefined);
    if (ctx?.scope?.kind === undefined) {
      return noSuggestions();
    }

    switch (ctx.scope.kind) {
      case ScopeKind.INDEXES:
        if (ctx.subfield?.callee) {
          return this.suggestColumnNameInIndexes(model, offset);
        }

        return noSuggestions();
      default:
        break;
    }

    return noSuggestions();
  }

  private suggestAttributeName(model: TextModel, offset: number): CompletionList {
    const ctx = this.compiler.context(offset).unwrap_or(undefined);

    if (ctx?.element === undefined || ctx.scope === undefined) {
      return noSuggestions();
    }

    if (ctx.element && !ctx.subfield) {
      switch (ctx.scope.kind) {
        case ScopeKind.TABLE:
          return {
            suggestions: [
              {
                label: 'headercolor',
                insertText: 'headercolor: ',
                kind: CompletionItemKind.Field,
                insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
                range: undefined as any,
              },
              {
                label: 'note',
                insertText: 'note: ',
                kind: CompletionItemKind.Field,
                insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
                range: undefined as any,
              },
            ],
          };
        default:
          return noSuggestions();
      }
    }

    if (!ctx.subfield) {
      return noSuggestions();
    }

    switch (ctx.scope.kind) {
      case ScopeKind.TABLE:
        return {
          suggestions: [
            ...['primary key', 'null', 'not null', 'increment', 'pk', 'unique'].map((name) => ({
              label: name,
              insertText: name,
              kind: CompletionItemKind.Property,
              insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
              range: undefined as any,
            })),
            ...['ref', 'default'].map((name) => ({
              label: name,
              insertText: `${name}: `,
              kind: CompletionItemKind.Property,
              insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
              range: undefined as any,
            })),
            {
              label: 'note',
              insertText: 'note: ',
              kind: CompletionItemKind.Property,
              insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
              range: undefined as any,
            },
          ],
        };
      case ScopeKind.INDEXES:
        return {
          suggestions: [
            ...['unique', 'pk'].map((name) => ({
              label: name,
              insertText: name,
              insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
              kind: CompletionItemKind.Property,
              range: undefined as any,
            })),
            ...['note', 'name', 'type'].map((name) => ({
              label: name,
              insertText: `${name}: `,
              kind: CompletionItemKind.Property,
              insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
              range: undefined as any,
            })),
          ],
        };
      case ScopeKind.REF:
        return {
          suggestions: ['update', 'delete'].map((name) => ({
            label: name,
            insertText: `${name}: `,
            kind: CompletionItemKind.Property,
            insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
            range: undefined as any,
          })),
        };
      default:
        break;
    }

    return noSuggestions();
  }

  private suggestOnColon(
    model: TextModel,
    offset: number, // This offset is assumed to be after or right at the colon
    colon: SyntaxToken,
  ): CompletionList {
    const settingNameFragments: string[] = [];
    const ctx = this.compiler.context(offset).unwrap_or(undefined);

    if (ctx?.subfield?.settingList) {
      let iter = TokenSourceIterator.fromOffset(this.compiler, offset);
      while (!iter.isOutOfBound()) {
        const token = iter.value().unwrap();
        if (token.kind !== SyntaxTokenKind.IDENTIFIER) {
          break;
        }
        settingNameFragments.push(token.value);
        iter = iter.back();
      }

      const res = this.suggestAttributeValue(model, offset, settingNameFragments.join(' '));

      return !shouldAppendSpace(colon, offset) ? res : prependSpace(res);
    }

    if (!ctx) {
      return noSuggestions();
    }

    const lineIter = TokenLineIterator.fromOffset(this.compiler, offset);
    // Note: An incomplete simple element declaration may corrupt the ElementDeclarationNode
    // and `ctx` may fail to hold the precise scope, rather, it would holds the parent's scope
    // e.g
    // Ref R: // At this point, the scope would be `TopLevel`
    // Therefore, this check also tries to inspect previous tokens (before :)
    if (ctx.scope?.kind === ScopeKind.REF || isAtStartOfSimpleBody(lineIter, ElementKind.REF)) {
      const res = this.suggestNamesInScope(model, offset, ctx.element?.node, [
        SymbolKind.Schema,
        SymbolKind.Table,
      ]);

      return !shouldAppendSpace(colon, offset) ? res : prependSpace(res);
    }

    return noSuggestions();
  }

  private suggestAttributeValue(
    model: TextModel,
    offset: number,
    settingName: string,
  ): CompletionList {
    switch (settingName?.toLowerCase()) {
      case 'update':
      case 'delete':
        return {
          suggestions: ['cascade', 'set default', 'set null', 'restrict'].map((name) => ({
            label: name,
            insertText: name,
            kind: CompletionItemKind.Value,
            insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
            range: undefined as any,
          })),
        };
      case 'type':
        return {
          suggestions: ['btree', 'hash'].map((name) => ({
            label: name,
            insertText: `'${name}'`,
            kind: CompletionItemKind.Value,
            insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
            range: undefined as any,
          })),
        };
      default:
        break;
    }

    return noSuggestions();
  }

  private suggestMembers(
    model: TextModel,
    offset: number, // The offset is assumed to be after or right at the dot
  ): CompletionList {
    let iter = TokenSourceIterator.fromOffset(this.compiler, offset);
    const nameStack: string[] = [];
    let curToken = iter.value().unwrap_or(undefined);

    while (curToken?.kind === SyntaxTokenKind.OP && curToken.value === '.') {
      iter = iter.back();
      curToken = iter.value().unwrap_or(undefined);
      if (
        curToken?.kind === SyntaxTokenKind.IDENTIFIER ||
        curToken?.kind === SyntaxTokenKind.QUOTED_STRING
      ) {
        nameStack.push(curToken.value);
      }
      iter = iter.back();
      curToken = iter.value().unwrap_or(undefined);
    }

    return {
      suggestions: this.compiler.membersOfName(nameStack).map(({ kind, name }) => ({
        label: name,
        insertText: name,
        kind: pickCompletionItemKind(kind),
        range: undefined as any,
      })),
    };
  }

  private suggestOnIndependentLine(
    model: TextModel,
    offset: number,
    prevTokensOnLine: SyntaxToken[],
    editedToken: SyntaxToken | undefined,
  ): CompletionList {
    let curLine = prevTokensOnLine;
    if (curLine.length === 0) {
      return this.suggestOnFirstNonTrivialToken(model, offset);
    }

    const ctx = this.compiler.context(offset).unwrap_or(undefined);

    curLine = trimLeftMemberAccess(curLine).remaining;
    if (curLine.length === 0) {
      switch (ctx?.scope?.kind) {
        case ScopeKind.TABLE:
          return this.suggestColumnType(model, offset);
        default:
          break;
      }
    }

    return noSuggestions();
  }

  private suggestColumnType(model: TextModel, offset: number): CompletionList {
    const ctx = this.compiler.context(offset).unwrap_or(undefined);

    return {
      suggestions: [
        ...[
          'int',
          'integer',
          'bit',
          'bool',
          'boolean',
          'logical',
          'char',
          'varchar',
          'float',
          'double',
          'timestamp',
        ].map((name) => ({
          label: name,
          insertText: name,
          insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
          kind: CompletionItemKind.TypeParameter,
          range: undefined as any,
        })),
        ...this.suggestNamesInScope(model, offset, ctx?.element?.node, [
          SymbolKind.Enum,
          SymbolKind.Schema,
        ]).suggestions,
      ],
    };
  }
}

function noSuggestions(): CompletionList {
  return {
    suggestions: [],
  };
}

function prependSpace(completionList: CompletionList): CompletionList {
  return {
    suggestions: completionList.suggestions.map((s) => ({
      ...s,
      insertText: ` ${s.insertText}`,
    })),
  };
}
