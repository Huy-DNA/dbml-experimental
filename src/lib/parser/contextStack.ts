import _ from 'lodash';
import { SyntaxToken, SyntaxTokenKind } from '../lexer/tokens';

export const enum ParsingContext {
  ListExpression,
  GroupExpression,
  BlockExpression,
}

export const enum HandlerContext {
  ListExpression = ParsingContext.ListExpression,
  BlockExpression = ParsingContext.BlockExpression,
  GroupExpression = ParsingContext.GroupExpression,
  This,
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
      this.numberOfNestedLBrackets += 1;
    }
    if (ctx === ParsingContext.GroupExpression) {
      this.numberOfNestedLParens += 1;
    }
    if (ctx === ParsingContext.BlockExpression) {
      this.numberOfNestedLBraces += 1;
    }
  }

  pop(): ParsingContext | undefined {
    const top = this.stack.pop();
    if (top === ParsingContext.ListExpression) {
      this.numberOfNestedLBrackets -= 1;
    }
    if (top === ParsingContext.GroupExpression) {
      this.numberOfNestedLParens -= 1;
    }
    if (top === ParsingContext.BlockExpression) {
      this.numberOfNestedLBraces -= 1;
    }

    return top;
  }

  top(): ParsingContext | undefined {
    return _.last(this.stack);
  }

  isWithinGroupExpressionContext(): boolean {
    return this.numberOfNestedLParens > 0;
  }

  isWithinListExpressionContext(): boolean {
    return this.numberOfNestedLBrackets > 0;
  }

  // Call the passed in callback
  // with the guarantee that the passed in context will be pushed and popped properly
  // even in cases of exceptions
  withContextDo<T>(context: ParsingContext, callback: () => T): () => T {
    return () => {
      this.push(context);

      try {
        const res = callback();

        return res;
      } finally {
        this.pop();
      }
    };
  }

  // Return the type of the handler context currently in the context stack to handle `token`
  findHandlerContext(token: SyntaxToken): HandlerContext {
    if (
      token.kind === SyntaxTokenKind.COMMA &&
      this.numberOfNestedLBrackets <= 0 &&
      this.numberOfNestedLParens <= 0
    ) {
      return HandlerContext.This;
    }
    if (token.kind === SyntaxTokenKind.RBRACKET && this.numberOfNestedLBrackets <= 0) return HandlerContext.This;
    if (token.kind === SyntaxTokenKind.RPAREN && this.numberOfNestedLParens <= 0) return HandlerContext.This;
    if (token.kind === SyntaxTokenKind.RBRACE && this.numberOfNestedLBraces <= 0) return HandlerContext.This;
    for (let i = this.stack.length - 1; i >= 0; i -= 1) {
      if (canHandle(this.stack[i], token)) {
        return this.stack[i] as unknown as HandlerContext;
      }
    }

    return HandlerContext.This;
  }
}
