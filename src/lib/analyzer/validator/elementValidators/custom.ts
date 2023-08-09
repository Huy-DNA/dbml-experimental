import { CompileError, CompileErrorCode } from '../../../errors';
import { ElementDeclarationNode } from '../../../parser/nodes';
import { isQuotedStringNode } from '../../../utils';
import { SchemaSymbolTable, TableEntry } from '../../symbol/symbolTable';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator, { ArgumentValidatorConfig, ElementKind } from './elementValidator';

export default class CustomValidator extends ElementValidator {
  protected elementKind: ElementKind = ElementKind.CUSTOM;

  protected associatedContext: ValidatorContext = ValidatorContext.CustomContext;
  protected contextErrorCode: CompileErrorCode = CompileErrorCode.INVALID_CUSTOM_CONTEXT;
  protected stopOnContextError: boolean = false;

  protected shouldBeUnique: boolean = false;
  protected nonuniqueErrorCode?: CompileErrorCode = undefined;
  protected stopOnUniqueError: boolean = false;

  protected allowNoName: boolean = true;
  protected noNameFoundErrorCode?: CompileErrorCode = undefined;
  protected allowName: boolean = false;
  protected nameFoundErrorCode?: CompileErrorCode = CompileErrorCode.UNEXPECTED_NAME;
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
  protected allowSettings: boolean = false;
  protected settingsFoundErrorCode?: CompileErrorCode = CompileErrorCode.UNEXPECTED_SETTINGS;
  protected stopOnSettingsError: boolean = false;
  protected allowDuplicateForThisSetting? = undefined;
  protected duplicateSettingsErrorCode? = undefined;
  protected allowValueForThisSetting? = undefined;
  protected invalidSettingValueErrorCode? = undefined;

  protected allowSimpleBody: boolean = true;
  protected simpleBodyFoundErrorCode?: CompileErrorCode = undefined;
  protected allowComplexBody: boolean = false;
  protected complexBodyFoundErrorCode?: CompileErrorCode = CompileErrorCode.COMPLEX_CUSTOM_BODY;
  protected stopOnBodyError: boolean = false;

  protected nonSettingsArgsValidators: ArgumentValidatorConfig[] = [
    {
      validateArg: isQuotedStringNode,
      errorCode: CompileErrorCode.INVALID_CUSTOM_ELEMENT_VALUE,
    },
  ];
  protected invalidNumberOfArgsErrorCode?: CompileErrorCode =
    CompileErrorCode.INVALID_CUSTOM_ELEMENT_VALUE;
  protected allowSubFieldSettings?: boolean = false;
  protected subFieldSettingsFoundErrorCode?: CompileErrorCode =
    CompileErrorCode.UNEXPECTED_SETTINGS;
  protected allowDuplicateForThisSubFieldSetting? = undefined;
  protected duplicateSubFieldSettingsErrorCode?: CompileErrorCode = undefined;
  protected allowValueForThisSubFieldSetting? = undefined;
  protected invalidSubFieldSettingValueErrorCode?: CompileErrorCode = undefined;

  protected shouldRegisterSubField: boolean = true;
  protected duplicateSubFieldNameErrorCode?: CompileErrorCode =
    CompileErrorCode.DUPLICATE_TABLEGROUP_ELEMENT_NAME;

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
