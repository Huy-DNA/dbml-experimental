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
import { SchemaSymbolTable, TableEntry } from '../../symbol/symbolTable';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator from './elementValidator';

export default class ProjectValidator extends ElementValidator {
  protected elementKind: ElementKind = ElementKind.PROJECT;

  protected context = createContextValidatorConfig({
    name: ValidatorContext.ProjectContext,
    errorCode: CompileErrorCode.INVALID_PROJECT_CONTEXT,
    stopOnError: false,
  });

  protected unique = createUniqueValidatorConfig({
    mandatory: true,
    errorCode: CompileErrorCode.PROJECT_REDEFINED,
    stopOnError: false,
  });

  protected name = createNameValidatorConfig({
    optional: true,
    notFoundErrorCode: undefined,
    allow: true,
    foundErrorCode: undefined,
    allowComplex: true,
    complexErrorCode: undefined,
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
    simpleErrorCode: CompileErrorCode.SIMPLE_PROJECT_BODY,
    allowComplex: true,
    complexErrorCode: undefined,
    stopOnError: false,
  });

  protected subfield = createSubFieldValidatorConfig({
    argValidators: [],
    invalidArgNumberErrorCode: CompileErrorCode.INVALID_PROJECT_FIELD,
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
