import { SyntaxToken, SyntaxTokenKind } from '../../lexer/tokens';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionExpressionNode,
  ListExpressionNode,
  LiteralNode,
  PrefixExpressionNode,
  PrimaryExpressionNode,
  SyntaxNode,
  VariableNode,
} from '../../parser/nodes';
import { isAccessExpression, isHexChar } from '../../utils';
import { destructureComplexVariable } from '../utils';
import { ValidatorContext } from './validatorContext';
import CustomValidator from './elementValidators/custom';
import EnumValidator from './elementValidators/enum';
import IndexesValidator from './elementValidators/indexes';
import NoteValidator from './elementValidators/note';
import ProjectValidator from './elementValidators/project';
import RefValidator from './elementValidators/ref';
import TableValidator from './elementValidators/table';
import TableGroupValidator from './elementValidators/tableGroup';
import {
  NodeSymbolId,
  createColumnSymbolId,
  createEnumElementSymbolId,
  createEnumSymbolId,
  createSchemaSymbolId,
  createTableGroupSymbolId,
  createTableSymbolId,
} from '../symbol/symbolIndex';
import {
  ColumnSymbol,
  EnumElementSymbol,
  EnumSymbol,
  NodeSymbol,
  SchemaSymbol,
  TableGroupElementSymbol,
  TableGroupSymbol,
  TableSymbol,
} from '../symbol/symbols';
import SymbolTable from '../symbol/symbolTable';

export function pickValidator(element: ElementDeclarationNode) {
  switch (element.type.value.toLowerCase()) {
    case 'enum':
      return EnumValidator;
    case 'table':
      return TableValidator;
    case 'tablegroup':
      return TableGroupValidator;
    case 'project':
      return ProjectValidator;
    case 'ref':
      return RefValidator;
    case 'note':
      return NoteValidator;
    case 'indexes':
      return IndexesValidator;
    default:
      return CustomValidator;
  }
}
export function isValidName(nameNode: SyntaxNode): boolean {
  return !!destructureComplexVariable(nameNode).unwrap_or(false);
}

export function isValidAlias(
  aliasNode: SyntaxNode,
): aliasNode is PrimaryExpressionNode & { expression: VariableNode } {
  return isSimpleName(aliasNode);
}

export function isSimpleName(
  nameNode: SyntaxNode,
): nameNode is PrimaryExpressionNode & { expression: VariableNode } {
  return nameNode instanceof PrimaryExpressionNode && nameNode.expression instanceof VariableNode;
}

export function isValidSettings(settingsNode: SyntaxNode): settingsNode is ListExpressionNode {
  return settingsNode instanceof ListExpressionNode;
}

export function hasComplexBody(
  node: ElementDeclarationNode,
): node is ElementDeclarationNode & { body: BlockExpressionNode; bodyOpenColon: undefined } {
  return node.body instanceof BlockExpressionNode && !node.bodyOpenColon;
}

export function hasSimpleBody(
  node: ElementDeclarationNode,
): node is ElementDeclarationNode & { bodyOpenColon: SyntaxToken } {
  return !!node.bodyOpenColon;
}

export function registerSchemaStack(variables: string[], initialSchema: SymbolTable): SymbolTable {
  let schema = initialSchema;
  // eslint-disable-next-line no-restricted-syntax
  for (const schemaName of variables) {
    const schemaId = createSchemaSymbolId(schemaName);
    if (!schema.has(schemaId)) {
      const schemaST = new SymbolTable();
      const schemaSymbol = new SchemaSymbol(schemaST);
      schema.set(schemaId, schemaSymbol);
      schema = schemaST;
    } else {
      const schemaSymbol = schema.get(schemaId)!;
      if (!schemaSymbol.symbolTable) {
        throw new Error('Expect a symbol table in a schema symbol');
      }
      schema = schemaSymbol.symbolTable;
    }
  }

  return schema;
}

export function createId(name: string, context: ValidatorContext): NodeSymbolId | undefined {
  switch (context) {
    case ValidatorContext.TableContext:
      return createTableSymbolId(name);
    case ValidatorContext.EnumContext:
      return createEnumSymbolId(name);
    case ValidatorContext.TableGroupContext:
      return createTableGroupSymbolId(name);
    default:
      return undefined;
  }
}

export function createSubfieldId(
  name: string,
  context: ValidatorContext,
): NodeSymbolId | undefined {
  switch (context) {
    case ValidatorContext.TableContext:
      return createColumnSymbolId(name);
    case ValidatorContext.EnumContext:
      return createEnumElementSymbolId(name);
    case ValidatorContext.TableGroupContext:
      return createTableGroupSymbolId(name);
    default:
      return undefined;
  }
}

export function createSymbol(
  declaration: SyntaxNode,
  context: ValidatorContext,
): NodeSymbol | undefined {
  switch (context) {
    case ValidatorContext.TableContext:
      return new TableSymbol(new SymbolTable(), declaration);
    case ValidatorContext.EnumContext:
      return new EnumSymbol(new SymbolTable(), declaration);
    case ValidatorContext.TableGroupContext:
      return new TableGroupSymbol(new SymbolTable(), declaration);
    default:
      return undefined;
  }
}

export function createSubfieldSymbol(
  declaration: SyntaxNode,
  context: ValidatorContext,
): NodeSymbol | undefined {
  switch (context) {
    case ValidatorContext.TableContext:
      return new ColumnSymbol(declaration);
    case ValidatorContext.EnumContext:
      return new EnumElementSymbol(declaration);
    case ValidatorContext.TableGroupContext:
      return new TableGroupElementSymbol(declaration);
    default:
      return undefined;
  }
}

export function isRelationshipOp(op: string): boolean {
  return op === '-' || op === '<>' || op === '>' || op === '<';
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

  for (let i = 1; i < color.length; i += 1) {
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

  if (!value || Array.isArray(value) || !isAccessExpression(value)) {
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
