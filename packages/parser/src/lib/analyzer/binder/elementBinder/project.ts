import _ from 'lodash';
import { SyntaxToken } from '../../../lexer/tokens';
import { ElementBinder } from '../types';
import { BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode } from '../../../parser/nodes';
import { CompileError } from '../../../errors';
import { pickBinder } from '../utils';

export default class ProjectBinder implements ElementBinder {
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken; };

  constructor(declarationNode: ElementDeclarationNode & { type: SyntaxToken }) {
    this.declarationNode = declarationNode;
  }

  bind(): CompileError[] {
    return [];
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
    return [];
  }

  private bindSubElements(subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      if (!sub.type) {
        return [];
      }
      const _Binder = pickBinder(sub as ElementDeclarationNode & { type: SyntaxToken });
      const binder = new _Binder(sub as ElementDeclarationNode & { type: SyntaxToken });

      return binder.bind();
    });
  }
}
