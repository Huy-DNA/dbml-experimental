import { ElementDeclarationNode, SyntaxNode } from '../parser/nodes';
import { NodeSymbolIndex } from './symbol/symbolIndex';

export interface UnresolvedName {
  subnames: {
    index: NodeSymbolIndex;
    referrer: SyntaxNode;
  }[];
  ownerElement: ElementDeclarationNode;
}
