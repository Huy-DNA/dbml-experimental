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
  constructor(enumName: string) {
    super(enumName);
  }

  asKey(): string {
    return `enum:${this.key}`;
  }
}

export class SchemaSymbol extends NodeSymbol {
  constructor(schemaName: string) {
    super(schemaName);
  }

  asKey(): string {
    return `schema:${this.key}`;
  }
}

export class ColumnSymbol extends NodeSymbol {
  constructor(columnName: string) {
    super(columnName);
  }

  asKey(): string {
    return `column:${this.key}`;
  }
}

export class EnumElementSymbol extends NodeSymbol {
  constructor(elementName: string) {
    super(elementName);
  }

  asKey(): string {
    return `enum-element:${this.key}`;
  }
}

export class TableGroupSymbol extends NodeSymbol {
  constructor(tableGroupName: string) {
    super(tableGroupName);
  }

  asKey(): string {
    return `tablegroup:${this.key}`;
  }
}

export class TableGroupElementSymbol extends NodeSymbol {
  constructor(tableGroupElementName: string) {
    super(tableGroupElementName);
  }

  asKey(): string {
    return `tablegroup-element:${this.key}`;
  }
}
