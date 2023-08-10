import Report from '../../report';
import { CompileError } from '../../errors';
import { ProgramNode } from '../../parser/nodes';
import { ContextStack } from './validatorContext';
import { SchemaSymbol } from '../symbol/symbols';
import { pickValidator } from './utils';
import { ElementKind } from './types';
import { createSchemaSymbolId } from '../symbol/symbolIndex';
import SymbolTable from '../symbol/symbolTable';

export default class Validator {
  private ast: ProgramNode;

  private publicSchemaSymbol: SchemaSymbol;

  private contextStack: ContextStack;

  private kindsGloballyFound: Set<ElementKind>;
  private kindsLocallyFound: Set<ElementKind>;

  private errors: CompileError[];

  constructor(ast: ProgramNode) {
    this.ast = ast;
    this.contextStack = new ContextStack();
    this.errors = [];
    this.publicSchemaSymbol = new SchemaSymbol(new SymbolTable());
    this.kindsGloballyFound = new Set();
    this.kindsLocallyFound = new Set();

    this.publicSchemaSymbol.symbolTable.set(
      createSchemaSymbolId('public'),
      this.publicSchemaSymbol,
    );
  }

  validate(): Report<{ program: ProgramNode; schema: SchemaSymbol }, CompileError> {
    this.ast.body.forEach((element) => {
      const Val = pickValidator(element);
      const validatorObject = new Val(
        element,
        this.publicSchemaSymbol,
        this.contextStack,
        this.errors,
        this.kindsGloballyFound,
        this.kindsLocallyFound,
      );
      validatorObject.validate();
    });

    return new Report({ program: this.ast, schema: this.publicSchemaSymbol }, this.errors);
  }
}
