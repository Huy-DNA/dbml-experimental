import { UnresolvedName } from 'lib/analyzer/types';
import {
  ElementKind,
  createContextValidatorConfig,
  createSettingsValidatorConfig,
  createSubFieldValidatorConfig,
} from '../types';
import { CompileError, CompileErrorCode } from '../../../errors';
import { ElementDeclarationNode } from '../../../parser/nodes';
import { isExpressionAVariableNode, isExpressionAQuotedString } from '../../../utils';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator from './elementValidator';
import {
  complexBodyConfig,
  noAliasConfig,
  noSettingsConfig,
  noUniqueConfig,
  registerNameConfig,
} from './_preset_configs';
import { SchemaSymbol } from '../../symbol/symbols';

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
        validateArg: isExpressionAVariableNode,
        errorCode: CompileErrorCode.INVALID_ENUM_ELEMENT_NAME,
      },
    ],
    invalidArgNumberErrorCode: CompileErrorCode.INVALID_ENUM_ELEMENT,
    setting: enumFieldSettings(),
    shouldRegister: true,
    duplicateErrorCode: CompileErrorCode.DUPLICATE_ENUM_ELEMENT_NAME,
  });

  constructor(
    declarationNode: ElementDeclarationNode,
    publicSchemaSymbol: SchemaSymbol,
    contextStack: ContextStack,
    unresolvedNames: UnresolvedName[],
    errors: CompileError[],
    kindsGloballyFound: Set<ElementKind>,
    kindsLocallyFound: Set<ElementKind>,
  ) {
    super(
      declarationNode,
      publicSchemaSymbol,
      contextStack,
      unresolvedNames,
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
        isValid: isExpressionAQuotedString,
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
