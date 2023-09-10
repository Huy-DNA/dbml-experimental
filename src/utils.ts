import { SyntaxToken } from './lib/lexer/tokens';
import {
  AttributeNode,
  BlockExpressionNode,
  CallExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  FunctionExpressionNode,
  GroupExpressionNode,
  IdentiferStreamNode,
  InfixExpressionNode,
  ListExpressionNode,
  LiteralNode,
  PostfixExpressionNode,
  PrefixExpressionNode,
  PrimaryExpressionNode,
  ProgramNode,
  SyntaxNode,
  TupleExpressionNode,
  VariableNode,
} from './lib/parser/nodes';
import {
 alternateLists, gatherIntoList, getTokenFullEnd, getTokenFullStart,
} from './lib/utils';

export function getMemberChain(node: SyntaxNode): Readonly<(SyntaxNode | SyntaxToken)[]> {
  if (node instanceof ProgramNode) {
    return [...node.body, node.eof];
  }

  if (node instanceof ElementDeclarationNode) {
    return gatherIntoList(
      node.type,
      node.name,
      node.as,
      node.alias,
      node.attributeList,
      node.bodyColon,
      node.body,
    );
  }

  if (node instanceof AttributeNode) {
    return gatherIntoList(node.name, node.colon, node.value);
  }

  if (node instanceof IdentiferStreamNode) {
    return node.identifiers;
  }

  if (node instanceof LiteralNode) {
    return [node.literal];
  }

  if (node instanceof VariableNode) {
    return [node.variable];
  }

  if (node instanceof PrefixExpressionNode) {
    return [node.op, node.expression];
  }

  if (node instanceof InfixExpressionNode) {
    return [node.leftExpression, node.op, node.rightExpression];
  }

  if (node instanceof PostfixExpressionNode) {
    return [node.expression, node.op];
  }

  if (node instanceof FunctionExpressionNode) {
    return [node.value];
  }

  if (node instanceof FunctionApplicationNode) {
    return [node.callee, ...node.args];
  }

  if (node instanceof BlockExpressionNode) {
    return [node.blockOpenBrace, ...node.body, node.blockCloseBrace];
  }

  if (node instanceof ListExpressionNode) {
    return [
      node.listOpenBracket,
      ...alternateLists(node.elementList, node.commaList),
      node.listCloseBracket,
    ];
  }

  if (node instanceof TupleExpressionNode) {
    return [
      node.tupleOpenParen,
      ...alternateLists(node.elementList, node.commaList),
      node.tupleCloseParen,
    ];
  }

  if (node instanceof CallExpressionNode) {
    return [node.callee, node.argumentList];
  }

  if (node instanceof PrimaryExpressionNode) {
    return [node.expression];
  }

  if (node instanceof GroupExpressionNode) {
    throw new Error('This case is already handled by TupleExpressionNode');
  }

  throw new Error('Unreachable - no other possible cases');
}

export function isOffsetWithinFullSpan(
  offset: number,
  nodeOrToken: SyntaxNode | SyntaxToken,
): boolean {
  if (nodeOrToken instanceof SyntaxToken) {
    return offset >= getTokenFullStart(nodeOrToken) && offset < getTokenFullEnd(nodeOrToken);
  }

  return offset >= nodeOrToken.fullStart && offset < nodeOrToken.fullEnd;
}

export function isOffsetWithinSpan(offset: number, nodeOrToken: SyntaxNode | SyntaxToken): boolean {
  return offset >= nodeOrToken.start && offset < nodeOrToken.end;
}

export function returnIfIsOffsetWithinFullSpan(
  offset: number,
  node?: SyntaxNode,
): SyntaxNode | undefined;
export function returnIfIsOffsetWithinFullSpan(
  offset: number,
  token?: SyntaxToken,
): SyntaxToken | undefined;
export function returnIfIsOffsetWithinFullSpan(
  offset: number,
  nodeOrToken?: SyntaxNode | SyntaxToken,
): SyntaxNode | SyntaxToken | undefined {
  if (!nodeOrToken) {
    return undefined;
  }

  return isOffsetWithinFullSpan(offset, nodeOrToken) ? nodeOrToken : undefined;
}
