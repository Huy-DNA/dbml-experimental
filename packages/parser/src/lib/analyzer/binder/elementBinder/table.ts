import { ElementDeclarationNode } from '../../../parser/nodes';
import { ElementBinder } from '../types';
import { SyntaxToken } from '../../../lexer/tokens';
import { CompileError } from '../../../errors';

const KEYWORDS_OF_DEFAULT_SETTING = ['null', 'true', 'false'] as readonly string[];

export default class TableBinder implements ElementBinder {
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken; };

  constructor(declarationNode: ElementDeclarationNode & { type: SyntaxToken }) {
    this.declarationNode = declarationNode;
  }

  bind(): CompileError[] {
    return [];
  }
}
