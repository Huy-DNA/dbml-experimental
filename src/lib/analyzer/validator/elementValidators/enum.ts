import { CompileError, CompileErrorCode } from '../../../errors';
import { SyntaxToken } from '../../../lexer/tokens';
import { ElementDeclarationNode, SyntaxNode } from '../../../parser/nodes';
import { isPrimaryVariableNode, isQuotedStringNode } from '../../../utils';
import { SchemaSymbolTable, TableEntry } from '../../symbol/symbolTable';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator, { ArgumentValidatorConfig, ElementKind } from './elementValidator';

export default class EnumValidator extends ElementValidator {
  protected elementKind: ElementKind = ElementKind.ENUM;

  protected associatedContext: ValidatorContext = ValidatorContext.EnumContext;
  protected contextErrorCode: CompileErrorCode = CompileErrorCode.INVALID_ENUM_CONTEXT;
  protected stopOnContextError: boolean = false;

  protected shouldBeUnique: boolean = false;
  protected nonuniqueErrorCode?: CompileErrorCode = undefined;
  protected stopOnUniqueError: boolean = false;

  protected allowNoName: boolean = false;
  protected noNameFoundErrorCode?: CompileErrorCode = CompileErrorCode.NAME_NOT_FOUND;
  protected allowName: boolean = true;
  protected nameFoundErrorCode?: CompileErrorCode = undefined;
  protected allowComplexName: boolean = true;
  protected complexNameFoundErrorCode?: CompileErrorCode = undefined;
  protected stopOnNameError: boolean = true;
  protected shouldRegisterName: boolean = true;
  protected duplicateNameFoundErrorCode?: CompileErrorCode = CompileErrorCode.DUPLICATE_NAME;

  protected allowNoAlias: boolean = true;
  protected noAliasFoundErrorCode?: CompileErrorCode = undefined;
  protected allowAlias: boolean = false;
  protected aliasFoundErrorCode?: CompileErrorCode = CompileErrorCode.UNEXPECTED_ALIAS;
  protected stopOnAliasError: boolean = false;

  protected allowNoSettings: boolean = true;
  protected noSettingsFoundErrorCode?: CompileErrorCode = undefined;
  protected allowSettings: boolean = false;
  protected settingsFoundErrorCode?: CompileErrorCode = CompileErrorCode.UNEXPECTED_SETTINGS;
  protected stopOnSettingsError: boolean = false;
  protected allowDuplicateForThisSetting? = undefined;
  protected duplicateSettingsErrorCode? = undefined;
  protected allowValueForThisSetting? = undefined;
  protected invalidSettingValueErrorCode? = undefined;

  protected allowSimpleBody: boolean = false;
  protected simpleBodyFoundErrorCode?: CompileErrorCode = CompileErrorCode.SIMPLE_ENUM_BODY;
  protected allowComplexBody: boolean = true;
  protected complexBodyFoundErrorCode?: CompileErrorCode = undefined;
  protected stopOnBodyError: boolean = false;

  protected nonSettingsArgsValidators: ArgumentValidatorConfig[] = [
    { validateArg: isPrimaryVariableNode, errorCode: CompileErrorCode.INVALID_ENUM_ELEMENT_NAME },
  ];
  protected invalidNumberOfArgsErrorCode?: CompileErrorCode = CompileErrorCode.INVALID_ENUM_ELEMENT;
  protected allowSubFieldSettings?: boolean = true;
  protected subFieldSettingsFoundErrorCode?: CompileErrorCode = undefined;
  protected allowDuplicateForThisSubFieldSetting? = allowDuplicateForThisEnumElementSetting;
  protected duplicateSubFieldSettingsErrorCode?: CompileErrorCode =
    CompileErrorCode.DUPLICATE_ENUM_ELEMENT_SETTING;
  protected allowValueForThisSubFieldSetting? = allowValueForThisEnumElementSetting;
  protected invalidSubFieldSettingValueErrorCode?: CompileErrorCode =
    CompileErrorCode.INVALID_ENUM_ELEMENT_SETTING;

  protected shouldRegisterSubField: boolean = true;
  protected duplicateSubFieldNameErrorCode?: CompileErrorCode =
    CompileErrorCode.DUPLICATE_ENUM_ELEMENT_NAME;

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

export function allowValueForThisEnumElementSetting(
  settingName: string,
  value?: SyntaxNode | SyntaxToken[],
): boolean {
  return !!{
    note: isQuotedStringNode,
  }[settingName]?.call(undefined, value);
}

export function allowDuplicateForThisEnumElementSetting(settingName: string): boolean {
  return false;
}
