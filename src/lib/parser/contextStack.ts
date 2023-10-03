import _ from 'lodash';
import { SyntaxToken, SyntaxTokenKind } from '../lexer/tokens';

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

  isWithinBlockExpressionContext(): boolean {
    return this.numberOfNestedLBraces > 0;
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
  findHandlerContext(tokens: SyntaxToken[], curTokenId: number): ParsingContext | null {
    if (
      this.numberOfNestedLBraces <= 0 &&
      this.numberOfNestedLBrackets <= 0 &&
      this.numberOfNestedLParens <= 0
    ) {
      return null;
    }

    for (let tokenId = curTokenId; tokenId < tokens.length; tokenId += 1) {
      const token = tokens[tokenId];
      if (
        ![
          SyntaxTokenKind.COMMA,
          SyntaxTokenKind.RBRACE,
          SyntaxTokenKind.RBRACKET,
          SyntaxTokenKind.RPAREN,
        ].includes(token.kind)
      ) {
        continue;
      }

      if (token.kind === SyntaxTokenKind.COMMA) {
        if (this.isWithinGroupExpressionContext() || this.isWithinListExpressionContext()) {
          return this.stack
            .reverse()
            .find((c) =>
              [ParsingContext.GroupExpression, ParsingContext.ListExpression].includes(c))!;
        }
        continue;
      }

      if (token.kind === SyntaxTokenKind.RBRACKET && this.isWithinListExpressionContext()) {
        return ParsingContext.ListExpression;
      }
      if (token.kind === SyntaxTokenKind.RPAREN && this.isWithinGroupExpressionContext()) {
        return ParsingContext.GroupExpression;
      }
      if (token.kind === SyntaxTokenKind.RBRACE && this.isWithinBlockExpressionContext()) {
        return ParsingContext.BlockExpression;
      }
    }

    return null;
  }
}
