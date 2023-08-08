import { isQuotedStringNode } from '../../../utils';
import { SyntaxToken } from '../../../lexer/tokens';
import {
  AccessExpressionNode,
  CallExpressionNode,
  PrimaryExpressionNode,
  SyntaxNode,
} from '../../../parser/nodes';
import { destructureComplexVariable } from '../../utils';
import { isUnaryRelationship, isValidDefaultValue, isVoid } from './helpers';

export function isValidColumnType(type: SyntaxNode): boolean {
  if (
    !(
      type instanceof CallExpressionNode ||
      type instanceof AccessExpressionNode ||
      type instanceof PrimaryExpressionNode
    )
  ) {
    return false;
  }

  while (type instanceof CallExpressionNode) {
    // eslint-disable-next-line no-param-reassign
    type = type.callee;
  }

  const variables = destructureComplexVariable(type).unwrap_or(undefined);

  return variables !== undefined && variables.length > 0;
}

export function allowDuplicateColumnSetting(settingName: string): boolean {
  // eslint-disable-next-line
  const _settingName = settingName.toLowerCase();

  return _settingName === 'ref';
}

const columnSettingValueValidator: {
  [index: string]: (value?: SyntaxNode | SyntaxToken[]) => boolean;
} = {
  note: isQuotedStringNode,
  ref: isUnaryRelationship,
  'primary key': isVoid,
  default: isValidDefaultValue,
  increment: isVoid,
  'not null': isVoid,
  null: isVoid,
  pk: isVoid,
  unique: isVoid,
};

export function getColumnSettingValueValidator(
  settingName: string,
): ((value?: SyntaxNode | SyntaxToken[]) => boolean) | undefined {
  return columnSettingValueValidator[settingName];
}
