import { UnresolvedName } from 'lib/analyzer/types';
import { registerRelationshipOperand } from './utils';
import {
  ElementKind,
  createContextValidatorConfig,
  createSettingListValidatorConfig,
  createSubFieldValidatorConfig,
} from '../types';
import { CompileError, CompileErrorCode } from '../../../errors';
import { SyntaxToken } from '../../../lexer/tokens';
import { ElementDeclarationNode, InfixExpressionNode, SyntaxNode } from '../../../parser/nodes';
import { isExpressionAQuotedString } from '../../../utils';
import { extractQuotedStringToken, isBinaryRelationship, joinTokenStrings } from '../../utils';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator from './elementValidator';
import {
  anyBodyConfig,
  noAliasConfig,
  noSettingListConfig,
  noUniqueConfig,
  optionalNameConfig,
} from './_preset_configs';
import { SchemaSymbol } from '../../symbol/symbols';

export default class RefValidator extends ElementValidator {
  protected elementKind: ElementKind = ElementKind.REF;

  protected context = createContextValidatorConfig({
    name: ValidatorContext.RefContext,
    errorCode: CompileErrorCode.INVALID_REF_CONTEXT,
    stopOnError: false,
  });

  protected unique = noUniqueConfig(false);

  protected name = optionalNameConfig(false);

  protected alias = noAliasConfig(false);

  protected settingList = noSettingListConfig(false);

  protected body = anyBodyConfig(false);

  protected subfield = createSubFieldValidatorConfig({
    argValidators: [
      {
        validateArg: isBinaryRelationship,
        errorCode: CompileErrorCode.INVALID_REF_RELATIONSHIP,
        registerUnresolvedName: registerBinaryRelationship,
      },
    ],
    invalidArgNumberErrorCode: CompileErrorCode.INVALID_REF_FIELD,
    setting: refFieldSettingList(),
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

function registerBinaryRelationship(
  node: SyntaxNode,
  ownerElement: ElementDeclarationNode,
  unresolvedNames: UnresolvedName[],
) {
  if (!isBinaryRelationship(node)) {
    throw new Error(
      'Unreachable - Must be a binary relationship when registerRelationshipOperands is called',
    );
  }

  registerRelationshipOperand(
    (node as InfixExpressionNode).leftExpression,
    ownerElement,
    unresolvedNames,
  );
  registerRelationshipOperand(
    (node as InfixExpressionNode).rightExpression,
    ownerElement,
    unresolvedNames,
  );
}

function isValidPolicy(value?: SyntaxNode | SyntaxToken[]): boolean {
  if (!Array.isArray(value) && !isExpressionAQuotedString(value)) {
    return false;
  }

  let extractedString: string | undefined;
  if (Array.isArray(value)) {
    extractedString = joinTokenStrings(value);
  } else {
    extractedString = extractQuotedStringToken(value);
  }

  if (extractedString) {
    switch (extractedString.toLowerCase()) {
      case 'cascade':
      case 'no action':
      case 'set null':
      case 'set default':
      case 'restrict':
        return true;
      default:
        return false;
    }
  }

  return false; // unreachable
}

const refFieldSettingList = () =>
  createSettingListValidatorConfig(
    {
      delete: {
        allowDuplicate: false,
        isValid: isValidPolicy,
      },
      update: {
        allowDuplicate: false,
        isValid: isValidPolicy,
      },
    },
    {
      optional: true,
      notOptionalErrorCode: undefined,
      allow: true,
      notAllowErrorCode: undefined,
      unknownErrorCode: CompileErrorCode.UNKNOWN_REF_SETTING,
      duplicateErrorCode: CompileErrorCode.DUPLICATE_REF_SETTING,
      invalidErrorCode: CompileErrorCode.INVALID_REF_SETTING_VALUE,
      stopOnError: false,
    },
  );
