export abstract class NodeSymbol {
  protected key: string;

  constructor(key: string) {
    this.key = key;
  }

  abstract asKey(): string;
}

export class TableSymbol extends NodeSymbol {
  constructor(tableName: string) {
    super(tableName);
  }

  asKey(): string {
    return `table:${this.key}`;
  }
}

export class EnumSymbol extends NodeSymbol {
  static kind = 'enum';

  constructor(enumName: string) {
    super(enumName);
  }

  asKey(): string {
    return `enum:${this.key}`;
  }
}

export class SchemaSymbol extends NodeSymbol {
  static kind = 'schema';

  constructor(schemaName: string) {
    super(schemaName);
  }

  asKey(): string {
    return `schema:${this.key}`;
  }
}

export class ColumnSymbol extends NodeSymbol {
  static kind = 'column';

  constructor(columnName: string) {
    super(columnName);
  }

  asKey(): string {
    return `column:${this.key}`;
  }
}

export class EnumElementSymbol extends NodeSymbol {
  static kind = 'enum-element';

  constructor(elementName: string) {
    super(elementName);
  }

  asKey(): string {
    return `enum-element:${this.key}`;
  }
}

export class TableGroupSymbol extends NodeSymbol {
  static kind = 'table-group';

  constructor(tableGroupName: string) {
    super(tableGroupName);
  }

  asKey(): string {
    return `tablegroup:${this.key}`;
  }
}
