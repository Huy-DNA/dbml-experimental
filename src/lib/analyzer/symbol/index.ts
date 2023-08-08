import { ElementDeclarationNode, ExpressionNode } from '../../parser/nodes';
import EntryMap from './entryMap';
import {
  ColumnEntry,
  EnumElementEntry,
  EnumEntry,
  EnumSymbolTable,
  SchemaEntry,
  TableEntry,
  TableSymbolTable,
  SchemaSymbolTable,
  SymbolTable,
  TableGroupEntry,
} from './symbolTable';

export function createSchemaEntry(entryMap: EntryMap, symbolTable: SchemaSymbolTable): SchemaEntry {
  const schemaEntry = new SchemaEntry(symbolTable);

  return schemaEntry;
}

export function createEnumEntry(
  entryMap: EntryMap,
  declarationNode: ElementDeclarationNode,
  symbolTable: EnumSymbolTable,
): EnumEntry {
  const enumEntry = new EnumEntry(declarationNode, symbolTable);
  entryMap.set(declarationNode, enumEntry);

  return enumEntry;
}

export function createTableEntry(
  entryMap: EntryMap,
  declarationNode: ElementDeclarationNode,
  symbolTable: TableSymbolTable,
): TableEntry {
  const tableEntry = new TableEntry(declarationNode, symbolTable);
  entryMap.set(declarationNode, tableEntry);

  return tableEntry;
}

export function createEnumElementEntry(
  entryMap: EntryMap,
  declarationNode: ExpressionNode,
): EnumElementEntry {
  const enumElementEntry = new EnumElementEntry(declarationNode);
  entryMap.set(declarationNode, enumElementEntry);

  return enumElementEntry;
}

export function createColumnEntry(
  entryMap: EntryMap,
  declarationNode: ExpressionNode,
): ColumnEntry {
  const columnEntry = new ColumnEntry(declarationNode);
  entryMap.set(declarationNode, columnEntry);

  return columnEntry;
}

export function createTableGroupEntry(
  entryMap: EntryMap,
  declarationNode: ElementDeclarationNode,
): TableGroupEntry {
  const tableGroupEntry = new TableGroupEntry(declarationNode);
  entryMap.set(declarationNode, tableGroupEntry);

  return tableGroupEntry;
}

export {
 SymbolTable, EntryMap, EnumSymbolTable, TableSymbolTable, SchemaSymbolTable,
};
