import {
  ElementKind,
  createContextValidatorConfig,
  createSettingsValidatorConfig,
  createSubFieldValidatorConfig,
} from '../types';
import { CompileError, CompileErrorCode } from '../../../errors';
import {
  CallExpressionNode,
  ElementDeclarationNode,
  PrimaryExpressionNode,
  SyntaxNode,
} from '../../../parser/nodes';
import { isAccessExpression, isPrimaryVariableNode, isQuotedStringNode } from '../../../utils';
import { SchemaSymbol, TableEntry } from '../../symbol/symbolTable';
import { destructureComplexVariable } from '../../utils';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator from './elementValidator';
import {
 isUnaryRelationship, isValidColor, isValidDefaultValue, isVoid,
} from '../utils';
import {
  registerNameConfig,
  optionalAliasConfig,
  complexBodyConfig,
  noUniqueConfig,
} from './_preset_configs';

export default class TableValidator extends ElementValidator {
  protected elementKind: ElementKind = ElementKind.TABLE;

  protected context = createContextValidatorConfig({
    name: ValidatorContext.TableContext,
    errorCode: CompileErrorCode.INVALID_TABLE_CONTEXT,
    stopOnError: false,
  });

  protected unique = noUniqueConfig(false);

  protected name = registerNameConfig(false);

  protected alias = optionalAliasConfig(false);

  protected settings = createSettingsValidatorConfig(
    {
      headercolor: {
        allowDuplicate: false,
        isValid: isValidColor,
      },
      note: {
        allowDuplicate: false,
        isValid: isQuotedStringNode,
      },
    },
    {
      optional: true,
      notFoundErrorCode: undefined,
      allow: true,
      foundErrorCode: undefined,
      unknownErrorCode: CompileErrorCode.INVALID_TABLE_SETTING,
      duplicateErrorCode: CompileErrorCode.DUPLICATE_TABLE_SETTING,
      invalidErrorCode: CompileErrorCode.INVALID_TABLE_SETTING,
      stopOnError: false,
    },
  );

  protected body = complexBodyConfig(false);

  protected subfield = createSubFieldValidatorConfig({
    argValidators: [
      {
        validateArg: isPrimaryVariableNode,
        errorCode: CompileErrorCode.INVALID_COLUMN_NAME,
      },
      {
        validateArg: isValidColumnType,
        errorCode: CompileErrorCode.INVALID_COLUMN_TYPE,
      },
    ],
    invalidArgNumberErrorCode: CompileErrorCode.INVALID_COLUMN,
    setting: columnSettings(),
    shouldRegister: false,
    duplicateErrorCode: undefined,
  });

  protected elementSymbol?: TableEntry;

  constructor(
    declarationNode: ElementDeclarationNode,
    publicSchemaSymbol: SchemaSymbol,
    contextStack: ContextStack,
    errors: CompileError[],
    kindsGloballyFound: Set<ElementKind>,
    kindsLocallyFound: Set<ElementKind>,
  ) {
    super(
      declarationNode,
      publicSchemaSymbol,
      contextStack,
      errors,
      kindsGloballyFound,
      kindsLocallyFound,
    );
  }
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

const columnSettings = () =>
  createSettingsValidatorConfig(
    {
      note: {
        allowDuplicate: false,
        isValid: isQuotedStringNode,
      },
      ref: {
        allowDuplicate: true,
        isValid: isUnaryRelationship,
      },
      'primary key': {
        allowDuplicate: false,
        isValid: isVoid,
      },
      default: {
        allowDuplicate: false,
        isValid: isValidDefaultValue,
      },
      increment: {
        allowDuplicate: false,
        isValid: isVoid,
      },
      'not null': {
        allowDuplicate: false,
        isValid: isVoid,
      },
      null: {
        allowDuplicate: false,
        isValid: isVoid,
      },
      pk: {
        allowDuplicate: false,
        isValid: isVoid,
      },
      unique: {
        allowDuplicate: false,
        isValid: isVoid,
      },
    },
    {
      optional: true,
      notFoundErrorCode: undefined,
      allow: true,
      foundErrorCode: undefined,
      unknownErrorCode: CompileErrorCode.UNKNOWN_COLUMN_SETTING,
      duplicateErrorCode: CompileErrorCode.DUPLICATE_COLUMN_SETTING,
      invalidErrorCode: CompileErrorCode.INVALID_COLUMN_SETTING_VALUE,
      stopOnError: false,
    },
  );
