import _, { forEach } from 'lodash';
import {
 BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, ProgramNode, SyntaxNode,
} from '../../../parser/nodes';
import { ElementBinder } from '../types';
import { SyntaxToken } from '../../../lexer/tokens';
import { CompileError } from '../../../errors';
import { lookupAndBindInScope, pickBinder, scanNonListNodeForBinding } from '../utils';
import { aggregateSettingList } from '../../validator/utils';
import { SymbolKind } from '../../symbol/symbolIndex';

export default class TableBinder implements ElementBinder {
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken; };
  private ast: ProgramNode;

 constructor(declarationNode: ElementDeclarationNode & { type: SyntaxToken }, ast: ProgramNode) {
    this.declarationNode = declarationNode;
    this.ast = ast;
  }

  bind(): CompileError[] {
    if (!(this.declarationNode.body instanceof BlockExpressionNode)) {
      return [];
    }

    return this.bindBody(this.declarationNode.body);
  }

  private bindBody(body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) {
      return [];
    }
    if (body instanceof FunctionApplicationNode) {
      return this.bindFields([body]);
    }

    const [fields, subs] = _.partition(body.body, (e) => e instanceof FunctionApplicationNode);

    return [...this.bindFields(fields as FunctionApplicationNode[]), ...this.bindSubElements(subs as ElementDeclarationNode[])];
  }

  private bindFields(fields: FunctionApplicationNode[]): CompileError[] {
    return fields.flatMap((field) => {
      if (field.args.length === 0 && !(field.callee instanceof ListExpressionNode)) {
        return [];
      }
      if (!(_.last(field.args) instanceof ListExpressionNode)) {
        return [];
      }
      const listExpression = (_.last(field.args) || field.callee) as ListExpressionNode;
      const settingsMap = aggregateSettingList(listExpression).getValue();

      return settingsMap['ref']?.flatMap((ref) => (ref.value ? this.bindInlineRef(ref.value) : [])) || [];
    });
  }

  private bindInlineRef(ref: SyntaxNode): CompileError[] {
    const bindees = scanNonListNodeForBinding(ref);

    return bindees.flatMap((bindee) => {
      const columnBindee = bindee.variables.pop();
      const tableBindee = bindee.variables.pop();
      if (!columnBindee || !tableBindee) {
        return [];
      }
      const schemaBindees = bindee.variables;

      return lookupAndBindInScope(this.ast, [
        ...schemaBindees.map((b) => ({ node: b, kind: SymbolKind.Schema })),
        { node: tableBindee, kind: SymbolKind.Table },
        { node: columnBindee, kind: SymbolKind.Column },
      ]);
    });
  }

  private bindSubElements(subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      if (!sub.type) {
        return [];
      }
      const _Binder = pickBinder(sub as ElementDeclarationNode & { type: SyntaxToken });
      const binder = new _Binder(sub as ElementDeclarationNode & { type: SyntaxToken }, this.ast);

      return binder.bind();
    });
  }
}
