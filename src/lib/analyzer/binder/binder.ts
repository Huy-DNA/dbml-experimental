import { SchemaSymbol } from '../symbol/symbols';

export default class Binder {
  private publicSchemaSymbol: SchemaSymbol;

  constructor(publicSchemaSymbol: SchemaSymbol) {
    this.publicSchemaSymbol = publicSchemaSymbol;
  }
}
