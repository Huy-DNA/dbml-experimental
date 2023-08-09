import { CompileError, CompileErrorCode } from '../../../errors';
import { SyntaxToken } from '../../../lexer/tokens';
import { ElementDeclarationNode, SyntaxNode } from '../../../parser/nodes';
import { isQuotedStringNode } from '../../../utils';
import { SchemaSymbolTable, TableEntry } from '../../symbol/symbolTable';
import { extractQuotedStringToken, isBinaryRelationship, joinTokenStrings } from '../../utils';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator, { ArgumentValidatorConfig, ElementKind } from './elementValidator';

export default class RefValidator extends ElementValidator {
  protected elementKind: ElementKind = ElementKind.REF;

  protected associatedContext: ValidatorContext = ValidatorContext.RefContext;
  protected contextErrorCode: CompileErrorCode = CompileErrorCode.INVALID_REF_CONTEXT;
  protected stopOnContextError: boolean = false;

  protected shouldBeUnique: boolean = false;
  protected nonuniqueErrorCode?: CompileErrorCode = undefined;
  protected stopOnUniqueError: boolean = false;

  protected allowNoName: boolean = true;
  protected noNameFoundErrorCode?: CompileErrorCode = undefined;
  protected allowName: boolean = true;
  protected nameFoundErrorCode?: CompileErrorCode = undefined;
  protected allowComplexName: boolean = true;
  protected complexNameFoundErrorCode?: CompileErrorCode = undefined;
  protected stopOnNameError: boolean = false;
  protected shouldRegisterName: boolean = false;
  protected duplicateNameFoundErrorCode?: CompileErrorCode = undefined;

  protected allowNoAlias: boolean = true;
  protected noAliasFoundErrorCode?: CompileErrorCode = undefined;
  protected allowAlias: boolean = false;
  protected aliasFoundErrorCode?: CompileErrorCode = CompileErrorCode.UNEXPECTED_ALIAS;
  protected stopOnAliasError: boolean = false;

  protected allowNoSettings: boolean = true;
  protected noSettingsFoundErrorCode?: CompileErrorCode = undefined;
  protected allowSettings: boolean = true;
  protected settingsFoundErrorCode?: CompileErrorCode = undefined;
  protected stopOnSettingsError: boolean = false;
  protected allowDuplicateForThisSetting? = allowDuplicateForThisRefSetting;
  protected duplicateSettingsErrorCode? = CompileErrorCode.DUPLICATE_REF_SETTING;
  protected allowValueForThisSetting? = allowValueForThisRefSetting;
  protected invalidSettingValueErrorCode? = CompileErrorCode.INVALID_REF_SETTING_VALUE;

  protected allowSimpleBody: boolean = true;
  protected simpleBodyFoundErrorCode?: CompileErrorCode = undefined;
  protected allowComplexBody: boolean = true;
  protected complexBodyFoundErrorCode?: CompileErrorCode = undefined;
  protected stopOnBodyError: boolean = false;

  protected nonSettingsArgsValidators: ArgumentValidatorConfig[] = [
    {
      validateArg: isBinaryRelationship,
      errorCode: CompileErrorCode.INVALID_REF_RELATIONSHIP,
    },
  ];
  protected invalidNumberOfArgsErrorCode?: CompileErrorCode = CompileErrorCode.INVALID_REF_FIELD;
  protected allowSubFieldSettings?: boolean = true;
  protected subFieldSettingsFoundErrorCode?: CompileErrorCode = undefined;
  protected allowDuplicateForThisSubFieldSetting? = allowDuplicateForThisRefSetting;
  protected duplicateSubFieldSettingsErrorCode?: CompileErrorCode =
    CompileErrorCode.DUPLICATE_REF_SETTING;
  protected allowValueForThisSubFieldSetting? = allowValueForThisRefSetting;
  protected invalidSubFieldSettingValueErrorCode?: CompileErrorCode =
    CompileErrorCode.INVALID_REF_SETTING_VALUE;

  protected shouldRegisterSubField: boolean = false;
  protected duplicateSubFieldNameErrorCode?: CompileErrorCode = undefined;
  protected elementEntry?: TableEntry;

  constructor(
    declarationNode: ElementDeclarationNode,
    globalSchema: SchemaSymbolTable,
    contextStack: ContextStack,
    errors: CompileError[],
    uniqueKindsFound: Set<ElementKind>,
  ) {
    super(declarationNode, globalSchema, contextStack, errors, uniqueKindsFound);
  }
}

const refSettingValueValidator: {
  [index: string]: (value?: SyntaxNode | SyntaxToken[]) => boolean;
} = {
  delete: isValidPolicy,
  update: isValidPolicy,
};

export function allowValueForThisRefSetting(
  settingName: string,
  value?: SyntaxNode | SyntaxToken[],
): boolean {
  return refSettingValueValidator[settingName]?.call(undefined, value);
}

export function allowDuplicateForThisRefSetting(settingName: string): boolean {
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
