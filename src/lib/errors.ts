export enum CompileErrorCode {
  UNKNOWN_SYMBOL = 1000,

  UNEXPECTED_SYMBOL,
  UNEXPECTED_EOF,
  UNEXPECTED_NEWLINE,

  UNKNOWN_TOKEN,
  UNEXPECTED_TOKEN,
  MISPLACED_LIST_NODE,
  MISSING_SPACES,
  UNKNOWN_PREFIX_OP,
  INVALID_OPERAND,
  EMPTY_ATTRIBUTE_NAME,

  INVALID_NAME = 3000,
  UNEXPECTED_NAME,
  NAME_NOT_FOUND,
  DUPLICATE_NAME,
  INVALID_ALIAS,
  UNEXPECTED_ALIAS,
  UNEXPECTED_SETTINGS,
  INVALID_SETTINGS,

  INVALID_TABLE_CONTEXT,
  INVALID_TABLE_SETTING,
  DUPLICATE_TABLE_SETTING,
  SIMPLE_TABLE_BODY,

  INVALID_TABLEGROUP_CONTEXT,
  INVALID_TABLEGROUP_ELEMENT_NAME,
  DUPLICATE_TABLEGROUP_ELEMENT_NAME,
  INVALID_TABLEGROUP_FIELD,
  SIMPLE_TABLEGROUP_BODY,

  INVALID_COLUMN,
  INVALID_COLUMN_NAME,
  INVALID_COLUMN_SETTING,
  INVALID_COLUMN_TYPE,
  DUPLICATE_COLUMN_NAME,
  DUPLICATE_COLUMN_SETTINGS,

  INVALID_ENUM_CONTEXT,
  SIMPLE_ENUM_BODY,
  INVALID_ENUM_ELEMENT_NAME,
  INVALID_ENUM_ELEMENT,
  DUPLICATE_ENUM_ELEMENT_NAME,
  DUPLICATE_ENUM_ELEMENT_SETTING,
  INVALID_ENUM_ELEMENT_SETTING,

  INVALID_REF_CONTEXT,
  DUPLICATE_REF_SETTING,
  INVALID_REF_SETTING_VALUE,
  INVALID_REF_RELATIONSHIP,
  INVALID_REF_FIELD,

  INVALID_NOTE_CONTEXT,
  INVALID_NOTE,

  INVALID_INDEXES_CONTEXT,
  SIMPLE_INDEXES_BODY,
  INVALID_INDEXES_FIELD,
  INVALID_INDEX,
  DUPLICATE_INDEX_SETTING,
  UNEXPECTED_INDEX_SETTING_VALUE,

  INVALID_PROJECT_CONTEXT,
  PROJECT_REDEFINED,
  SIMPLE_PROJECT_BODY,
  INVALID_PROJECT_FIELD,

  INVALID_CUSTOM_CONTEXT,
  INVALID_CUSTOM_ELEMENT_VALUE,
  COMPLEX_CUSTOM_BODY,
}

export class CompileError extends Error {
  code: Readonly<CompileErrorCode>;

  diagnostic: Readonly<string>;

  start: Readonly<number>;

  end: Readonly<number>;

  value: unknown;

  constructor(code: number, message: string, start: number, end: number, value?: unknown) {
    super(message);
    this.code = code;
    this.diagnostic = message;
    this.start = start;
    this.end = end;
    this.value = value;
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, CompileError.prototype);
  }
}
