import { isQuotedStringNode } from '../../../utils';
import { SyntaxToken } from '../../../lexer/tokens';
import { SyntaxNode } from '../../../parser/nodes';
import { extractQuotedStringToken, joinTokenStrings } from './helpers';

const refSettingValueValidator: {
  [index: string]: (value?: SyntaxNode | SyntaxToken[]) => boolean;
} = {
  delete: isValidPolicy,
  update: isValidPolicy,
};

export function getRefFieldSettingValueValidator(
  settingName: string,
): ((value?: SyntaxNode | SyntaxToken[]) => boolean) | undefined {
  return refSettingValueValidator[settingName];
}

export function allowDuplicateRefSetting(settingName: string): boolean {
  return false;
}

function isValidPolicy(value?: SyntaxNode | SyntaxToken[]): boolean {
  if (!Array.isArray(value) && !isQuotedStringNode(value)) {
    return false;
  }

  let extractedString: string | undefined;
  if (Array.isArray(value)) {
    extractedString = joinTokenStrings(value);
  } else {
    extractedString = extractQuotedStringToken(value);
  }

  if (extractedString) {
    switch (extractedString.toLowerCase()) {
      case 'cascade':
      case 'no action':
      case 'set null':
      case 'set default':
      case 'restrict':
        return true;
      default:
        return false;
    }
  }

  return false; // unreachable
}
