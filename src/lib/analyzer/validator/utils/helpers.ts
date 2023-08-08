import { Some } from '../../../option';
import { SyntaxToken, SyntaxTokenKind } from '../../../lexer/tokens';
import {
  AttributeNode,
  CallExpressionNode,
  FunctionExpressionNode,
  InfixExpressionNode,
  LiteralNode,
  PrefixExpressionNode,
  PrimaryExpressionNode,
  SyntaxNode,
  SyntaxNodeKind,
  VariableNode,
} from '../../../parser/nodes';
import { destructureComplexVariable, isRelationshipOp } from '../../utils';
import { isHexChar, isQuotedStringNode } from '../../../utils';

export function joinTokenStrings(tokens: SyntaxToken[]): string {
  return tokens.map((token) => token.value).join(' ');
}

export function isValidColor(value?: SyntaxNode | SyntaxToken[]): boolean {
  if (
    !(value instanceof PrimaryExpressionNode) ||
    !(value.expression instanceof LiteralNode) ||
    !(value.expression.literal.kind === SyntaxTokenKind.COLOR_LITERAL)
  ) {
    return false;
  }

  const color = value.expression.literal.value;

  // e.g. #fff or #0abcde
  if (color.length !== 4 && color.length !== 7) {
    return false;
  }

  if (color[0] !== '#') {
    return false;
  }

  for (let i = 1; i < color.length; ++i) {
    if (!isHexChar(color[i])) {
      return false;
    }
  }

  return true;
}

export function isVoid(value?: SyntaxNode | SyntaxToken[]): boolean {
  return (
    value === undefined ||
    (!Array.isArray(value) && value.end === -1 && value.start === -1) ||
    (Array.isArray(value) && value.length === 0)
  );
}

export function isValidDefaultValue(value?: SyntaxNode | SyntaxToken[]): boolean {
  if (
    (value instanceof PrimaryExpressionNode && value.expression instanceof LiteralNode) ||
    value instanceof FunctionExpressionNode
  ) {
    return true;
  }

  if (!(value instanceof InfixExpressionNode && value)) {
    return false;
  }

  const variables = destructureComplexVariable(value).unwrap_or(undefined);

  return variables !== undefined && variables.length > 0;
}

export function isUnaryRelationship(value?: SyntaxNode | SyntaxToken[]): boolean {
  if (!(value instanceof PrefixExpressionNode)) {
    return false;
  }

  if (!isRelationshipOp(value.op.value)) {
    return false;
  }

  const variables = destructureComplexVariable(value.expression).unwrap_or(undefined);

  return variables !== undefined && variables.length > 0;
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

  const isOk = destructureComplexVariable(value.leftExpression).and_then(() =>
    destructureComplexVariable(value.rightExpression));

  return isOk instanceof Some;
}
