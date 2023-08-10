import { CompileError, CompileErrorCode } from '../../../errors';
import { ElementDeclarationNode } from '../../../parser/nodes';
import { isPrimaryVariableNode } from '../../../utils';
import { SchemaSymbolTable, TableEntry } from '../../symbol/symbolTable';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator from './elementValidator';
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

export default class TableGroupValidator extends ElementValidator {
  protected elementKind: ElementKind = ElementKind.TABLEGROUP;

  protected context = createContextValidatorConfig({
    name: ValidatorContext.TableGroupContext,
    errorCode: CompileErrorCode.INVALID_TABLEGROUP_CONTEXT,
    stopOnError: false,
  });

  protected unique = createUniqueValidatorConfig({
    mandatory: false,
    errorCode: undefined,
    stopOnError: false,
  });

  protected name = createNameValidatorConfig({
    optional: false,
    notFoundErrorCode: CompileErrorCode.NAME_NOT_FOUND,
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
    simpleErrorCode: CompileErrorCode.SIMPLE_TABLEGROUP_BODY,
    allowComplex: true,
    complexErrorCode: undefined,
    stopOnError: false,
  });

  protected subfield = createSubFieldValidatorConfig({
    argValidators: [
      {
        validateArg: isPrimaryVariableNode,
        errorCode: CompileErrorCode.INVALID_TABLEGROUP_ELEMENT_NAME,
      },
    ],
    invalidArgNumberErrorCode: CompileErrorCode.INVALID_TABLEGROUP_FIELD,
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
