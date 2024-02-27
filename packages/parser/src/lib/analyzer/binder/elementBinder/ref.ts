import { ElementDeclarationNode } from '../../../parser/nodes';
import { ElementBinder } from '../types';
import { SyntaxToken } from '../../../lexer/tokens';
import { CompileError } from '../../../errors';

export default class RefBinder implements ElementBinder {
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken; };

  constructor(declarationNode: ElementDeclarationNode & { type: SyntaxToken }) {
    this.declarationNode = declarationNode;
  }

  bind(): CompileError[] {
    return [];
  }
}
