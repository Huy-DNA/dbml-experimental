import {
  ColumnSymbol,
  EnumElementSymbol,
  EnumSymbol,
  SchemaSymbol,
  TableGroupElementSymbol,
  TableGroupSymbol,
  TableSymbol,
} from './symbols';

export const enum EntryKind {
  SCHEMA,
  TABLE,
  ENUM,
  ENUM_MEMBER,
  COLUMN,
  TABLE_GROUP,
  PROJECT,
}

export interface SymbolTableEntry {
  kind: EntryKind;
  symbolTable?: SymbolTable;
}

export class SchemaEntry implements SymbolTableEntry {
  kind: EntryKind.SCHEMA = EntryKind.SCHEMA;

  symbolTable: SchemaSymbolTable;

  constructor(symbolTable: SchemaSymbolTable) {
    this.symbolTable = symbolTable;
  }
}

export class EnumEntry implements SymbolTableEntry {
  kind: EntryKind.ENUM = EntryKind.ENUM;

  symbolTable: EnumSymbolTable;

  constructor(symbolTable: EnumSymbolTable) {
    this.symbolTable = symbolTable;
  }
}

export class TableEntry implements SymbolTableEntry {
  kind: EntryKind.TABLE = EntryKind.TABLE;

  symbolTable: TableSymbolTable;

  constructor(symbolTable: TableSymbolTable) {
    this.symbolTable = symbolTable;
  }
}

export class EnumElementEntry implements SymbolTableEntry {
  kind: EntryKind.ENUM_MEMBER = EntryKind.ENUM_MEMBER;
}

export class ColumnEntry implements SymbolTableEntry {
  kind: EntryKind.COLUMN = EntryKind.COLUMN;
}
export class TableGroupEntry implements SymbolTableEntry {
  kind: EntryKind.TABLE_GROUP = EntryKind.TABLE_GROUP;

  symbolTable: TableGroupSymbolTable;

  constructor(symbolTable: TableGroupSymbolTable) {
    this.symbolTable = symbolTable;
  }
}

export class TableGroupElementEntry implements SymbolTableEntry {
  kind: EntryKind.TABLE_GROUP = EntryKind.TABLE_GROUP;
}

export type SymbolTable =
  | EnumSymbolTable
  | TableSymbolTable
  | SchemaSymbolTable
  | TableGroupSymbolTable;

export class TableGroupSymbolTable {
  private table: Map<string, TableGroupElementEntry>;

  constructor() {
    this.table = new Map();
  }

  has(symbol: TableGroupElementSymbol): boolean {
    return this.table.has(symbol.asKey());
  }

  set(symbol: TableGroupElementSymbol, value: TableGroupElementEntry) {
    if (value === undefined) {
      return;
    }
    this.table.set(symbol.asKey(), value);
  }

  get(
    symbol: TableGroupElementSymbol,
    defaultValue?: TableGroupElementEntry,
  ): TableGroupElementEntry | undefined {
    return (
      this.table.get(symbol.asKey()) ||
      (defaultValue !== undefined && this.set(symbol, defaultValue)) ||
      defaultValue
    );
  }
}
export class EnumSymbolTable {
  private table: Map<string, EnumElementEntry>;

  constructor() {
    this.table = new Map();
  }

  has(symbol: EnumElementSymbol): boolean {
    return this.table.has(symbol.asKey());
  }

  set(symbol: EnumElementSymbol, value: EnumElementEntry) {
    if (value === undefined) {
      return;
    }
    this.table.set(symbol.asKey(), value);
  }

  get(symbol: EnumElementSymbol, defaultValue?: EnumElementEntry): EnumElementEntry | undefined {
    return (
      this.table.get(symbol.asKey()) ||
      (defaultValue !== undefined && this.set(symbol, defaultValue)) ||
      defaultValue
    );
  }
}

export class TableSymbolTable {
  private table: Map<string, ColumnEntry>;

  constructor() {
    this.table = new Map();
  }

  has(symbol: ColumnSymbol): boolean {
    return this.table.has(symbol.asKey());
  }

  set(symbol: ColumnSymbol, value: ColumnEntry) {
    if (value === undefined) {
      return;
    }
    this.table.set(symbol.asKey(), value);
  }

  get(symbol: ColumnSymbol, defaultValue?: ColumnEntry): ColumnEntry | undefined {
    return (
      this.table.get(symbol.asKey()) ||
      (defaultValue !== undefined && this.set(symbol, defaultValue)) ||
      defaultValue
    );
  }
}

export class SchemaSymbolTable {
  private table: Map<string, SchemaEntry | TableEntry | EnumEntry | TableGroupEntry>;

  constructor() {
    this.table = new Map();
  }

  has(symbol: SchemaSymbol | TableSymbol | EnumSymbol | TableGroupSymbol): boolean {
    return this.table.has(symbol.asKey());
  }

  set(symbol: SchemaSymbol, value: SchemaEntry): void;

  set(symbol: TableSymbol, value: TableEntry): void;

  set(symbol: EnumSymbol, value: EnumEntry): void;

  set(symbol: TableGroupSymbol, value: TableGroupEntry): void;

  set(
    symbol: SchemaSymbol | TableSymbol | EnumSymbol | TableGroupSymbol,
    value: SchemaEntry | TableEntry | EnumEntry | TableGroupEntry,
  ) {
    if (value === undefined) {
      return;
    }
    this.table.set(symbol.asKey(), value);
  }

  get(symbol: TableSymbol, defaultValue: TableEntry): TableEntry;
  get(symbol: TableSymbol): TableEntry | undefined;

  get(symbol: SchemaSymbol, defaultValue: SchemaEntry): SchemaEntry;
  get(symbol: SchemaSymbol): SchemaEntry | undefined;

  get(symbol: EnumSymbol, defaultValue: EnumEntry): EnumEntry;
  get(symbol: EnumSymbol): EnumEntry | undefined;

  get(symbol: TableGroupSymbol, defaultValue: TableGroupEntry): TableGroupEntry;
  get(symbol: TableGroupSymbol): TableGroupEntry | undefined;

  get(
    symbol: SchemaSymbol | TableSymbol | EnumSymbol | TableGroupSymbol,
    defaultValue?: any,
  ): SchemaEntry | TableEntry | EnumEntry | TableGroupEntry | undefined {
    return (
      this.table.get(symbol.asKey()) ||
      (defaultValue !== undefined && this.set(symbol, defaultValue)) ||
      defaultValue
    );
  }
}
