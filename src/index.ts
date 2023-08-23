import Lexer from './lib/lexer/lexer';
import Parser from './lib/parser/parser';
import { CompileError } from './lib/errors';
import Analyzer from './lib/analyzer/analyzer';
import { serialize } from './lib/serialization/serialize';
import { ProgramNode, SyntaxNodeIdGenerator } from './lib/parser/nodes';
import Report from './lib/report';
import { NodeSymbolIdGenerator } from './lib/analyzer/symbol/symbols';

export function parseFromSource(source: string): Report<ProgramNode, CompileError> {
  SyntaxNodeIdGenerator.reset();
  NodeSymbolIdGenerator.reset();

  const lexer = new Lexer(source);

  return lexer
    .lex()
    .chain((tokens) => {
      const parser = new Parser(tokens);

      return parser.parse();
    })
    .chain((ast) => {
      const analyzer = new Analyzer(ast);

      return analyzer.analyze();
    });
}

export { serialize };
