import {
  ElementKind,
  createAliasValidatorConfig,
  createBodyValidatorConfig,
  createContextValidatorConfig,
  createNameValidatorConfig,
  createSettingsValidatorConfig,
  createSubFieldValidatorConfig,
  createUniqueValidatorConfig,
} from '../types';
import { CompileError, CompileErrorCode } from '../../../errors';
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
import ElementValidator from './elementValidator';
import {
 isUnaryRelationship, isValidColor, isValidDefaultValue, isVoid,
} from '../utils';

export default class TableValidator extends ElementValidator {
  protected elementKind: ElementKind = ElementKind.TABLE;

  protected context = createContextValidatorConfig({
    name: ValidatorContext.TableContext,
    errorCode: CompileErrorCode.INVALID_TABLE_CONTEXT,
    stopOnError: false,
  });

  protected unique = createUniqueValidatorConfig({
    mandatory: false,
    errorCode: undefined,
    stopOnError: false,
  });

  protected name = createNameValidatorConfig({
    optional: true,
    notFoundErrorCode: undefined,
    allow: true,
    foundErrorCode: undefined,
    allowComplex: true,
    complexErrorCode: undefined,
    shouldRegister: true,
    duplicateErrorCode: CompileErrorCode.DUPLICATE_NAME,
    stopOnError: false,
  });

  protected alias = createAliasValidatorConfig({
    optional: true,
    notFoundErrorCode: undefined,
    allow: true,
    foundErrorCode: undefined,
    stopOnError: false,
  });

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

  protected body = createBodyValidatorConfig({
    allowSimple: false,
    simpleErrorCode: CompileErrorCode.SIMPLE_TABLE_BODY,
    allowComplex: true,
    complexErrorCode: undefined,
    stopOnError: false,
  });

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
    setting: createSettingsValidatorConfig(
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
    ),
    shouldRegister: false,
    duplicateErrorCode: undefined,
  });

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
