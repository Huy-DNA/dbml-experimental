import { isAccessExpression, isQuotedStringNode } from '../utils';
import { None, Option, Some } from '../option';
import {
  LiteralNode,
  PrimaryExpressionNode,
  SyntaxNode,
  SyntaxNodeKind,
  TupleExpressionNode,
  VariableNode,
} from '../parser/nodes';
import { extractQuotedStringToken } from './validator/utils/helpers';

export function destructureMemberAccessExpression(node: SyntaxNode): Option<SyntaxNode[]> {
  if (node instanceof PrimaryExpressionNode || node instanceof TupleExpressionNode) {
    return new Some([node]);
  }

  if (!isAccessExpression(node)) {
    return new None();
  }

  const fragments = destructureMemberAccessExpression(node.leftExpression).unwrap_or(undefined);

  if (!fragments) {
    return new None();
  }

  fragments.push(node.rightExpression);

  return new Some(fragments);
}

export function destructureComplexVariable(node: SyntaxNode): Option<string[]> {
  const fragments = destructureMemberAccessExpression(node).unwrap_or(undefined);

  if (!fragments) {
    return new None();
  }

  const variables: string[] = [];

  // eslint-disable-next-line no-restricted-syntax
  for (const fragment of fragments) {
    const variable = extractVariable(fragment).unwrap_or(undefined);
    if (!variable) {
      return new None();
    }

    variables.push(variable);
  }

  return new Some(variables);
}

export function extractVariable(node: SyntaxNode): Option<string> {
  if (
    !(node instanceof PrimaryExpressionNode) ||
    node.expression.kind !== SyntaxNodeKind.VARIABLE
  ) {
    return new None();
  }

  return new Some(node.expression.variable.value);
}

export function destructureIndex(node: SyntaxNode): Option<{ table: string[]; column: string[] }> {
  const fragments = destructureMemberAccessExpression(node).unwrap_or(undefined);

  if (!fragments || fragments.length === 0) {
    return new None();
  }

  const column = fragments.pop()!;

  if (!fragments.every(isQuotedStringNode)) {
    return new None();
  }

  if (isQuotedStringNode(column)) {
    return new Some({
      table: fragments.map(extractQuotedStringToken) as string[],
      column: [extractQuotedStringToken(column) as string],
    });
  }

  if (column instanceof TupleExpressionNode && column.elementList.every(isQuotedStringNode)) {
    return new Some({
      table: fragments.map(extractQuotedStringToken) as string[],
      column: column.elementList.map(extractQuotedStringToken) as string[],
    });
  }

  return new None();
}

export function isRelationshipOp(op: string): boolean {
  return op === '-' || op === '<>' || op === '>' || op === '<';
}
