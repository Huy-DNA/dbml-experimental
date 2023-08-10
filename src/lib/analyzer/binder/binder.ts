import { SchemaSymbolTable } from '../symbol/symbolTable';
import { NodeSymbol } from '../symbol/symbols';

export default class Binder {
  private globalSchema: SchemaSymbolTable;

  constructor(globalSchema: SchemaSymbolTable) {
    this.globalSchema = globalSchema;
  }
}
