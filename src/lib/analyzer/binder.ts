import { SchemaSymbolTable } from './symbol/symbolTable';

export default class Binder {
  private globalSchema: SchemaSymbolTable;

  constructor(globalSchema: SchemaSymbolTable) {
    this.globalSchema = globalSchema;
  }
}
