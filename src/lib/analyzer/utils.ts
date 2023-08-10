import { isAccessExpression, isPrimaryVariableNode, isQuotedStringNode } from '../utils';
import { None, Option, Some } from '../option';
import {
  InfixExpressionNode,
  LiteralNode,
  PrimaryExpressionNode,
  SyntaxNode,
  TupleExpressionNode,
  VariableNode,
} from '../parser/nodes';
import { isRelationshipOp } from './validator/utils';
import { SyntaxToken } from '../lexer/tokens';

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
    const variable = extractVariableFromExpression(fragment).unwrap_or(undefined);
    if (!variable) {
      return new None();
    }

    variables.push(variable);
  }

  return new Some(variables);
}

export function extractVariableFromExpression(node: SyntaxNode): Option<string> {
  if (!isPrimaryVariableNode(node)) {
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

  if (!fragments.every(isPrimaryVariableNode)) {
    return new None();
  }

  if (isPrimaryVariableNode(column)) {
    return new Some({
      table: fragments.map(extractVarNameFromPrimaryVariable),
      column: [extractVarNameFromPrimaryVariable(column)],
    });
  }

  if (column instanceof TupleExpressionNode && column.elementList.every(isPrimaryVariableNode)) {
    return new Some({
      table: fragments.map(extractVarNameFromPrimaryVariable),
      column: column.elementList.map(extractVarNameFromPrimaryVariable),
    });
  }

  return new None();
}

export function extractVarNameFromPrimaryVariable(
  node: PrimaryExpressionNode & { expression: VariableNode },
): string {
  return node.expression.variable.value;
}

export function joinTokenStrings(tokens: SyntaxToken[]): string {
  return tokens.map((token) => token.value).join(' ');
}

export function extractQuotedStringToken(value?: SyntaxNode): string | undefined {
  if (!isQuotedStringNode(value)) {
    return undefined;
  }

  const primaryExp = value as PrimaryExpressionNode;
  if (primaryExp.expression instanceof VariableNode) {
    return primaryExp.expression.variable.value;
  }

  if (primaryExp.expression instanceof LiteralNode) {
    return primaryExp.expression.literal.value;
  }

  return undefined; // unreachable
}

export function isBinaryRelationship(value?: SyntaxNode | SyntaxToken[]): boolean {
  if (!(value instanceof InfixExpressionNode)) {
    return false;
  }

  if (!isRelationshipOp(value.op.value)) {
    return false;
  }

  return (
    destructureComplexVariable(value.leftExpression)
      .and_then(() => destructureComplexVariable(value.rightExpression))
      .unwrap_or(undefined) !== undefined
  );
}
