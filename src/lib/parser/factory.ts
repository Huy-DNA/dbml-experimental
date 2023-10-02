import { SyntaxNode, SyntaxNodeId, SyntaxNodeIdGenerator } from './nodes';

export default class NodeFactory {
  private generator: SyntaxNodeIdGenerator;

  constructor(generator: SyntaxNodeIdGenerator) {
    this.generator = generator;
  }

  create<T extends SyntaxNode, A>(
    Type: { new (args: A, id: SyntaxNodeId, isInvalid: boolean): T },
    args: A,
    isInvalid: boolean,
  ): T {
    return new Type(args, this.generator.nextId(), isInvalid);
  }
}
