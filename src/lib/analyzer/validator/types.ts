import { ElementDeclarationNode, SyntaxNode } from '../../parser/nodes';
import { CompileErrorCode } from '../../errors';
import { SyntaxToken } from '../../lexer/tokens';
import { None, Option, Some } from '../../option';
import { ValidatorContext } from './validatorContext';
import { UnresolvedName } from '../types';
import { NodeSymbol } from '../symbol/symbols';

export interface SettingValidator {
  allowDuplicate: boolean;
  isValid: (value?: SyntaxNode | SyntaxToken[]) => boolean;
  registerUnresolvedName?(
    value: SyntaxNode | SyntaxToken[] | undefined,
    ownerElement: ElementDeclarationNode,
    unresolvedNames: UnresolvedName[],
  ): void;
}

export enum ElementKind {
  TABLE = 'Table',
  ENUM = 'Enum',
  INDEXES = 'Indexes',
  NOTE = 'Note',
  PROJECT = 'Project',
  REF = 'Ref',
  TABLEGROUP = 'TableGroup',
  CUSTOM = '<CUSTOM>',
}

export interface ArgumentValidatorConfig {
  validateArg(node: SyntaxNode): boolean;
  errorCode: Readonly<CompileErrorCode>;
  registerUnresolvedName?(
    node: SyntaxNode,
    ownerElement: ElementDeclarationNode,
    unresolvedNames: UnresolvedName[],
  ): void;
}

export interface ContextValidatorConfig {
  name: Readonly<ValidatorContext>;
  errorCode: Readonly<CompileErrorCode>;
  stopOnError: Readonly<boolean>;
}

export interface UniqueElementValidatorConfig {
  globally: Readonly<boolean>;
  notGloballyErrorCode?: Readonly<CompileErrorCode>;
  locally: Readonly<boolean>;
  notLocallyErrorCode?: Readonly<CompileErrorCode>;
  stopOnError: Readonly<boolean>;
}

export interface NameValidatorConfig {
  optional: Readonly<boolean>;
  notFoundErrorCode?: Readonly<CompileErrorCode>;

  allow: Readonly<boolean>;
  foundErrorCode?: Readonly<CompileErrorCode>;

  allowComplex: Readonly<boolean>;
  complexErrorCode?: Readonly<CompileErrorCode>;

  shouldRegister: Readonly<boolean>;
  duplicateErrorCode?: Readonly<CompileErrorCode>;

  stopOnError: Readonly<boolean>;
}

export interface AliasValidatorConfig {
  optional: Readonly<boolean>;
  notFoundErrorCode?: Readonly<CompileErrorCode>;

  allow: Readonly<boolean>;
  foundErrorCode?: Readonly<CompileErrorCode>;

  stopOnError: Readonly<boolean>;
}

export interface SettingsValidatorConfig {
  optional: Readonly<boolean>;
  notFoundErrorCode?: Readonly<CompileErrorCode>;

  allow: Readonly<boolean>;
  foundErrorCode?: Readonly<CompileErrorCode>;

  unknownErrorCode?: Readonly<CompileErrorCode>;
  duplicateErrorCode?: Readonly<CompileErrorCode>;
  invalidErrorCode?: Readonly<CompileErrorCode>;

  stopOnError: Readonly<boolean>;

  isValid(name: string, value?: SyntaxNode | SyntaxToken[]): Option<boolean>;
  allowDuplicate(name: string): Option<boolean>;
  registerUnresolvedName(
    settingName: string,
    value: SyntaxNode | SyntaxToken[] | undefined,
    ownerElement: ElementDeclarationNode,
    unresolvedNames: UnresolvedName[],
  ): void;
}

export interface BodyValidatorConfig {
  allowSimple: Readonly<boolean>;
  simpleErrorCode?: Readonly<CompileErrorCode>;

  allowComplex: Readonly<boolean>;
  complexErrorCode?: Readonly<CompileErrorCode>;

  stopOnError: Readonly<boolean>;
}

export interface SubFieldValidatorConfig {
  argValidators: Readonly<ArgumentValidatorConfig[]>;

  invalidArgNumberErrorCode?: Readonly<CompileErrorCode>;
  setting: Readonly<SettingsValidatorConfig>;

  shouldRegister: Readonly<boolean>;
  duplicateErrorCode?: Readonly<CompileErrorCode>;
}

export function createContextValidatorConfig(
  config: ContextValidatorConfig,
): ContextValidatorConfig {
  return config;
}

export function createUniqueValidatorConfig(
  config: UniqueElementValidatorConfig,
): UniqueElementValidatorConfig {
  if (config.globally && !config.notGloballyErrorCode) {
    throw new Error(
      'Misconfigurartion: If an element is globally unique, notGloballyErrorCode must be set',
    );
  }

  if (config.locally && !config.notLocallyErrorCode) {
    throw new Error(
      'Misconfigurartion: If an element is locally unique, notLocallyErrorCode must be set',
    );
  }

  return config;
}

export function createNameValidatorConfig(config: NameValidatorConfig): NameValidatorConfig {
  if (!config.optional && !config.notFoundErrorCode) {
    throw new Error('Misconfiguration: If name is not optional, notFoundErrorCode must be present');
  }

  if (!config.allow && !config.foundErrorCode) {
    throw new Error('Misconfiguration: If name is not allowed, foundErrorCode must be present');
  }

  if (config.shouldRegister && !config.duplicateErrorCode) {
    throw new Error(
      'Misconfiguration: If name should be registered, duplicateErrorCode must be present',
    );
  }

  return config;
}

export function createAliasValidatorConfig(config: AliasValidatorConfig): AliasValidatorConfig {
  if (!config.optional && !config.notFoundErrorCode) {
    throw new Error(
      'Misconfiguration: If alias is not optional, notFoundErrorCode must be present',
    );
  }

  if (!config.allow && !config.foundErrorCode) {
    throw new Error('Misconfiguration: If alias is not allowed, foundErrorCode must be present');
  }

  return config;
}

export function createSettingsValidatorConfig(
  validatorMap: { [settingName: string]: SettingValidator },
  config: {
    optional: boolean;
    notFoundErrorCode?: CompileErrorCode;
    allow: boolean;
    foundErrorCode?: CompileErrorCode;
    unknownErrorCode?: CompileErrorCode;
    duplicateErrorCode?: CompileErrorCode;
    invalidErrorCode?: CompileErrorCode;
    stopOnError: boolean;
  },
): SettingsValidatorConfig {
  if (!config.optional && !config.notFoundErrorCode) {
    throw new Error(
      'Misconfiguration: If settings is not optional, notFoundErrorCode must be present',
    );
  }

  if (!config.allow && !config.foundErrorCode) {
    throw new Error('Misconfiguration: If settings is not allowed, foundErrorCode must be present');
  }

  if (config.allow && !config.unknownErrorCode) {
    throw new Error('Misconfiguration: If settings is allowed, unknownErrorCode must be present');
  }

  if (config.allow && !config.duplicateErrorCode) {
    throw new Error('Misconfiguration: If settings is allowed, duplicateErrorCode must be present');
  }

  if (config.allow && !config.invalidErrorCode) {
    throw new Error('Misconfiguration: If settings is allowed, foundErrorCode must be present');
  }

  return {
    ...config,

    isValid(name: string, value?: SyntaxNode | SyntaxToken[]): Option<boolean> {
      const validator = validatorMap[name];
      if (!validator) {
        return new None();
      }

      return new Some(validator.isValid(value));
    },

    allowDuplicate(name: string): Option<boolean> {
      const validator = validatorMap[name];
      if (!validator) {
        return new None();
      }

      return new Some(validator.allowDuplicate);
    },

    registerUnresolvedName(
      settingName: string,
      value: SyntaxNode | SyntaxToken[] | undefined,
      ownerElement: ElementDeclarationNode,
      unresolvedNames: UnresolvedName[],
    ): void {
      const validator = validatorMap[settingName];
      if (!validator) {
        throw new Error(
          'Unreachable - registerUnresolvedName should only be called after validity check',
        );
      }

      validator.registerUnresolvedName?.call(undefined, value, ownerElement, unresolvedNames);
    },
  };
}

export function createBodyValidatorConfig(config: BodyValidatorConfig): BodyValidatorConfig {
  if (!config.allowSimple && !config.simpleErrorCode) {
    throw new Error('Misconfiguration: If simple body is not allowed, simpleErrorCode must be set');
  }

  if (!config.allowComplex && !config.complexErrorCode) {
    throw new Error(
      'Misconfiguration: If complex body is not allowed, complexErrorCode must be set',
    );
  }

  return config;
}

export function createSubFieldValidatorConfig(
  config: SubFieldValidatorConfig,
): SubFieldValidatorConfig {
  if (config.argValidators.length > 0 && !config.invalidArgNumberErrorCode) {
    throw new Error(
      'Misconfiguration: If subfield accepts arguments, invalidArgNumberErrorCode must be present',
    );
  }

  if (config.shouldRegister && !config.duplicateErrorCode) {
    throw new Error(
      'Misconfiguration: If subfield should be registered, duplicateErrorCode must be present',
    );
  }

  return config;
}
