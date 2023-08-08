import { SyntaxToken } from '../../../lexer/tokens';
import { SyntaxNode } from '../../../parser/nodes';
import { isQuotedStringNode } from '../../../utils';

const enumFieldSettingValueValidator: {
  [index: string]: (value?: SyntaxNode | SyntaxToken[]) => boolean;
} = {
  note: isQuotedStringNode,
};
export function getEnumFieldSettingValueValidator(
  settingName: string,
): ((value?: SyntaxNode | SyntaxToken[]) => boolean) | undefined {
  return enumFieldSettingValueValidator[settingName];
}

export function allowDuplicateEnumFieldSetting(settingName: string): boolean {
  return false;
}
