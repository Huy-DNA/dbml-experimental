import { SymbolTable } from './symbol';

export default class Binder {
  private symbolTable: SymbolTable;

  constructor(symbolTable: SymbolTable) {
    this.symbolTable = symbolTable;
  }
}
