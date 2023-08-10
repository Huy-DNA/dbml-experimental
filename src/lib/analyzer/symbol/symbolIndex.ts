export type NodeSymbolId = string;

export function createSchemaSymbolId(key: string): NodeSymbolId {
  return `schema:${key}`;
}

export function createTableSymbolId(key: string): NodeSymbolId {
  return `table:${key}`;
}

export function createColumnSymbolId(key: string): NodeSymbolId {
  return `column:${key}`;
}

export function createEnumSymbolId(key: string): NodeSymbolId {
  return `enum:${key}`;
}

export function createEnumElementSymbolId(key: string): NodeSymbolId {
  return `enum-element:${key}`;
}

export function createTableGroupSymbolId(key: string): NodeSymbolId {
  return `tablegroup:${key}`;
}

export function TableGroupElementSymbolId(key: string): NodeSymbolId {
  return `tablegroup-element:${key}`;
}
