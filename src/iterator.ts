import Compiler from './compiler';
import { SyntaxToken } from './lib/lexer/tokens';
import { hasTrailingNewLines } from './lib/lexer/utils';
import { None, Option, Some } from './lib/option';

export class TokenIterator {
  private readonly tokens: readonly Readonly<SyntaxToken>[];
  private readonly id: number;

  protected constructor(tokens: readonly SyntaxToken[], id: number) {
    this.tokens = tokens;
    this.id = id;
  }

  back(): TokenIterator {
    return new TokenIterator(this.tokens, this.id - 1);
  }

  next(): TokenIterator {
    return new TokenIterator(this.tokens, this.id + 1);
  }

  value(): Option<Readonly<SyntaxToken>> {
    return this.isOutOfBound() ? new None() : new Some(this.tokens[this.id]);
  }

  isOutOfBound(): boolean {
    return this.id < 0 || this.id >= this.tokens.length;
  }

  collectAll(): Option<Readonly<SyntaxToken>[]> {
    return this.isOutOfBound() ? new None() : new Some([...this.tokens]);
  }

  collectFromStart(): Option<Readonly<SyntaxToken>[]> {
    return this.isOutOfBound() ? new None() : new Some(this.tokens.slice(0, this.id + 1));
  }

  collectTillEnd(): Option<Readonly<SyntaxToken>[]> {
    return this.isOutOfBound() ? new None() : new Some(this.tokens.slice(this.id));
  }

  isAtStart(): boolean {
    return this.id === 0;
  }

  isAtEnd(): boolean {
    return this.id === this.tokens.length - 1;
  }
}

export class TokenLineIterator extends TokenIterator {
  static fromOffset(compiler: Compiler, offset: number): TokenLineIterator {
    const id = compiler.token.nonTrivial.beforeOrContainOnSameLine(offset).unwrap_or(-1);

    if (id === -1) {
      return new TokenLineIterator([], -1);
    }

    let start: number | undefined;
    let end: number | undefined;
    for (start = id - 1; start >= -1; start -= 1) {
      if (start === -1 || hasTrailingNewLines(compiler.token.flatStream()[start])) {
        start += 1;
        break;
      }
    }

    for (end = id; end < compiler.token.flatStream().length; end += 1) {
      if (hasTrailingNewLines(compiler.token.flatStream()[end])) {
        break;
      }
    }

    return new TokenLineIterator(compiler.token.flatStream().slice(start, end + 1), id - start);
  }
}

export class TokenSourceIterator extends TokenIterator {
  static fromOffset(compiler: Compiler, offset: number): TokenIterator {
    const id = compiler.token.nonTrivial.beforeOrContain(offset).unwrap_or(-1);

    return new TokenIterator(compiler.token.flatStream(), id);
  }
}
