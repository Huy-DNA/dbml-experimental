import {
  ElementKind,
  createContextValidatorConfig,
  createSettingsValidatorConfig,
  createSubFieldValidatorConfig,
} from '../types';
import { CompileError, CompileErrorCode } from '../../../errors';
import { ElementDeclarationNode } from '../../../parser/nodes';
import { isPrimaryVariableNode, isQuotedStringNode } from '../../../utils';
import { SchemaSymbolTable, TableEntry } from '../../symbol/symbolTable';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator from './elementValidator';
import {
  complexBodyConfig,
  noAliasConfig,
  noSettingsConfig,
  noUniqueConfig,
  registerNameConfig,
} from './_preset_configs';

export default class EnumValidator extends ElementValidator {
  protected elementKind: ElementKind = ElementKind.ENUM;

  protected context = createContextValidatorConfig({
    name: ValidatorContext.EnumContext,
    errorCode: CompileErrorCode.INVALID_ENUM_CONTEXT,
    stopOnError: false,
  });

  protected unique = noUniqueConfig(false);

  protected name = registerNameConfig(false);

  protected alias = noAliasConfig(false);

  protected settings = noSettingsConfig(false);

  protected body = complexBodyConfig(false);

  protected subfield = createSubFieldValidatorConfig({
    argValidators: [
      {
        validateArg: isPrimaryVariableNode,
        errorCode: CompileErrorCode.INVALID_ENUM_ELEMENT_NAME,
      },
    ],
    invalidArgNumberErrorCode: CompileErrorCode.INVALID_ENUM_ELEMENT,
    setting: enumFieldSettings(),
    shouldRegister: true,
    duplicateErrorCode: CompileErrorCode.DUPLICATE_ENUM_ELEMENT_NAME,
  });

  protected elementEntry?: TableEntry;

  constructor(
    declarationNode: ElementDeclarationNode,
    globalSchema: SchemaSymbolTable,
    contextStack: ContextStack,
    errors: CompileError[],
    kindsGloballyFound: Set<ElementKind>,
    kindsLocallyFound: Set<ElementKind>,
  ) {
    super(
      declarationNode,
      globalSchema,
      contextStack,
      errors,
      kindsGloballyFound,
      kindsLocallyFound,
    );
  }
}

const enumFieldSettings = () =>
  createSettingsValidatorConfig(
    {
      note: {
        allowDuplicate: true,
        isValid: isQuotedStringNode,
      },
    },
    {
      optional: true,
      notFoundErrorCode: undefined,
      allow: true,
      foundErrorCode: undefined,
      unknownErrorCode: CompileErrorCode.UNKNOWN_ENUM_ELEMENT_SETTING,
      duplicateErrorCode: CompileErrorCode.DUPLICATE_ENUM_ELEMENT_SETTING,
      invalidErrorCode: CompileErrorCode.INVALID_ENUM_ELEMENT_SETTING,
      stopOnError: false,
    },
  );
