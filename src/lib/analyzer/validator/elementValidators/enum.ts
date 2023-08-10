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
import { isPrimaryVariableNode, isQuotedStringNode } from '../../../utils';
import { SchemaSymbolTable, TableEntry } from '../../symbol/symbolTable';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator from './elementValidator';

export default class EnumValidator extends ElementValidator {
  protected elementKind: ElementKind = ElementKind.ENUM;

  protected context = createContextValidatorConfig({
    name: ValidatorContext.EnumContext,
    errorCode: CompileErrorCode.INVALID_ENUM_CONTEXT,
    stopOnError: false,
  });

  protected unique = createUniqueValidatorConfig({
    mandatory: false,
    errorCode: undefined,
    stopOnError: false,
  });

  protected name = createNameValidatorConfig({
    optional: false,
    notFoundErrorCode: CompileErrorCode.NAME_NOT_FOUND,
    allow: true,
    foundErrorCode: undefined,
    allowComplex: true,
    complexErrorCode: undefined,
    shouldRegister: true,
    duplicateErrorCode: CompileErrorCode.DUPLICATE_NAME,
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
    allowSimple: false,
    simpleErrorCode: CompileErrorCode.SIMPLE_ENUM_BODY,
    allowComplex: true,
    complexErrorCode: undefined,
    stopOnError: true,
  });

  protected subfield = createSubFieldValidatorConfig({
    argValidators: [
      {
        validateArg: isPrimaryVariableNode,
        errorCode: CompileErrorCode.INVALID_ENUM_ELEMENT_NAME,
      },
    ],
    invalidArgNumberErrorCode: CompileErrorCode.INVALID_ENUM_ELEMENT,
    setting: createSettingsValidatorConfig(
      {
        note: {
          allowDuplicate: true,
          isValid: isQuotedStringNode,
        },
      },
      {
        optional: true,
        notFoundErrorCode: undefined,
        allow: true,
        foundErrorCode: undefined,
        unknownErrorCode: CompileErrorCode.UNKNOWN_ENUM_ELEMENT_SETTING,
        duplicateErrorCode: CompileErrorCode.DUPLICATE_ENUM_ELEMENT_SETTING,
        invalidErrorCode: CompileErrorCode.INVALID_ENUM_ELEMENT_SETTING,
        stopOnError: false,
      },
    ),
    shouldRegister: true,
    duplicateErrorCode: CompileErrorCode.DUPLICATE_ENUM_ELEMENT_NAME,
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

export function allowValueForThisEnumElementSetting(
  settingName: string,
  value?: SyntaxNode | SyntaxToken[],
): boolean {
  return !!{
    note: isQuotedStringNode,
  }[settingName]?.call(undefined, value);
}

export function allowDuplicateForThisEnumElementSetting(settingName: string): boolean {
  return false;
}
