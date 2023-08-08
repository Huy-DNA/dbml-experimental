import { SyntaxNode } from '../../parser/nodes';
import { SymbolTableEntry } from './symbolTable';

export default class EntryMap {
  private map: Map<SyntaxNode, SymbolTableEntry> = new Map();

  get(node: SyntaxNode): SymbolTableEntry | undefined {
    return this.map.get(node);
  }

  set(node: SyntaxNode, entry: SymbolTableEntry) {
    this.map.set(node, entry);
  }

  has(node: SyntaxNode): boolean {
    return this.map.has(node);
  }
}
