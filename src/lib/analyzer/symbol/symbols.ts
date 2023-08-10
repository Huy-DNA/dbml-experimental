import SymbolTable from './symbolTable';
import { SyntaxNode } from '../../parser/nodes';

export const enum SymbolKind {
  SCHEMA,
  TABLE,
  ENUM,
  ENUM_MEMBER,
  COLUMN,
  TABLE_GROUP,
}

export interface NodeSymbol {
  kind: SymbolKind;
  symbolTable?: SymbolTable;
  declaration?: SyntaxNode;
}

export class SchemaSymbol implements NodeSymbol {
  kind: SymbolKind.SCHEMA = SymbolKind.SCHEMA;

  symbolTable: SymbolTable;

  constructor(symbolTable: SymbolTable) {
    this.symbolTable = symbolTable;
  }
}

export class EnumSymbol implements NodeSymbol {
  kind: SymbolKind.ENUM = SymbolKind.ENUM;

  symbolTable: SymbolTable;

  declaration: SyntaxNode;

  constructor(symbolTable: SymbolTable, declaration: SyntaxNode) {
    this.symbolTable = symbolTable;
    this.declaration = declaration;
  }
}

export class TableSymbol implements NodeSymbol {
  kind: SymbolKind.TABLE = SymbolKind.TABLE;

  symbolTable: SymbolTable;

  declaration: SyntaxNode;

  constructor(symbolTable: SymbolTable, declaration: SyntaxNode) {
    this.symbolTable = symbolTable;
    this.declaration = declaration;
  }
}

export class EnumElementSymbol implements NodeSymbol {
  kind: SymbolKind.ENUM_MEMBER = SymbolKind.ENUM_MEMBER;

  declaration: SyntaxNode;

  constructor(declaration: SyntaxNode) {
    this.declaration = declaration;
  }
}

export class ColumnSymbol implements NodeSymbol {
  kind: SymbolKind.COLUMN = SymbolKind.COLUMN;

  declaration: SyntaxNode;

  constructor(declaration: SyntaxNode) {
    this.declaration = declaration;
  }
}

export class TableGroupSymbol implements NodeSymbol {
  kind: SymbolKind.TABLE_GROUP = SymbolKind.TABLE_GROUP;

  symbolTable: SymbolTable;

  declaration: SyntaxNode;

  constructor(symbolTable: SymbolTable, declaration: SyntaxNode) {
    this.symbolTable = symbolTable;
    this.declaration = declaration;
  }
}

export class TableGroupElementSymbol implements NodeSymbol {
  kind: SymbolKind.TABLE_GROUP = SymbolKind.TABLE_GROUP;

  declaration: SyntaxNode;

  constructor(declaration: SyntaxNode) {
    this.declaration = declaration;
  }
}
