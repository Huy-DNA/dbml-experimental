import Validator from './validator/validator';
import Binder from './binder';
import { ProgramNode } from '../parser/nodes';
import Report from '../report';
import { CompileError } from '../errors';

export default class Analyzer {
  private ast: ProgramNode;

  constructor(ast: ProgramNode) {
    this.ast = ast;
  }

  analyze(): Report<ProgramNode, CompileError> {
    const validator = new Validator(this.ast);

    return validator.validate().chain(({ program, schema }) => new Report(program, []));
  }
}
