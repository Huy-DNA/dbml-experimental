import { CompileError, CompileErrorCode } from '../../../errors';
import { SyntaxToken } from '../../../lexer/tokens';
import {
  ElementDeclarationNode,
  PrimaryExpressionNode,
  SyntaxNode,
  VariableNode,
} from '../../../parser/nodes';
import { isQuotedStringNode } from '../../../utils';
import { SchemaSymbolTable, TableEntry } from '../../symbol/symbolTable';
import { destructureIndex } from '../../utils';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator, { ArgumentValidatorConfig, ElementKind } from './elementValidator';
import { isVoid } from './utils';

export default class IndexesValidator extends ElementValidator {
  protected elementKind: ElementKind = ElementKind.INDEXES;

  protected associatedContext: ValidatorContext = ValidatorContext.IndexesContext;
  protected contextErrorCode: CompileErrorCode = CompileErrorCode.INVALID_INDEXES_CONTEXT;
  protected stopOnContextError: boolean = true;

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

  protected allowSimpleBody: boolean = false;
  protected simpleBodyFoundErrorCode?: CompileErrorCode = CompileErrorCode.SIMPLE_INDEXES_BODY;
  protected allowComplexBody: boolean = true;
  protected complexBodyFoundErrorCode?: CompileErrorCode = undefined;
  protected stopOnBodyError: boolean = true;

  protected nonSettingsArgsValidators: ArgumentValidatorConfig[] = [
    {
      validateArg: (node) => destructureIndex(node).unwrap_or(undefined) !== undefined,
      errorCode: CompileErrorCode.INVALID_INDEX,
    },
  ];
  protected invalidNumberOfArgsErrorCode?: CompileErrorCode =
    CompileErrorCode.INVALID_INDEXES_FIELD;
  protected allowSubFieldSettings?: boolean = true;
  protected subFieldSettingsFoundErrorCode?: CompileErrorCode = undefined;
  protected allowDuplicateForThisSubFieldSetting? = allowDuplicateForThisIndexSetting;
  protected duplicateSubFieldSettingsErrorCode?: CompileErrorCode =
    CompileErrorCode.DUPLICATE_INDEX_SETTING;
  protected allowValueForThisSubFieldSetting? = allowValueForThisIndexSetting;
  protected invalidSubFieldSettingValueErrorCode?: CompileErrorCode =
    CompileErrorCode.UNEXPECTED_INDEX_SETTING_VALUE;

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

export function allowValueForThisIndexSetting(
  settingName: string,
  value?: SyntaxNode | SyntaxToken[],
): boolean {
  return !!{
    note: isQuotedStringNode,
    name: isQuotedStringNode,
    type: isValidIndexesType,
    unique: isVoid,
    pk: isVoid,
  }[settingName]?.call(undefined, value);
}

export function allowDuplicateForThisIndexSetting(settingName: string): boolean {
  return false;
}

function isValidIndexesType(value?: SyntaxNode | SyntaxToken[]): boolean {
  if (value instanceof PrimaryExpressionNode && value.expression instanceof VariableNode) {
    const type = value.expression.variable.value;

    return type === 'btree' || type === 'hash';
  }

  return false;
}
