import { UnresolvedName } from 'lib/analyzer/types';
import {
  ElementKind,
  createContextValidatorConfig,
  createSettingsValidatorConfig,
  createSubFieldValidatorConfig,
} from '../types';
import { CompileError, CompileErrorCode } from '../../../errors';
import {
  CallExpressionNode,
  ElementDeclarationNode,
  NormalFormExpressionNode,
  PrefixExpressionNode,
  PrimaryExpressionNode,
  SyntaxNode,
} from '../../../parser/nodes';
import { isAccessExpression, isPrimaryVariableNode, isQuotedStringNode } from '../../../utils';
import { destructureComplexVariable } from '../../utils';
import { ContextStack, ValidatorContext } from '../validatorContext';
import ElementValidator from './elementValidator';
import {
 isUnaryRelationship, isValidColor, isValidDefaultValue, isVoid,
} from '../utils';
import {
  registerNameConfig,
  optionalAliasConfig,
  complexBodyConfig,
  noUniqueConfig,
} from './_preset_configs';
import { SchemaSymbol } from '../../symbol/symbols';
import {
  createEnumElementSymbolId,
  createEnumSymbolId,
  createSchemaSymbolId,
} from '../../symbol/symbolIndex';
import { registerRelationshipOperand } from './utils';
import { SyntaxToken } from '../../../lexer/tokens';

export default class TableValidator extends ElementValidator {
  protected elementKind: ElementKind = ElementKind.TABLE;

  protected context = createContextValidatorConfig({
    name: ValidatorContext.TableContext,
    errorCode: CompileErrorCode.INVALID_TABLE_CONTEXT,
    stopOnError: false,
  });

  protected unique = noUniqueConfig(false);

  protected name = registerNameConfig(false);

  protected alias = optionalAliasConfig(false);

  protected settings = createSettingsValidatorConfig(
    {
      headercolor: {
        allowDuplicate: false,
        isValid: isValidColor,
      },
      note: {
        allowDuplicate: false,
        isValid: isQuotedStringNode,
      },
    },
    {
      optional: true,
      notFoundErrorCode: undefined,
      allow: true,
      foundErrorCode: undefined,
      unknownErrorCode: CompileErrorCode.INVALID_TABLE_SETTING,
      duplicateErrorCode: CompileErrorCode.DUPLICATE_TABLE_SETTING,
      invalidErrorCode: CompileErrorCode.INVALID_TABLE_SETTING,
      stopOnError: false,
    },
  );

  protected body = complexBodyConfig(false);

  protected subfield = createSubFieldValidatorConfig({
    argValidators: [
      {
        validateArg: isPrimaryVariableNode,
        errorCode: CompileErrorCode.INVALID_COLUMN_NAME,
      },
      {
        validateArg: isValidColumnType,
        errorCode: CompileErrorCode.INVALID_COLUMN_TYPE,
        registerUnresolvedName: registerEnumTypeIfComplexVariable,
      },
    ],
    invalidArgNumberErrorCode: CompileErrorCode.INVALID_COLUMN,
    setting: columnSettings(),
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

function registerEnumTypeIfComplexVariable(
  node: SyntaxNode,
  ownerElement: ElementDeclarationNode,
  unresolvedNames: UnresolvedName[],
) {
  if (!isAccessExpression(node)) {
    return;
  }

  if (!isValidColumnType(node)) {
    throw new Error('Unreachable - Invalid type when registerTypeIfComplexVariable is called');
  }

  const fragments = destructureComplexVariable(node).unwrap();
  const enumId = createEnumSymbolId(fragments.pop()!);
  const schemaIdStack = fragments.map(createSchemaSymbolId);

  unresolvedNames.push({
    id: enumId,
    qualifiers: schemaIdStack,
    ownerElement,
    referrer: node,
  });
}

function isValidColumnType(type: SyntaxNode): boolean {
  if (
    !(
      type instanceof CallExpressionNode ||
      isAccessExpression(type) ||
      type instanceof PrimaryExpressionNode
    )
  ) {
    return false;
  }

  while (type instanceof CallExpressionNode) {
    // eslint-disable-next-line no-param-reassign
    type = type.callee;
  }

  const variables = destructureComplexVariable(type).unwrap_or(undefined);

  return variables !== undefined && variables.length > 0;
}

const columnSettings = () =>
  createSettingsValidatorConfig(
    {
      note: {
        allowDuplicate: false,
        isValid: isQuotedStringNode,
      },
      ref: {
        allowDuplicate: true,
        isValid: isUnaryRelationship,
        registerUnresolvedName: registerUnaryRelationship,
      },
      'primary key': {
        allowDuplicate: false,
        isValid: isVoid,
      },
      default: {
        allowDuplicate: false,
        isValid: isValidDefaultValue,
        registerUnresolvedName: registerEnumValueIfComplexVar,
      },
      increment: {
        allowDuplicate: false,
        isValid: isVoid,
      },
      'not null': {
        allowDuplicate: false,
        isValid: isVoid,
      },
      null: {
        allowDuplicate: false,
        isValid: isVoid,
      },
      pk: {
        allowDuplicate: false,
        isValid: isVoid,
      },
      unique: {
        allowDuplicate: false,
        isValid: isVoid,
      },
    },
    {
      optional: true,
      notFoundErrorCode: undefined,
      allow: true,
      foundErrorCode: undefined,
      unknownErrorCode: CompileErrorCode.UNKNOWN_COLUMN_SETTING,
      duplicateErrorCode: CompileErrorCode.DUPLICATE_COLUMN_SETTING,
      invalidErrorCode: CompileErrorCode.INVALID_COLUMN_SETTING_VALUE,
      stopOnError: false,
    },
  );

function registerUnaryRelationship(
  value: SyntaxNode | SyntaxToken[] | undefined,
  ownerElement: ElementDeclarationNode,
  unresolvedNames: UnresolvedName[],
) {
  if (!isUnaryRelationship(value)) {
    throw new Error('Unreachable - Must be an unary rel when regiterUnaryRelationship is called');
  }

  registerRelationshipOperand(
    (value as PrefixExpressionNode).expression,
    ownerElement,
    unresolvedNames,
  );
}

function registerEnumValueIfComplexVar(
  value: SyntaxNode | SyntaxToken[] | undefined,
  ownerElement: ElementDeclarationNode,
  unresolvedNames: UnresolvedName[],
) {
  if (!isValidDefaultValue(value)) {
    throw new Error('Unreachable - Invalid default when registerEnumValueIfComplexVar is called');
  }

  if (value instanceof PrimaryExpressionNode) {
    return;
  }

  const fragments = destructureComplexVariable(value as SyntaxNode).unwrap();
  const enumFieldId = createEnumElementSymbolId(fragments.pop()!);
  const enumId = createEnumSymbolId(fragments.pop()!);
  const schemaId = fragments.map(createSchemaSymbolId);

  unresolvedNames.push({
    id: enumFieldId,
    qualifiers: [...schemaId, enumId],
    ownerElement,
    referrer: value as SyntaxNode,
  });
}
