import { ParsingError } from '../errors';
import { SyntaxToken, SyntaxTokenKind } from '../lexer/tokens';

class ContextJumpMessage {
  offset: number;

  constructor(offset: number) {
    if (offset === 0) {
      throw new Error("A context jump message where the offset is 0 shouldn't be thrown");
    }
    this.offset = offset - 1;
  }
}

export const enum ParsingContext {
  ListExpression,
  GroupExpression,
  BlockExpression,
}

function canHandle(context: ParsingContext, token: SyntaxToken): boolean {
  const tokenKind = token.kind;
  switch (context) {
    case ParsingContext.ListExpression:
      return tokenKind === SyntaxTokenKind.RBRACKET || tokenKind === SyntaxTokenKind.COMMA;
    case ParsingContext.GroupExpression:
      return tokenKind === SyntaxTokenKind.RPAREN || tokenKind === SyntaxTokenKind.COMMA;
    case ParsingContext.BlockExpression:
      return tokenKind === SyntaxTokenKind.RBRACE;
  }

  return false;
}
export class ParsingContextStack {
  private stack: ParsingContext[] = [];

  private numberOfNestedLParens = 0;

  private numberOfNestedLBrackets = 0;

  private numberOfNestedLBraces = 0;

  push(ctx: ParsingContext) {
    this.stack.push(ctx);
    if (ctx === ParsingContext.ListExpression) {
      ++this.numberOfNestedLBrackets;
    }
    if (ctx === ParsingContext.GroupExpression) {
      ++this.numberOfNestedLParens;
    }
    if (ctx === ParsingContext.BlockExpression) {
      ++this.numberOfNestedLBraces;
    }
  }

  pop(): ParsingContext | undefined {
    const top = this.stack.pop();
    if (top === ParsingContext.ListExpression) {
      --this.numberOfNestedLBrackets;
    }
    if (top === ParsingContext.GroupExpression) {
      --this.numberOfNestedLParens;
    }

    return top;
  }

  isWithinGroupExpressionContext(): boolean {
    return this.numberOfNestedLParens > 0;
  }

  isWithinListExpressionContext(): boolean {
    return this.numberOfNestedLBrackets > 0;
  }

  withContextDo<T>(
    context: ParsingContext | undefined,
    callback: (
      synchronizationPoint: (
        mayThrow: () => void,
        synchronizationCallback: (e: unknown) => void,
      ) => void,
    ) => T,
  ): () => T {
    return () => {
      if (context) {
        this.stack.push(context);
      }
      try {
        const res = callback(this.synchronizationPoint);

        return res;
      } catch (e) {
        if (!(e instanceof ContextJumpMessage)) {
          throw e;
        }

        throw new ContextJumpMessage(e.offset);
      } finally {
        if (context) {
          this.stack.pop();
        }
      }
    };
  }

  findHandlerContextOffset(token: SyntaxToken): number {
    if (
      token.kind === SyntaxTokenKind.COMMA &&
      this.numberOfNestedLBrackets <= 0 &&
      this.numberOfNestedLParens <= 0
    ) return 0;
    if (token.kind === SyntaxTokenKind.RBRACKET && this.numberOfNestedLBrackets <= 0) return 0;
    if (token.kind === SyntaxTokenKind.RPAREN && this.numberOfNestedLParens <= 0) return 0;
    if (token.kind === SyntaxTokenKind.RBRACE && this.numberOfNestedLBraces <= 0) return 0;
    for (let i = this.stack.length - 1; i >= 0; --i) {
      if (canHandle(this.stack[i], token)) {
        return this.stack.length - i - 1;
      }
    }

    return 0;
  }

  goToHandlerContext(token: SyntaxToken) {
    const offset = this.findHandlerContextOffset(token);

    if (offset === 0) {
      return;
    }

    throw new ContextJumpMessage(offset);
  }

  synchronizationPoint = (mayThrow: () => void, synchronizationCallback: (e: unknown) => void) => {
    try {
      mayThrow();
    } catch (e) {
      if (e instanceof ParsingError && e.value instanceof SyntaxToken) {
        this.goToHandlerContext(e.value);
      }
      synchronizationCallback(e);
    }
  };
}
