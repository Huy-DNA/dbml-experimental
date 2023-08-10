import {
  ElementKind,
  createContextValidatorConfig,
  createSubFieldValidatorConfig,
  createUniqueValidatorConfig,
} from '../types';
import { CompileError, CompileErrorCode } from '../../../errors';
import { ElementDeclarationNode } from '../../../parser/nodes';
import { SchemaSymbolTable, TableEntry } from '../../symbol/symbolTable';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator from './elementValidator';
import {
  complexBodyConfig,
  noAliasConfig,
  noSettingsConfig,
  optionalNameConfig,
} from './_preset_configs';

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

  protected name = optionalNameConfig(false);

  protected alias = noAliasConfig(false);

  protected settings = noSettingsConfig(false);

  protected body = complexBodyConfig(false);

  protected subfield = createSubFieldValidatorConfig({
    argValidators: [],
    invalidArgNumberErrorCode: CompileErrorCode.INVALID_PROJECT_FIELD,
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
    uniqueKindsFound: Set<ElementKind>,
  ) {
    super(declarationNode, globalSchema, contextStack, errors, uniqueKindsFound);
  }
}
