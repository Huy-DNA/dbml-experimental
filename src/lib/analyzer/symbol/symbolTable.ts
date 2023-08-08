import { ElementDeclarationNode, ExpressionNode, SyntaxNode } from '../../parser/nodes';
import {
  ColumnSymbol,
  EnumElementSymbol,
  EnumSymbol,
  SchemaSymbol,
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
}

export interface SymbolTableEntry {
  kind: EntryKind;
  declarationNode?: SyntaxNode;
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

  declarationNode: ElementDeclarationNode;

  symbolTable: EnumSymbolTable;

  constructor(declarationNode: ElementDeclarationNode, symbolTable: EnumSymbolTable) {
    this.declarationNode = declarationNode;
    this.symbolTable = symbolTable;
  }
}

export class TableEntry implements SymbolTableEntry {
  kind: EntryKind.TABLE = EntryKind.TABLE;

  declarationNode: ElementDeclarationNode;

  symbolTable: TableSymbolTable;

  constructor(declarationNode: ElementDeclarationNode, symbolTable: TableSymbolTable) {
    this.declarationNode = declarationNode;
    this.symbolTable = symbolTable;
  }
}

export class EnumElementEntry implements SymbolTableEntry {
  kind: EntryKind.ENUM_MEMBER = EntryKind.ENUM_MEMBER;

  declarationNode: ExpressionNode;

  constructor(declarationNode: ExpressionNode) {
    this.declarationNode = declarationNode;
  }
}

export class ColumnEntry implements SymbolTableEntry {
  kind: EntryKind.COLUMN = EntryKind.COLUMN;

  declarationNode: ExpressionNode;

  constructor(declarationNode: ExpressionNode) {
    this.declarationNode = declarationNode;
  }
}
export class TableGroupEntry implements SymbolTableEntry {
  kind: EntryKind.TABLE_GROUP = EntryKind.TABLE_GROUP;

  declarationNode: ExpressionNode;

  constructor(declarationNode: ExpressionNode) {
    this.declarationNode = declarationNode;
  }
}

export type SymbolTable = EnumSymbolTable | TableSymbolTable | SchemaSymbolTable;

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
