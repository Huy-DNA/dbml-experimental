import { UnresolvedName } from '../../types';
import { createColumnSymbolId } from '../../symbol/symbolIndex';
import {
  ElementKind,
  createContextValidatorConfig,
  createSettingsValidatorConfig,
  createSubFieldValidatorConfig,
} from '../types';
import { CompileError, CompileErrorCode } from '../../../errors';
import { SyntaxToken } from '../../../lexer/tokens';
import {
  ElementDeclarationNode,
  PrimaryExpressionNode,
  SyntaxNode,
  VariableNode,
} from '../../../parser/nodes';
import { isQuotedStringNode } from '../../../utils';
import { destructureIndex } from '../../utils';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator from './elementValidator';
import { isVoid } from '../utils';
import {
  complexBodyConfig,
  noAliasConfig,
  noNameConfig,
  noSettingsConfig,
  noUniqueConfig,
} from './_preset_configs';
import { SchemaSymbol } from '../../symbol/symbols';

export default class IndexesValidator extends ElementValidator {
  protected elementKind: ElementKind = ElementKind.INDEXES;

  protected context = createContextValidatorConfig({
    name: ValidatorContext.IndexesContext,
    errorCode: CompileErrorCode.INVALID_INDEXES_CONTEXT,
    stopOnError: false,
  });

  protected unique = noUniqueConfig(false);

  protected name = noNameConfig(false);

  protected alias = noAliasConfig(false);

  protected settings = noSettingsConfig(false);

  protected body = complexBodyConfig(false);

  protected subfield = createSubFieldValidatorConfig({
    argValidators: [
      {
        validateArg: (node) => destructureIndex(node).unwrap_or(undefined) !== undefined,
        errorCode: CompileErrorCode.INVALID_INDEX,
        registerUnresolvedName: registerIndexForResolution,
      },
    ],
    invalidArgNumberErrorCode: CompileErrorCode.INVALID_INDEX,
    setting: indexSettings(),
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

export function registerIndexForResolution(
  node: SyntaxNode,
  ownerElement: ElementDeclarationNode,
  unresolvedNames: UnresolvedName[],
) {
  const columnIds = destructureIndex(node)
    .unwrap_or(undefined)
    ?.nonFunctional.map(createColumnSymbolId);

  if (!columnIds) {
    throw new Error(
      'Unreachable - Index should be validated before registerIndexForResolution is called',
    );
  }

  columnIds.forEach((id) =>
    unresolvedNames.push({
      id: createColumnSymbolId(id),
      ownerElement,
      referrer: node,
    }));
}

export function isValidIndexesType(value?: SyntaxNode | SyntaxToken[]): boolean {
  if (!(value instanceof PrimaryExpressionNode) || !(value.expression instanceof VariableNode)) {
    return false;
  }

  const str = value.expression.variable.value;

  return str === 'btree' || str === 'hash';
}

const indexSettings = () =>
  createSettingsValidatorConfig(
    {
      note: {
        allowDuplicate: false,
        isValid: isQuotedStringNode,
      },
      name: {
        allowDuplicate: false,
        isValid: isQuotedStringNode,
      },
      type: {
        allowDuplicate: false,
        isValid: isValidIndexesType,
      },
      unique: {
        allowDuplicate: false,
        isValid: isVoid,
      },
      pk: {
        allowDuplicate: false,
        isValid: isVoid,
      },
    },
    {
      optional: true,
      notFoundErrorCode: undefined,
      allow: true,
      foundErrorCode: undefined,
      unknownErrorCode: CompileErrorCode.UNKNOWN_INDEX_SETTING,
      duplicateErrorCode: CompileErrorCode.DUPLICATE_INDEX_SETTING,
      invalidErrorCode: CompileErrorCode.INVALID_INDEX_SETTING_VALUE,
      stopOnError: false,
    },
  );
