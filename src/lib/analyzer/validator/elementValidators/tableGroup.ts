import { CompileError, CompileErrorCode } from '../../../errors';
import { ElementDeclarationNode } from '../../../parser/nodes';
import { isPrimaryVariableNode } from '../../../utils';
import { SchemaSymbolTable, TableEntry } from '../../symbol/symbolTable';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator, { ArgumentValidatorConfig, ElementKind } from './elementValidator';

export default class TableGroupValidator extends ElementValidator {
  protected elementKind: ElementKind = ElementKind.TABLEGROUP;

  protected associatedContext: ValidatorContext = ValidatorContext.TableGroupContext;
  protected contextErrorCode: CompileErrorCode = CompileErrorCode.INVALID_TABLEGROUP_CONTEXT;
  protected stopOnContextError: boolean = false;

  protected shouldBeUnique: boolean = false;
  protected nonuniqueErrorCode?: CompileErrorCode = undefined;
  protected stopOnUniqueError: boolean = false;

  protected allowNoName: boolean = false;
  protected noNameFoundErrorCode?: CompileErrorCode.NAME_NOT_FOUND;
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
  protected simpleBodyFoundErrorCode?: CompileErrorCode = CompileErrorCode.SIMPLE_TABLEGROUP_BODY;
  protected allowComplexBody: boolean = true;
  protected complexBodyFoundErrorCode?: CompileErrorCode = undefined;
  protected stopOnBodyError: boolean = false;

  protected nonSettingsArgsValidators: ArgumentValidatorConfig[] = [
    {
      validateArg: isPrimaryVariableNode,
      errorCode: CompileErrorCode.INVALID_TABLEGROUP_ELEMENT_NAME,
    },
  ];
  protected invalidNumberOfArgsErrorCode?: CompileErrorCode =
    CompileErrorCode.INVALID_TABLEGROUP_FIELD;
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
