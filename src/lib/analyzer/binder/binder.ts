import { CompileError, CompileErrorCode } from '../../errors';
import { ProgramNode, SyntaxNode } from '../../parser/nodes';
import { UnresolvedName } from '../types';
import Report from '../../report';
import { destructureIndex } from '../symbol/symbolIndex';
import { findSymbol } from '../utils';

export default class Binder {
  private ast: ProgramNode;

  private unresolvedNames: UnresolvedName[];

  private errors: CompileError[];

  constructor(ast: ProgramNode, unresolvedNames: UnresolvedName[]) {
    this.ast = ast;
    this.unresolvedNames = unresolvedNames;
    this.errors = [];
  }

  resolve(): Report<ProgramNode, CompileError> {
    // eslint-disable-next-line no-restricted-syntax
    for (const name of this.unresolvedNames) {
      this.resolveName(name);
    }

    return new Report(this.ast, this.errors);
  }

  private resolveName({ subnames, ownerElement }: UnresolvedName) {
    if (subnames.length === 0) {
      throw new Error('Unreachable - An unresolved name must have at least one name component');
    }
    const [accessSubname, ...remainingSubnames] = subnames;
    const accessSymbol = findSymbol(accessSubname.index, ownerElement);
    if (accessSymbol === undefined) {
      const { kind, name } = destructureIndex(accessSubname.index).unwrap();
      this.logError(accessSubname.referrer, `Can not find ${kind} '${name}'`);

      return;
    }

    accessSymbol.references.push(accessSubname.referrer);
    accessSubname.referrer.referee = accessSymbol;

    let prevScope = accessSymbol.symbolTable!;
    let { kind: prevKind, name: prevName } = destructureIndex(accessSubname.index).unwrap();
    // eslint-disable-next-line no-restricted-syntax
    for (const subname of remainingSubnames) {
      const { kind: curKind, name: curName } = destructureIndex(subname.index).unwrap();
      const curSymbol = prevScope.get(subname.index);

      if (!curSymbol) {
        this.logError(
          subname.referrer,
          `${prevKind} '${prevName}' does not have ${curKind} '${curName}'`,
        );

        return;
      }

      prevKind = curKind;
      prevName = curName;
      subname.referrer.referee = curSymbol;
      curSymbol.references.push(subname.referrer);
      if (!curSymbol.symbolTable) {
        break;
      }
      prevScope = curSymbol.symbolTable;
    }
  }

  protected logError(node: SyntaxNode, message: string) {
    this.errors.push(new CompileError(CompileErrorCode.BINDING_ERROR, message, node));
  }
}
