import { CompileError, CompileErrorCode } from '../../../errors';
import { ElementDeclarationNode } from '../../../parser/nodes';
import { isPrimaryVariableNode } from '../../../utils';
import { SchemaSymbol, TableEntry } from '../../symbol/symbolTable';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator from './elementValidator';
import { ElementKind, createContextValidatorConfig, createSubFieldValidatorConfig } from '../types';
import {
  complexBodyConfig,
  noAliasConfig,
  noSettingsConfig,
  noUniqueConfig,
  registerNameConfig,
} from './_preset_configs';

export default class TableGroupValidator extends ElementValidator {
  protected elementKind: ElementKind = ElementKind.TABLEGROUP;

  protected context = createContextValidatorConfig({
    name: ValidatorContext.TableGroupContext,
    errorCode: CompileErrorCode.INVALID_TABLEGROUP_CONTEXT,
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
        errorCode: CompileErrorCode.INVALID_TABLEGROUP_ELEMENT_NAME,
      },
    ],
    invalidArgNumberErrorCode: CompileErrorCode.INVALID_TABLEGROUP_FIELD,
    setting: noSettingsConfig(false),
    shouldRegister: false,
    duplicateErrorCode: undefined,
  });

  protected elementSymbol?: TableEntry;

  constructor(
    declarationNode: ElementDeclarationNode,
    publicSchemaSymbol: SchemaSymbol,
    contextStack: ContextStack,
    errors: CompileError[],
    kindsGloballyFound: Set<ElementKind>,
    kindsLocallyFound: Set<ElementKind>,
  ) {
    super(
      declarationNode,
      publicSchemaSymbol,
      contextStack,
      errors,
      kindsGloballyFound,
      kindsLocallyFound,
    );
  }
}
