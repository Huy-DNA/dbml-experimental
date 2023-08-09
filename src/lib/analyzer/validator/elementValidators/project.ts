import { CompileError, CompileErrorCode } from '../../../errors';
import { ElementDeclarationNode } from '../../../parser/nodes';
import { isQuotedStringNode } from '../../../utils';
import { SchemaSymbolTable, TableEntry } from '../../symbol/symbolTable';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator, { ArgumentValidatorConfig, ElementKind } from './elementValidator';

export default class ProjectValidator extends ElementValidator {
  protected elementKind: ElementKind = ElementKind.PROJECT;

  protected associatedContext: ValidatorContext = ValidatorContext.ProjectContext;
  protected contextErrorCode: CompileErrorCode = CompileErrorCode.INVALID_PROJECT_CONTEXT;
  protected stopOnContextError: boolean = false;

  protected shouldBeUnique: boolean = true;
  protected nonuniqueErrorCode?: CompileErrorCode = CompileErrorCode.PROJECT_REDEFINED;
  protected stopOnUniqueError: boolean = true;

  protected allowNoName: boolean = true;
  protected noNameFoundErrorCode? = undefined;
  protected allowName: boolean = true;
  protected nameFoundErrorCode?: CompileErrorCode = undefined;
  protected allowComplexName: boolean = true;
  protected complexNameFoundErrorCode?: CompileErrorCode = undefined;
  protected stopOnNameError: boolean = true;
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

  protected allowSimpleBody: boolean = false;
  protected simpleBodyFoundErrorCode?: CompileErrorCode = CompileErrorCode.SIMPLE_PROJECT_BODY;
  protected allowComplexBody: boolean = true;
  protected complexBodyFoundErrorCode?: CompileErrorCode = undefined;
  protected stopOnBodyError: boolean = false;

  protected nonSettingsArgsValidators: ArgumentValidatorConfig[] = [];
  protected invalidNumberOfArgsErrorCode?: CompileErrorCode =
    CompileErrorCode.INVALID_PROJECT_FIELD;
  protected allowSubFieldSettings?: boolean = false;
  protected subFieldSettingsFoundErrorCode?: CompileErrorCode =
    CompileErrorCode.UNEXPECTED_SETTINGS;
  protected allowDuplicateForThisSubFieldSetting? = undefined;
  protected duplicateSubFieldSettingsErrorCode?: CompileErrorCode = undefined;
  protected allowValueForThisSubFieldSetting? = undefined;
  protected invalidSubFieldSettingValueErrorCode?: CompileErrorCode = undefined;

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
