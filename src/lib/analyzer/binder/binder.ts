import { SchemaSymbol } from '../symbol/symbolTable';
import { NodeSymbol } from '../symbol/symbols';

export default class Binder {
  private publicSchemaSymbol: SchemaSymbol;

  constructor(publicSchemaSymbol: SchemaSymbol) {
    this.publicSchemaSymbol = publicSchemaSymbol;
  }
}
