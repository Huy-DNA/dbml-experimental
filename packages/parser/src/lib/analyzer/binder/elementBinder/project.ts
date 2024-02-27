import { SyntaxToken } from '../../../lexer/tokens';
import { ElementBinder } from '../types';
import { ElementDeclarationNode } from '../../../parser/nodes';
import { CompileError } from '../../../errors';

export default class ProjectBinder implements ElementBinder {
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken; };

  constructor(declarationNode: ElementDeclarationNode & { type: SyntaxToken }) {
    this.declarationNode = declarationNode;
  }

  bind(): CompileError[] {
    return [];
  }
}
