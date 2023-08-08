export abstract class NodeSymbol {
  static kind: string = 'unknown';

  protected key: string;

  constructor(key: string) {
    this.key = key;
  }

  asKey(): string {
    return `${this.constructor.prototype.kind}:${this.key}`;
  }
}

export class TableSymbol extends NodeSymbol {
  static kind: string = 'table';

  constructor(tableName: string) {
    super(tableName);
  }
}

export class EnumSymbol extends NodeSymbol {
  static kind = 'enum';

  constructor(enumName: string) {
    super(enumName);
  }
}

export class SchemaSymbol extends NodeSymbol {
  static kind = 'schema';

  constructor(schemaName: string) {
    super(schemaName);
  }
}

export class ColumnSymbol extends NodeSymbol {
  static kind = 'column';

  constructor(columnName: string) {
    super(columnName);
  }
}

export class EnumElementSymbol extends NodeSymbol {
  static kind = 'enum-element';

  constructor(elementName: string) {
    super(elementName);
  }
}

export class TableGroupSymbol extends NodeSymbol {
  static kind = 'table-group';

  constructor(tableGroupName: string) {
    super(tableGroupName);
  }
}
