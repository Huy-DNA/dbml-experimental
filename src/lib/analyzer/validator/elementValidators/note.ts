import { CompileError, CompileErrorCode } from '../../../errors';
import { ElementDeclarationNode } from '../../../parser/nodes';
import { isQuotedStringNode } from '../../../utils';
import { SchemaSymbolTable, TableEntry } from '../../symbol/symbolTable';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator, { ArgumentValidatorConfig, ElementKind } from './elementValidator';

export default class NoteValidator extends ElementValidator {
  protected elementKind: ElementKind = ElementKind.NOTE;

  protected associatedContext: ValidatorContext = ValidatorContext.NoteContext;
  protected contextErrorCode: CompileErrorCode = CompileErrorCode.INVALID_NOTE_CONTEXT;
  protected stopOnContextError: boolean = false;

  protected shouldBeUnique: boolean = false;
  protected nonuniqueErrorCode?: CompileErrorCode = undefined;
  protected stopOnUniqueError: boolean = false;

  protected allowNoName: boolean = true;
  protected noNameFoundErrorCode?: CompileErrorCode = undefined;
  protected allowName: boolean = false;
  protected nameFoundErrorCode?: CompileErrorCode = CompileErrorCode.UNEXPECTED_NAME;
  protected allowComplexName: boolean = false;
  protected complexNameFoundErrorCode?: CompileErrorCode = CompileErrorCode.UNEXPECTED_NAME;
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
  protected allowComplexBody: boolean = true;
  protected complexBodyFoundErrorCode?: CompileErrorCode = undefined;
  protected stopOnBodyError: boolean = false;

  protected nonSettingsArgsValidators: ArgumentValidatorConfig[] = [
    {
      validateArg: isQuotedStringNode,
      errorCode: CompileErrorCode.INVALID_NOTE,
    },
  ];
  protected invalidNumberOfArgsErrorCode?: CompileErrorCode = CompileErrorCode.INVALID_NOTE;
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
