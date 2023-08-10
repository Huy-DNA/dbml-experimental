import { CompileErrorCode } from '../../../errors';
import {
  createAliasValidatorConfig,
  createBodyValidatorConfig,
  createNameValidatorConfig,
  createSettingsValidatorConfig,
  createUniqueValidatorConfig,
} from '../types';

export function anyBodyConfig(stopOnError: boolean) {
  return createBodyValidatorConfig({
    allowSimple: true,
    simpleErrorCode: undefined,
    allowComplex: true,
    complexErrorCode: undefined,
    stopOnError,
  });
}
export function simpleBodyConfig(stopOnError: boolean) {
  return createBodyValidatorConfig({
    allowSimple: true,
    simpleErrorCode: undefined,
    allowComplex: false,
    complexErrorCode: CompileErrorCode.UNEXPECTED_COMPLEX_BODY,
    stopOnError,
  });
}
export function complexBodyConfig(stopOnError: boolean) {
  return createBodyValidatorConfig({
    allowSimple: false,
    simpleErrorCode: CompileErrorCode.UNEXPECTED_SIMPLE_BODY,
    allowComplex: true,
    complexErrorCode: undefined,
    stopOnError,
  });
}
export function optionalAliasConfig(stopOnError: boolean) {
  return createAliasValidatorConfig({
    optional: true,
    notFoundErrorCode: undefined,
    allow: true,
    foundErrorCode: undefined,
    stopOnError,
  });
}

export function optionalNameConfig(stopOnError: boolean) {
  return createNameValidatorConfig({
    optional: true,
    notFoundErrorCode: undefined,
    allow: true,
    foundErrorCode: undefined,
    allowComplex: true,
    complexErrorCode: undefined,
    shouldRegister: false,
    duplicateErrorCode: undefined,
    stopOnError,
  });
}

export function registerNameConfig(stopOnError: boolean) {
  return createNameValidatorConfig({
    optional: false,
    notFoundErrorCode: CompileErrorCode.NAME_NOT_FOUND,
    allow: true,
    foundErrorCode: undefined,
    allowComplex: true,
    complexErrorCode: undefined,
    shouldRegister: true,
    duplicateErrorCode: CompileErrorCode.DUPLICATE_NAME,
    stopOnError,
  });
}

export function noSettingsConfig(stopOnError: boolean) {
  return createSettingsValidatorConfig(
    {},
    {
      optional: true,
      notFoundErrorCode: undefined,
      allow: false,
      foundErrorCode: CompileErrorCode.UNEXPECTED_SETTINGS,
      unknownErrorCode: undefined,
      duplicateErrorCode: undefined,
      invalidErrorCode: undefined,
      stopOnError,
    },
  );
}

export function locallyUniqueConfig(errorCode: CompileErrorCode, stopOnError: boolean) {
  return createUniqueValidatorConfig({
    globally: false,
    notGloballyErrorCode: undefined,
    locally: true,
    notLocallyErrorCode: errorCode,
    stopOnError,
  });
}
export function globallyUniqueConfig(errorCode: CompileErrorCode, stopOnError: boolean) {
  return createUniqueValidatorConfig({
    globally: true,
    notGloballyErrorCode: errorCode,
    locally: false,
    notLocallyErrorCode: undefined,
    stopOnError,
  });
}

export function noUniqueConfig(stopOnError: boolean) {
  return createUniqueValidatorConfig({
    globally: false,
    notGloballyErrorCode: undefined,
    locally: false,
    notLocallyErrorCode: undefined,
    stopOnError,
  });
}

export function noNameConfig(stopOnError: boolean) {
  return createNameValidatorConfig({
    optional: true,
    notFoundErrorCode: undefined,
    allow: false,
    foundErrorCode: CompileErrorCode.UNEXPECTED_NAME,
    allowComplex: false,
    complexErrorCode: CompileErrorCode.UNEXPECTED_NAME,
    shouldRegister: false,
    duplicateErrorCode: undefined,
    stopOnError,
  });
}

export function noAliasConfig(stopOnError: boolean) {
  return createAliasValidatorConfig({
    optional: true,
    notFoundErrorCode: undefined,
    allow: false,
    foundErrorCode: CompileErrorCode.UNEXPECTED_ALIAS,
    stopOnError,
  });
}
