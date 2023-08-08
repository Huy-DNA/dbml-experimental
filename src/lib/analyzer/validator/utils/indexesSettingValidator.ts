import { SyntaxToken } from '../../../lexer/tokens';
import { PrimaryExpressionNode, SyntaxNode, VariableNode } from '../../../parser/nodes';
import { isQuotedStringToken, isVoid } from './helpers';

const indexesSettingValueValidator: {
  [index: string]: (value?: SyntaxNode | SyntaxToken[]) => boolean;
} = {
  note: isQuotedStringToken,
  name: isQuotedStringToken,
  type: isValidIndexesType,
  unique: isVoid,
  pk: isVoid,
};

export function getIndexesSettingValueValidator(
  settingName: string,
): ((value?: SyntaxNode | SyntaxToken[]) => boolean) | undefined {
  return indexesSettingValueValidator[settingName];
}

export function allowDuplicateIndexesSetting(settingName: string): boolean {
  return false;
}

function isValidIndexesType(value?: SyntaxNode | SyntaxToken[]): boolean {
  if (value instanceof PrimaryExpressionNode && value.expression instanceof VariableNode) {
    const type = value.expression.variable.value;

    return type === 'btree' || type === 'hash';
  }

  return false;
}
