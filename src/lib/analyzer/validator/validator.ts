import Report from '../../report';
import { CompileError } from '../../errors';
import { ProgramNode } from '../../parser/nodes';
import { ContextStack } from './validatorContext';
import { SchemaSymbolTable, SchemaEntry } from '../symbol/symbolTable';
import { SchemaSymbol } from '../symbol/symbols';
import { pickValidator } from './utils';
import { ElementKind } from './types';

export default class Validator {
  private ast: ProgramNode;

  private globalSchema: SchemaSymbolTable;

  private contextStack: ContextStack;

  private kindsGloballyFound: Set<ElementKind>;
  private kindsLocallyFound: Set<ElementKind>;

  private errors: CompileError[];

  constructor(ast: ProgramNode) {
    this.ast = ast;
    this.contextStack = new ContextStack();
    this.errors = [];
    this.globalSchema = new SchemaSymbolTable();
    this.kindsGloballyFound = new Set();
    this.kindsLocallyFound = new Set();
    const publicSymbol = new SchemaSymbol('public');
    this.globalSchema.set(publicSymbol, new SchemaEntry(this.globalSchema));
  }

  validate(): Report<{ program: ProgramNode; schema: SchemaSymbolTable }, CompileError> {
    this.ast.body.forEach((element) => {
      const Val = pickValidator(element);
      const validatorObject = new Val(
        element,
        this.globalSchema,
        this.contextStack,
        this.errors,
        this.kindsGloballyFound,
        this.kindsLocallyFound,
      );
      validatorObject.validate();
    });

    return new Report({ program: this.ast, schema: this.globalSchema }, this.errors);
  }
}
