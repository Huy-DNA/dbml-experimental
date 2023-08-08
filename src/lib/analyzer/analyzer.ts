import Binder from './binder';
import Validator from './validator/validator';
import { ProgramNode } from '../parser/nodes';
import Report from '../report';
import { CompileError } from '../errors';
import { EntryMap, SchemaSymbolTable, createSchemaEntry } from './symbol';
import { SchemaSymbol } from './symbol/symbols';

export default class Analyzer {
  private nodeMap: EntryMap;

  private symbolTable: SchemaSymbolTable;

  private validator: Validator;

  private binder: Binder;

  private ast: ProgramNode;

  constructor(ast: ProgramNode) {
    this.nodeMap = new EntryMap();
    this.symbolTable = new SchemaSymbolTable();
    this.validator = new Validator(this.nodeMap, this.symbolTable);
    this.binder = new Binder(this.symbolTable);
    this.ast = ast;

    const publicSchema = createSchemaEntry(this.nodeMap, this.symbolTable);
    this.symbolTable.set(new SchemaSymbol('public'), publicSchema);
  }

  analyze(): Report<ProgramNode, CompileError> {
    return this.validator.tryRegister(this.ast);
  }
}
