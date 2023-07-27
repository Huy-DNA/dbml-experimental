export const enum ParsingContext {
    ListExpression,
    GroupExpression,
}

export class ParsingContextStack {
    private stack: ParsingContext[] = [];
    private numberOfNestedLParens = 0;
    private numberOfNestedLBrackets = 0;

    push(ctx: ParsingContext) {
        this.stack.push(ctx);
        if (ctx === ParsingContext.ListExpression) {
            ++this.numberOfNestedLBrackets;
        }
        if (ctx === ParsingContext.GroupExpression) {
            ++this.numberOfNestedLParens;
        }
    }

    pop(): ParsingContext | undefined {
        const top = this.stack.pop();
        if (top === ParsingContext.ListExpression) {
            --this.numberOfNestedLBrackets;
        }
        if (top === ParsingContext.GroupExpression) {
            --this.numberOfNestedLParens;
        }
        return top;
    }

    isWithinGroupExpressionContext(): boolean {
        return this.numberOfNestedLParens > 0;
    }

    isWithinListExpressionContext(): boolean {
        return this.numberOfNestedLBrackets > 0;
    }
}