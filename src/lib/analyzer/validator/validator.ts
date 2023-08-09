import Report from '../../report';
import { CompileError } from '../../errors';
import { ProgramNode } from '../../parser/nodes';
import { ContextStack } from './validatorContext';
import { SchemaSymbolTable, SchemaEntry } from '../symbol/symbolTable';
import { SchemaSymbol } from '../symbol/symbols';
import { pickValidator } from './elementValidators/utils';
import { ElementKind } from './elementValidators/elementValidator';

export default class Validator {
  private ast: ProgramNode;

  private globalSchema: SchemaSymbolTable;

  private contextStack: ContextStack;

  private uniqueKindsFound: Set<ElementKind>;

  private errors: CompileError[];

  constructor(ast: ProgramNode) {
    this.ast = ast;
    this.contextStack = new ContextStack();
    this.errors = [];
    this.globalSchema = new SchemaSymbolTable();
    this.uniqueKindsFound = new Set();
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
        this.uniqueKindsFound,
      );
      validatorObject.validate();
    });

    return new Report({ program: this.ast, schema: this.globalSchema }, this.errors);
  }
}
