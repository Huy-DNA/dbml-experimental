import { CompileError } from '../../../errors';
import { ElementBinder } from '../types';
import { ElementDeclarationNode } from '../../../parser/nodes';
import { SyntaxToken } from '../../../lexer/tokens';

export default class NoteBinder implements ElementBinder {
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken; };

  constructor(declarationNode: ElementDeclarationNode & { type: SyntaxToken }) {
    this.declarationNode = declarationNode;
  }

  bind(): CompileError[] {
    return [];
  }
}
