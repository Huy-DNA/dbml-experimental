import { UnresolvedName } from 'lib/analyzer/types';
import { ElementKind, createContextValidatorConfig, createSubFieldValidatorConfig } from '../types';
import { CompileError, CompileErrorCode } from '../../../errors';
import { ElementDeclarationNode } from '../../../parser/nodes';
import { isQuotedStringNode } from '../../../utils';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator from './elementValidator';
import {
  noAliasConfig,
  noNameConfig,
  noSettingsConfig,
  noUniqueConfig,
  simpleBodyConfig,
} from './_preset_configs';
import { SchemaSymbol } from '../../symbol/symbols';

export default class CustomValidator extends ElementValidator {
  protected elementKind: ElementKind = ElementKind.CUSTOM;

  protected context = createContextValidatorConfig({
    name: ValidatorContext.CustomContext,
    errorCode: CompileErrorCode.INVALID_CUSTOM_CONTEXT,
    stopOnError: false,
  });

  protected unique = noUniqueConfig(false);

  protected name = noNameConfig(false);

  protected alias = noAliasConfig(false);

  protected settings = noSettingsConfig(false);

  protected body = simpleBodyConfig(false);

  protected subfield = createSubFieldValidatorConfig({
    argValidators: [
      {
        validateArg: isQuotedStringNode,
        errorCode: CompileErrorCode.INVALID_CUSTOM_ELEMENT_VALUE,
      },
    ],
    invalidArgNumberErrorCode: CompileErrorCode.INVALID_CUSTOM_ELEMENT_VALUE,
    setting: noSettingsConfig(false),
    shouldRegister: false,
    duplicateErrorCode: undefined,
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
