import { ElementKind, createContextValidatorConfig, createSubFieldValidatorConfig } from '../types';
import { CompileError, CompileErrorCode } from '../../../errors';
import { ElementDeclarationNode } from '../../../parser/nodes';
import { isQuotedStringNode } from '../../../utils';
import { SchemaSymbolTable, TableEntry } from '../../symbol/symbolTable';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator from './elementValidator';
import {
  noAliasConfig,
  noNameConfig,
  noSettingsConfig,
  noUniqueConfig,
  simpleBodyConfig,
} from './_preset_configs';

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
