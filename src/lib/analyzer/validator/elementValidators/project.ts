import { UnresolvedName } from 'lib/analyzer/types';
import { ElementKind, createContextValidatorConfig, createSubFieldValidatorConfig } from '../types';
import { CompileError, CompileErrorCode } from '../../../errors';
import { ElementDeclarationNode } from '../../../parser/nodes';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator from './elementValidator';
import {
  complexBodyConfig,
  globallyUniqueConfig,
  noAliasConfig,
  noSettingListConfig,
  optionalNameConfig,
} from './_preset_configs';
import { SchemaSymbol } from '../../symbol/symbols';

export default class ProjectValidator extends ElementValidator {
  protected elementKind: ElementKind = ElementKind.PROJECT;

  protected context = createContextValidatorConfig({
    name: ValidatorContext.ProjectContext,
    errorCode: CompileErrorCode.INVALID_PROJECT_CONTEXT,
    stopOnError: false,
  });

  protected unique = globallyUniqueConfig(CompileErrorCode.PROJECT_REDEFINED, false);

  protected name = optionalNameConfig(false);

  protected alias = noAliasConfig(false);

  protected settingList = noSettingListConfig(false);

  protected body = complexBodyConfig(false);

  protected subfield = createSubFieldValidatorConfig({
    argValidators: [],
    invalidArgNumberErrorCode: CompileErrorCode.INVALID_PROJECT_FIELD,
    setting: noSettingListConfig(false),
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
