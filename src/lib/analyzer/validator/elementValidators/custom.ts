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
import { ElementDeclarationNode } from '../../../parser/nodes';
import { isQuotedStringNode } from '../../../utils';
import { SchemaSymbolTable, TableEntry } from '../../symbol/symbolTable';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator from './elementValidator';

export default class CustomValidator extends ElementValidator {
  protected elementKind: ElementKind = ElementKind.CUSTOM;

  protected context = createContextValidatorConfig({
    name: ValidatorContext.CustomContext,
    errorCode: CompileErrorCode.INVALID_CUSTOM_CONTEXT,
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
    allowSimple: true,
    simpleErrorCode: undefined,
    allowComplex: false,
    complexErrorCode: CompileErrorCode.COMPLEX_CUSTOM_BODY,
    stopOnError: false,
  });

  protected subfield = createSubFieldValidatorConfig({
    argValidators: [
      {
        validateArg: isQuotedStringNode,
        errorCode: CompileErrorCode.INVALID_CUSTOM_ELEMENT_VALUE,
      },
    ],
    invalidArgNumberErrorCode: CompileErrorCode.INVALID_CUSTOM_ELEMENT_VALUE,
    setting: createSettingsValidatorConfig(
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
