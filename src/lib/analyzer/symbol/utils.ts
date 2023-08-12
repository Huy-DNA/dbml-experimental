import { SyntaxNode } from '../../parser/nodes';
import { ValidatorContext } from '../validator/validatorContext';
import {
  NodeSymbolId,
  createColumnSymbolId,
  createEnumElementSymbolId,
  createEnumSymbolId,
  createTableGroupSymbolId,
  createTableSymbolId,
} from './symbolIndex';
import SymbolTable from './symbolTable';
import {
  ColumnSymbol,
  EnumElementSymbol,
  EnumSymbol,
  NodeSymbol,
  TableGroupElementSymbol,
  TableGroupSymbol,
  TableSymbol,
} from './symbols';

export function createIdFromContext(
  name: string,
  context: ValidatorContext,
): NodeSymbolId | undefined {
  switch (context) {
    case ValidatorContext.TableContext:
      return createTableSymbolId(name);
    case ValidatorContext.EnumContext:
      return createEnumSymbolId(name);
    case ValidatorContext.TableGroupContext:
      return createTableGroupSymbolId(name);
    default:
      return undefined;
  }
}

export function createSubfieldId(
  name: string,
  context: ValidatorContext,
): NodeSymbolId | undefined {
  switch (context) {
    case ValidatorContext.TableContext:
      return createColumnSymbolId(name);
    case ValidatorContext.EnumContext:
      return createEnumElementSymbolId(name);
    case ValidatorContext.TableGroupContext:
      return createTableGroupSymbolId(name);
    default:
      return undefined;
  }
}

export function createSymbolFromContext(
  declaration: SyntaxNode,
  context: ValidatorContext,
): NodeSymbol | undefined {
  switch (context) {
    case ValidatorContext.TableContext:
      return new TableSymbol(new SymbolTable(), declaration);
    case ValidatorContext.EnumContext:
      return new EnumSymbol(new SymbolTable(), declaration);
    case ValidatorContext.TableGroupContext:
      return new TableGroupSymbol(new SymbolTable(), declaration);
    default:
      return undefined;
  }
}

export function createSubfieldSymbol(
  declaration: SyntaxNode,
  context: ValidatorContext,
): NodeSymbol | undefined {
  switch (context) {
    case ValidatorContext.TableContext:
      return new ColumnSymbol(declaration);
    case ValidatorContext.EnumContext:
      return new EnumElementSymbol(declaration);
    case ValidatorContext.TableGroupContext:
      return new TableGroupElementSymbol(declaration);
    default:
      return undefined;
  }
}
