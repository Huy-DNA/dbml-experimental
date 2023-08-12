import { UnresolvedName } from 'lib/analyzer/types';
import { ElementKind, createContextValidatorConfig, createSubFieldValidatorConfig } from '../types';
import { CompileError, CompileErrorCode } from '../../../errors';
import { ElementDeclarationNode } from '../../../parser/nodes';
import { isExpressionAQuotedString } from '../../../utils';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator from './elementValidator';
import {
  anyBodyConfig,
  locallyUniqueConfig,
  noAliasConfig,
  noNameConfig,
  noSettingListConfig,
} from './_preset_configs';
import { SchemaSymbol } from '../../symbol/symbols';

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

  protected settingList = noSettingListConfig(false);

  protected body = anyBodyConfig(false);

  protected subfield = createSubFieldValidatorConfig({
    argValidators: [
      {
        validateArg: isExpressionAQuotedString,
        errorCode: CompileErrorCode.INVALID_NOTE,
      },
    ],
    invalidArgNumberErrorCode: CompileErrorCode.INVALID_NOTE,
    settingList: noSettingListConfig(false),
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
