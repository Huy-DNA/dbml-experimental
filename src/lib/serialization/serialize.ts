import { NodeSymbol } from '../analyzer/symbol/symbols';
import { ProgramNode, SyntaxNode } from '../parser/nodes';
import Report from '../report';
import { CompileError } from '../errors';

export function serialize(
  report: Report<ProgramNode, CompileError>,
  pretty: boolean = false,
): string {
  return JSON.stringify(
    report,
    function (key: string, value: any) {
      if (!(this instanceof ProgramNode) && key === 'symbol') {
        return (value as NodeSymbol)?.id;
      }

      if (key === 'symbol') {
        return {
          symbolTable: (value as NodeSymbol)?.symbolTable,
          references: (value as NodeSymbol)?.references.map((ref) => ref.id),
          id: (value as NodeSymbol)?.id,
          declaration: (value as NodeSymbol)?.declaration?.id,
        };
      }

      if (key === 'referee') {
        return (value as NodeSymbol)?.id;
      }

      if (key === 'parentElement') {
        return (value as SyntaxNode)?.id;
      }

      if (key === 'declaration') {
        return (value as SyntaxNode)?.id;
      }

      if (key === 'symbolTable') {
        return Object.fromEntries((value as any).table);
      }

      return value;
    },
    pretty ? 2 : 0,
  );
}
