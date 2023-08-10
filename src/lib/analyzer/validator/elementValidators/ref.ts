import {
  ElementKind,
  createAliasValidatorConfig,
  createBodyValidatorConfig,
  createContextValidatorConfig,
  createNameValidatorConfig,
  createSettingsValidatorConfig,
  createSubFieldValidatorConfig,
  createUniqueValidatorConfig,
} from '../types';
import { CompileError, CompileErrorCode } from '../../../errors';
import { SyntaxToken } from '../../../lexer/tokens';
import { ElementDeclarationNode, SyntaxNode } from '../../../parser/nodes';
import { isQuotedStringNode } from '../../../utils';
import { SchemaSymbolTable, TableEntry } from '../../symbol/symbolTable';
import { extractQuotedStringToken, isBinaryRelationship, joinTokenStrings } from '../../utils';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator from './elementValidator';

export default class RefValidator extends ElementValidator {
  protected elementKind: ElementKind = ElementKind.REF;

  protected context = createContextValidatorConfig({
    name: ValidatorContext.RefContext,
    errorCode: CompileErrorCode.INVALID_REF_CONTEXT,
    stopOnError: false,
  });

  protected unique = createUniqueValidatorConfig({
    mandatory: false,
    errorCode: undefined,
    stopOnError: false,
  });

  protected name = createNameValidatorConfig({
    optional: true,
    notFoundErrorCode: undefined,
    allow: true,
    foundErrorCode: undefined,
    allowComplex: true,
    complexErrorCode: undefined,
    shouldRegister: false,
    duplicateErrorCode: undefined,
    stopOnError: false,
  });

  protected alias = createAliasValidatorConfig({
    optional: true,
    notFoundErrorCode: undefined,
    allow: false,
    foundErrorCode: CompileErrorCode.UNEXPECTED_ALIAS,
    stopOnError: false,
  });

  protected settings = createSettingsValidatorConfig(
    {},
    {
      optional: true,
      notFoundErrorCode: undefined,
      allow: false,
      foundErrorCode: CompileErrorCode.UNEXPECTED_SETTINGS,
      unknownErrorCode: undefined,
      duplicateErrorCode: undefined,
      invalidErrorCode: undefined,
      stopOnError: false,
    },
  );

  protected body = createBodyValidatorConfig({
    allowSimple: true,
    simpleErrorCode: undefined,
    allowComplex: true,
    complexErrorCode: undefined,
    stopOnError: false,
  });

  protected subfield = createSubFieldValidatorConfig({
    argValidators: [
      {
        validateArg: isBinaryRelationship,
        errorCode: CompileErrorCode.INVALID_REF_RELATIONSHIP,
      },
    ],
    invalidArgNumberErrorCode: CompileErrorCode.INVALID_REF_FIELD,
    setting: createSettingsValidatorConfig(
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
        notFoundErrorCode: undefined,
        allow: true,
        foundErrorCode: undefined,
        unknownErrorCode: CompileErrorCode.UNKNOWN_REF_SETTING,
        duplicateErrorCode: CompileErrorCode.DUPLICATE_REF_SETTING,
        invalidErrorCode: CompileErrorCode.INVALID_REF_SETTING_VALUE,
        stopOnError: false,
      },
    ),
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

function isValidPolicy(value?: SyntaxNode | SyntaxToken[]): boolean {
  if (!Array.isArray(value) && !isQuotedStringNode(value)) {
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
