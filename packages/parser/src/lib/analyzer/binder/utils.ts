import { isAccessExpression, isExpressionAVariableNode } from 'lib/parser/utils';
import { SyntaxToken } from '../../lexer/tokens';
import {
  ElementDeclarationNode,
  InfixExpressionNode,
  PostfixExpressionNode,
  PrefixExpressionNode,
  PrimaryExpressionNode,
  SyntaxNode,
  TupleExpressionNode,
} from '../../parser/nodes';
import { ElementKind } from '../types';
import CustomBinder from './elementBinder/custom';
import EnumBinder from './elementBinder/enum';
import IndexesBinder from './elementBinder/indexes';
import NoteBinder from './elementBinder/note';
import ProjectBinder from './elementBinder/project';
import RefBinder from './elementBinder/ref';
import TableBinder from './elementBinder/table';
import TableGroupBinder from './elementBinder/tableGroup';

export function pickBinder(element: ElementDeclarationNode & { type: SyntaxToken }) {
  switch (element.type.value.toLowerCase() as ElementKind) {
    case ElementKind.Enum:
      return EnumBinder;
    case ElementKind.Table:
      return TableBinder;
    case ElementKind.TableGroup:
      return TableGroupBinder;
    case ElementKind.Project:
      return ProjectBinder;
    case ElementKind.Ref:
      return RefBinder;
    case ElementKind.Note:
      return NoteBinder;
    case ElementKind.Indexes:
      return IndexesBinder;
    default:
      return CustomBinder;
  }
}

// Scan for variable node and member access expression in the node
export function scanForBinding(node: SyntaxNode | undefined): (PrimaryExpressionNode | InfixExpressionNode)[] {
  if (!node) {
    return [];
  }

  if (isExpressionAVariableNode(node)) {
      return [node];
  }

  if (node instanceof InfixExpressionNode) {
    if (isAccessExpression(node)) {
      return [node];
    }

    return [...scanForBinding(node.leftExpression), ...scanForBinding(node.rightExpression)];
  }

  if (node instanceof PrefixExpressionNode) {
    return scanForBinding(node.expression);
  }

  if (node instanceof PostfixExpressionNode) {
    return scanForBinding(node.expression);
  }

  if (node instanceof TupleExpressionNode) {
    return node.elementList.flatMap(scanForBinding);
  }

  // The other cases are not supported as practically they shouldn't arise
  return [];
}
