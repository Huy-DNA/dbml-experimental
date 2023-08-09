import { CompileError, CompileErrorCode } from '../../../errors';
import { SyntaxToken } from '../../../lexer/tokens';
import {
  CallExpressionNode,
  ElementDeclarationNode,
  PrimaryExpressionNode,
  SyntaxNode,
} from '../../../parser/nodes';
import { isAccessExpression, isPrimaryVariableNode, isQuotedStringNode } from '../../../utils';
import { SchemaSymbolTable, TableEntry } from '../../symbol/symbolTable';
import { destructureComplexVariable } from '../../utils';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator, { ArgumentValidatorConfig, ElementKind } from './elementValidator';
import {
 isUnaryRelationship, isValidColor, isValidDefaultValue, isVoid,
} from './utils';

export default class TableValidator extends ElementValidator {
  protected elementKind: ElementKind = ElementKind.TABLE;

  protected associatedContext: ValidatorContext = ValidatorContext.TableContext;
  protected contextErrorCode: CompileErrorCode = CompileErrorCode.INVALID_TABLE_CONTEXT;
  protected stopOnContextError: boolean = true;

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
  protected allowAlias: boolean = true;
  protected aliasFoundErrorCode?: CompileErrorCode = undefined;
  protected stopOnAliasError: boolean = false;

  protected allowNoSettings: boolean = true;
  protected noSettingsFoundErrorCode?: CompileErrorCode = undefined;
  protected allowSettings: boolean = true;
  protected settingsFoundErrorCode?: CompileErrorCode = undefined;
  protected stopOnSettingsError: boolean = false;
  protected allowDuplicateForThisSetting = allowDuplicateForThisTableSetting;
  protected duplicateSettingsErrorCode?: CompileErrorCode =
    CompileErrorCode.DUPLICATE_TABLE_SETTING;
  protected allowValueForThisSetting = allowValueForThisTableSetting;
  protected invalidSettingValueErrorCode?: CompileErrorCode =
    CompileErrorCode.INVALID_TABLE_SETTING;

  protected allowSimpleBody: boolean = false;
  protected simpleBodyFoundErrorCode?: CompileErrorCode = CompileErrorCode.SIMPLE_TABLE_BODY;
  protected allowComplexBody: boolean = true;
  protected complexBodyFoundErrorCode?: CompileErrorCode = undefined;
  protected stopOnBodyError: boolean = false;

  protected nonSettingsArgsValidators: ArgumentValidatorConfig[] = [
    { validateArg: isPrimaryVariableNode, errorCode: CompileErrorCode.INVALID_COLUMN_NAME },
    { validateArg: isValidColumnType, errorCode: CompileErrorCode.INVALID_COLUMN_TYPE },
  ];
  protected invalidNumberOfArgsErrorCode?: CompileErrorCode = CompileErrorCode.INVALID_COLUMN;
  protected allowSubFieldSettings?: boolean = true;
  protected subFieldSettingsFoundErrorCode?: CompileErrorCode = undefined;
  protected allowDuplicateForThisSubFieldSetting? = allowDuplicateForThisColumnSetting;
  protected duplicateSubFieldSettingsErrorCode?: CompileErrorCode =
    CompileErrorCode.DUPLICATE_COLUMN_SETTINGS;
  protected allowValueForThisSubFieldSetting? = allowValueForThisColumnSetting;
  protected invalidSubFieldSettingValueErrorCode?: CompileErrorCode =
    CompileErrorCode.INVALID_COLUMN_SETTING;
  protected shouldRegisterSubField: boolean = true;
  protected duplicateSubFieldNameErrorCode?: CompileErrorCode =
    CompileErrorCode.DUPLICATE_COLUMN_NAME;

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

const tableSettingValueValidator: {
  [index: string]: (value?: SyntaxNode | SyntaxToken[]) => boolean;
} = {
  note: isQuotedStringNode,
  headercolor: isValidColor,
};

function allowValueForThisTableSetting(
  settingName: string,
  value?: SyntaxToken[] | SyntaxNode,
): boolean {
  return tableSettingValueValidator[settingName]?.call(undefined, value);
}

function allowDuplicateForThisTableSetting(settingName: string): boolean {
  return false;
}

function isValidColumnType(type: SyntaxNode): boolean {
  if (
    !(
      type instanceof CallExpressionNode ||
      isAccessExpression(type) ||
      type instanceof PrimaryExpressionNode
    )
  ) {
    return false;
  }

  while (type instanceof CallExpressionNode) {
    // eslint-disable-next-line no-param-reassign
    type = type.callee;
  }

  const variables = destructureComplexVariable(type).unwrap_or(undefined);

  return variables !== undefined && variables.length > 0;
}

export function allowDuplicateForThisColumnSetting(settingName: string): boolean {
  // eslint-disable-next-line
  const _settingName = settingName.toLowerCase();

  return _settingName === 'ref';
}

const columnSettingValueValidator: {
  [index: string]: (value?: SyntaxNode | SyntaxToken[]) => boolean;
} = {
  note: isQuotedStringNode,
  ref: isUnaryRelationship,
  'primary key': isVoid,
  default: isValidDefaultValue,
  increment: isVoid,
  'not null': isVoid,
  null: isVoid,
  pk: isVoid,
  unique: isVoid,
};

function allowValueForThisColumnSetting(
  settingName: string,
  value?: SyntaxNode | SyntaxToken[],
): boolean {
  return columnSettingValueValidator[settingName]?.call(undefined, value);
}
