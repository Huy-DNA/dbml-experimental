import { SyntaxToken } from '../../../lexer/tokens';
import { SyntaxNode } from '../../../parser/nodes';
import { isQuotedStringToken, isValidColor } from './helpers';

const tableSettingValueValidator: {
  [index: string]: (value?: SyntaxNode | SyntaxToken[]) => boolean;
} = {
  note: isQuotedStringToken,
  headercolor: isValidColor,
};
export function getTableSettingValueValidator(
  settingName: string,
): ((value?: SyntaxNode | SyntaxToken[]) => boolean) | undefined {
  return tableSettingValueValidator[settingName];
}

export function allowDuplicateTableSetting(settingName: string): boolean {
  return false;
}
