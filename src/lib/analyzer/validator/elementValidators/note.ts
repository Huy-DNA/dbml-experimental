import { ElementKind, createContextValidatorConfig, createSubFieldValidatorConfig } from '../types';
import { CompileError, CompileErrorCode } from '../../../errors';
import { ElementDeclarationNode } from '../../../parser/nodes';
import { isQuotedStringNode } from '../../../utils';
import { SchemaSymbol, TableEntry } from '../../symbol/symbolTable';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator from './elementValidator';
import {
  anyBodyConfig,
  locallyUniqueConfig,
  noAliasConfig,
  noNameConfig,
  noSettingsConfig,
} from './_preset_configs';

export default class NoteValidator extends ElementValidator {
  protected elementKind: ElementKind = ElementKind.NOTE;

  protected context = createContextValidatorConfig({
    name: ValidatorContext.NoteContext,
    errorCode: CompileErrorCode.INVALID_NOTE_CONTEXT,
    stopOnError: false,
  });

  protected unique = locallyUniqueConfig(CompileErrorCode.NOTE_REDEFINED, false);

  protected name = noNameConfig(false);

  protected alias = noAliasConfig(false);

  protected settings = noSettingsConfig(false);

  protected body = anyBodyConfig(false);

  protected subfield = createSubFieldValidatorConfig({
    argValidators: [
      {
        validateArg: isQuotedStringNode,
        errorCode: CompileErrorCode.INVALID_NOTE,
      },
    ],
    invalidArgNumberErrorCode: CompileErrorCode.INVALID_NOTE,
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
