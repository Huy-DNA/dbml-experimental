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
import ElementValidator from './elementValidator';
import { isVoid } from '../utils';

export default class IndexesValidator extends ElementValidator {
  protected elementKind: ElementKind = ElementKind.INDEXES;

  protected context = createContextValidatorConfig({
    name: ValidatorContext.IndexesContext,
    errorCode: CompileErrorCode.INVALID_INDEXES_CONTEXT,
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
    allow: false,
    foundErrorCode: CompileErrorCode.UNEXPECTED_NAME,
    allowComplex: false,
    complexErrorCode: CompileErrorCode.UNEXPECTED_NAME,
    shouldRegister: false,
    duplicateErrorCode: undefined,
    stopOnError: false,
  });

  protected alias = createAliasValidatorConfig({
    optional: true,
    notFoundErrorCode: undefined,
    allow: false,
    foundErrorCode: CompileErrorCode.UNEXPECTED_ALIAS,
    stopOnError: false,
  });

  protected settings = createSettingsValidatorConfig(
    {},
    {
      optional: true,
      notFoundErrorCode: undefined,
      allow: false,
      foundErrorCode: CompileErrorCode.UNEXPECTED_SETTINGS,
      unknownErrorCode: undefined,
      duplicateErrorCode: undefined,
      invalidErrorCode: undefined,
      stopOnError: false,
    },
  );

  protected body = createBodyValidatorConfig({
    allowSimple: false,
    simpleErrorCode: CompileErrorCode.SIMPLE_INDEXES_BODY,
    allowComplex: true,
    complexErrorCode: undefined,
    stopOnError: false,
  });

  protected subfield = createSubFieldValidatorConfig({
    argValidators: [
      {
        validateArg: (node) => destructureIndex(node).unwrap_or(undefined) !== undefined,
        errorCode: CompileErrorCode.INVALID_INDEX,
      },
    ],
    invalidArgNumberErrorCode: CompileErrorCode.INVALID_INDEX,
    setting: createSettingsValidatorConfig(
      {
        note: {
          allowDuplicate: false,
          isValid: isQuotedStringNode,
        },
        name: {
          allowDuplicate: false,
          isValid: isQuotedStringNode,
        },
        type: {
          allowDuplicate: false,
          isValid: isValidIndexesType,
        },
        unique: {
          allowDuplicate: false,
          isValid: isVoid,
        },
        pk: {
          allowDuplicate: false,
          isValid: isVoid,
        },
      },
      {
        optional: true,
        notFoundErrorCode: undefined,
        allow: true,
        foundErrorCode: undefined,
        unknownErrorCode: CompileErrorCode.UNKNOWN_INDEX_SETTING,
        duplicateErrorCode: CompileErrorCode.DUPLICATE_INDEX_SETTING,
        invalidErrorCode: CompileErrorCode.INVALID_INDEX_SETTING_VALUE,
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

export function isValidIndexesType(value?: SyntaxNode | SyntaxToken[]): boolean {
  if (!(value instanceof PrimaryExpressionNode) || !(value.expression instanceof VariableNode)) {
    return false;
  }

  const str = value.expression.variable.value;

  return str === 'btree' || str === 'hash';
}
