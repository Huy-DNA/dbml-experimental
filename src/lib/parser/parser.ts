import { ParsingError, ParsingErrorCode } from "../errors";
import { SyntaxToken, SyntaxTokenKind, isOpToken } from "../lexer/tokens";
import { Result } from "../result";
import { AttributeNode, BlockExpressionNode, CallExpressionNode, ElementDeclarationNode, ExpressionNode, FieldDeclarationNode, FunctionApplicationNode, FunctionExpressionNode, GroupExpressionNode, InfixExpressionNode, InvalidExpressionNode, ListExpressionNode, LiteralNode, NormalFormExpressionNode, PostfixExpressionNode, PrefixExpressionNode, PrimaryExpressionNode, ProgramNode, SyntaxNode, SyntaxNodeKind, TupleExpressionNode, ValidFunctionApplicationArgumentNode, VariableNode } from "./nodes";

export class Parser {
    private tokens: SyntaxToken[];
    private current: number = 0;
    private errors: ParsingError[] = [];

    constructor(tokens: SyntaxToken[]) {
        this.tokens = tokens;
    }

    private isAtEnd(): boolean {
        return this.current >= this.tokens.length;
    }

    private init() {
        this.current = 0;
        this.errors = [];
    }

    private advance(): SyntaxToken {
        return this.tokens[this.current++];
    }

    private peek(lookahead: number = 0): SyntaxToken | undefined {
        if (lookahead + this.current >= this.tokens.length) {
            return undefined;
        }
        return this.tokens[this.current + lookahead];
    }

    private match(...kind: SyntaxTokenKind[]): boolean {
        const checkRes = this.check(...kind);
        if (checkRes) {
            this.advance();
        }
        return checkRes;
    }

    private check(...kind: SyntaxTokenKind[]): boolean {
        const currentToken = this.peek();
        if (!currentToken) {
            return false;
        }
        return kind.includes(currentToken.kind);
    }

    private previous(): SyntaxToken {
        return this.tokens[this.current - 1];
    }

    private consume(message: string, ...kind: SyntaxTokenKind[]) {
        if (!this.match(...kind)) {
            const invalidToken = this.peek()!;
            throw new ParsingError(ParsingErrorCode.EXPECTED_THINGS, message, invalidToken.offset, invalidToken.offset + invalidToken.length - 1);
        }
    }

    parse(): Result<SyntaxNode & { kind: SyntaxNodeKind.PROGRAM }> {
        const body: ElementDeclarationNode[] = [];
        const invalid: SyntaxToken[] = [];

        this.init();

        while (this.peek() && this.peek()?.kind !== SyntaxTokenKind.EOF) {
            try {
                body.push(this.elementDeclaration());
            } catch (e) {
                if (!(e instanceof ParsingError))
                    throw e;
                this.errors.push(e);
                invalid.push(this.advance());
            }
        }

        const eof = this.advance();
        const program = new ProgramNode({ body, eof, invalid });

        return new Result(program, this.errors);        
    }

    private elementDeclaration(): ElementDeclarationNode {
        this.consume("Expect keyword", SyntaxTokenKind.KEYWORD);
        const type = this.previous();
        let name: NormalFormExpressionNode | undefined = undefined;
        let as: SyntaxToken | undefined = undefined;
        let alias: PrimaryExpressionNode | undefined = undefined;

        if (this.peek()?.kind !== SyntaxTokenKind.COLON && this.peek()?.kind !== SyntaxTokenKind.LBRACE) {
            name = this.normalFormExpression(false);

            const nextWord = this.peek();
            if (nextWord?.kind === SyntaxTokenKind.KEYWORD && nextWord?.value === 'as') {
                as = this.advance();
                alias = this.primaryExpression();
            }
        }

        let attributeList: ListExpressionNode | undefined = undefined;
        if (this.check(SyntaxTokenKind.LBRACKET)) {
            attributeList = this.listExpression();
        }
        
        let body: (ExpressionNode | FieldDeclarationNode)[] = [];
        let bodyOpenColon: SyntaxToken | undefined = undefined;
        let bodyOpenBrace: SyntaxToken | undefined = undefined;
        let bodyCloseBrace: SyntaxToken | undefined = undefined;
        if (this.match(SyntaxTokenKind.COLON)) {
            bodyOpenColon = this.previous();
            body = [this.normalFormExpression(true)];
        }
        else {
            this.consume("Expect { or :", SyntaxTokenKind.LBRACE);
            bodyOpenBrace = this.previous();
            while (!this.isAtEnd() && this.peek()!.kind !== SyntaxTokenKind.RBRACE) {
                if (this.canBeField()) {
                    body.push(this.fieldDeclaration());
                }
                else {
                    body.push(this.expression());
                }
            }
            this.consume("Expect }", SyntaxTokenKind.RBRACE);
            bodyCloseBrace = this.previous();
        }

        return new ElementDeclarationNode({
            type,
            name,
            as,
            alias,
            attributeList,
            bodyOpenColon,
            bodyOpenBrace,
            body,
            bodyCloseBrace,
        })
    }

    private fieldDeclaration(): FieldDeclarationNode {
        this.consume("Expect a keyword", SyntaxTokenKind.KEYWORD);
        const name = this.previous();
        this.consume("Expect :", SyntaxTokenKind.COLON);
        const valueOpenColon = this.previous(); 
        const value = this.normalFormExpression(false);
        let attributeList: ListExpressionNode | undefined = undefined;
        if (this.check(SyntaxTokenKind.LBRACKET)) {
            attributeList = this.listExpression();
        }
        return new FieldDeclarationNode({ name, valueOpenColon, value, attributeList });
    }


    private expression(): ExpressionNode {
        const _arguments: ValidFunctionApplicationArgumentNode[] = [];

        let callee: ExpressionNode = this.normalFormExpression(false);
        
        if (this.hasTrailingNewLines(this.previous())) {
            return callee;
        }

        if (!this.isValidFunctionApplicationComponent(callee)) {
            this.errors.push(new ParsingError(ParsingErrorCode.INVALID, "Invalid expression in function application. Try wrapping the expression in a parenthese pair.", callee.start, callee.end));
            callee = new InvalidExpressionNode({ expression: callee });
        }

        let previousComponent: ExpressionNode = callee;
        let previousToken = this.previous();
        
        while (!this.hasTrailingNewLines(previousToken)) {
            if (!this.hasTrailingSpaces(previousToken)) {
                this.errors.push(new ParsingError(ParsingErrorCode.EXPECTED_THINGS, "Expect a following space", previousComponent.start, previousComponent.end));
            }
            previousComponent = this.normalFormExpression(false);
            if (!this.isValidFunctionApplicationComponent(previousComponent)) {
                this.errors.push(new ParsingError(ParsingErrorCode.INVALID, "Invalid expression in this context. Try wrapping the expression in a parenthese pair.", callee.start, callee.end));
                previousComponent = new InvalidExpressionNode({ expression: previousComponent });
            }
            _arguments.push(previousComponent);
            previousToken = this.previous();
        }

        return new FunctionApplicationNode({ callee: callee, arguments: _arguments });

    }

    private normalFormExpression(matchLine: boolean): NormalFormExpressionNode {
        const expression = this.expression_bp(0);
        if (matchLine && !this.isAtEndOfLine(this.previous())) {
            throw new ParsingError(ParsingErrorCode.INVALID, "The expression is expected to span the whole line", expression.start, expression.end);
        }

        return expression;
    }

    private expression_bp(mbp: number): NormalFormExpressionNode {
        let leftExpression: NormalFormExpressionNode | undefined = undefined;

        if (isOpToken(this.peek()) && this.peek()!.kind !== SyntaxTokenKind.LPAREN) {
            const prefixOp = this.peek()!;
            const opPrefixPower = prefix_binding_power(prefixOp);

            if (opPrefixPower.right === null) {
                throw new ParsingError(ParsingErrorCode.UNEXPECTED_THINGS, `Unexpected ${prefixOp.value} in an expression`, prefixOp.offset, prefixOp.offset + prefixOp.length - 1);
            }

            this.throwOnTrailingNewLines(prefixOp);
            this.throwOnTrailingSpaceViolation(prefixOp);

            this.advance();
            const prefixExpression = this.expression_bp(opPrefixPower.right);
            leftExpression = new PrefixExpressionNode({ op: prefixOp, expression: prefixExpression });
        }
        else {
            leftExpression = this.extractOperand();
        }

        while (!this.isAtEnd() && !this.hasTrailingNewLines(this.previous())) {
            const c = this.peek()!;
            if (!isOpToken(c)) {
                break;
            }
            else {
                const beforeOp = this.previous();
                const op = c;
                const opPostfixPower = postfix_binding_power(op);

                if (opPostfixPower.left !== null) {
                    if (opPostfixPower.left <= mbp) {
                        break;
                    }
                    
                    if (this.violatePrecedingSpaces(beforeOp, op)) {
                        break;
                    }
                    this.throwOnTrailingSpaceViolation(op);

                    this.advance();

                    if (op.kind === SyntaxTokenKind.LPAREN) {
                        const args = this.argumentList();
                        this.consume("Expect )", SyntaxTokenKind.RPAREN);
                        leftExpression = new CallExpressionNode({
                            callee: leftExpression,
                            argumentListOpenParen: op,
                            argumentListCloseParen: this.previous(),
                            ...args,
                        });
                        continue;
                    }

                    leftExpression = new PostfixExpressionNode({ expression: leftExpression!, op: op });
                }
                else {
                    const opInfixPower = infix_binding_power(op);
                    if (opInfixPower.left === null || opInfixPower.left <= mbp) {
                        break;
                    }

                    this.throwOnTrailingNewLines(op);

                    if (this.violatePrecedingSpaces(beforeOp, op)) {
                        break;
                    }
                    this.throwOnTrailingSpaceViolation(op);

                    this.advance();
                    const rightExpression = this.expression_bp(opInfixPower.right);
                    leftExpression = new InfixExpressionNode({ leftExpression: leftExpression!, op, rightExpression });
                }
            }
        }
        return leftExpression;
    }

    private argumentList(): {
        arguments: NormalFormExpressionNode[],
        commaList: SyntaxToken[],
    } {
        const _arguments: NormalFormExpressionNode[] = [];
        const commaList: SyntaxToken[] = [];

        if (!this.check(SyntaxTokenKind.RPAREN)) {
            _arguments.push(this.normalFormExpression(false));
        }

        while (!this.check(SyntaxTokenKind.RPAREN)) {
            this.consume("Expect ,", SyntaxTokenKind.COMMA);
            commaList.push(this.previous());
            _arguments.push(this.normalFormExpression(false));
        }

        return {
            arguments: _arguments,
            commaList,
        };
    }

    private extractOperand(): PrimaryExpressionNode | ListExpressionNode | BlockExpressionNode | TupleExpressionNode | FunctionExpressionNode | GroupExpressionNode {
        if (this.check(SyntaxTokenKind.NUMERIC_LITERAL, SyntaxTokenKind.STRING_LITERAL, SyntaxTokenKind.COLOR_LITERAL, SyntaxTokenKind.QUOTED_STRING, SyntaxTokenKind.IDENTIFIER, SyntaxTokenKind.KEYWORD)) {
            return this.primaryExpression();
        }

        if (this.check(SyntaxTokenKind.FUNCTION_EXPRESSION)) {
            return this.functionExpression();
        }

        if (this.check(SyntaxTokenKind.LBRACKET)) {
            return this.listExpression();
        }

        if (this.check(SyntaxTokenKind.LBRACE)) {
            return this.blockExpression();
        }

        if (this.check(SyntaxTokenKind.LPAREN)) {
            return this.tupleExpression();
        }

        const nextToken = this.peek()!;
        throw new ParsingError(ParsingErrorCode.UNEXPECTED_THINGS, `Invalid start of operand "${nextToken.value}"`, nextToken.offset, nextToken.offset + nextToken.length - 1);
    }

    private functionExpression(): FunctionExpressionNode {
        this.consume("Expect a function expression", SyntaxTokenKind.FUNCTION_EXPRESSION);
        return new FunctionExpressionNode({ value: this.previous() });
    }
    
    private blockExpression(): BlockExpressionNode {
        let blockOpenBrace: SyntaxToken | undefined = undefined;
        const body: ExpressionNode[] = [];
        let blockCloseBrace: SyntaxToken | undefined = undefined;

        this.consume("Expect {", SyntaxTokenKind.LBRACE);
        blockOpenBrace = this.previous();
        while (!this.check(SyntaxTokenKind.RBRACE)) {
            body.push(this.expression());
        }
        this.consume("Expect }", SyntaxTokenKind.RBRACE);
        blockCloseBrace = this.previous();

        return new BlockExpressionNode({ blockOpenBrace , body, blockCloseBrace });
    }

    private primaryExpression(): PrimaryExpressionNode {
        if (this.match(SyntaxTokenKind.COLOR_LITERAL, SyntaxTokenKind.STRING_LITERAL, SyntaxTokenKind.NUMERIC_LITERAL)) {
            return new PrimaryExpressionNode({ expression: new LiteralNode({ literal: this.previous() })});
        }
        if (this.match(SyntaxTokenKind.QUOTED_STRING, SyntaxTokenKind.IDENTIFIER, SyntaxTokenKind.KEYWORD)) {
            return new PrimaryExpressionNode({ expression: new VariableNode({ variable: this.previous() })});
        }
        const c = this.peek()!;
        throw new ParsingError(ParsingErrorCode.EXPECTED_THINGS, "Expect a variable or literal", c.offset, c.offset + c.length - 1);
    } 


    private tupleExpression(): TupleExpressionNode | GroupExpressionNode {
        let tupleOpenParen: SyntaxToken | undefined = undefined;
        const elementList: NormalFormExpressionNode[] = [];
        const commaList: SyntaxToken[] = [];
        let tupleCloseParen: SyntaxToken | undefined = undefined; 

        this.consume("Expect (", SyntaxTokenKind.LPAREN);
        tupleOpenParen = this.previous();
        if (!this.check(SyntaxTokenKind.RPAREN)) {
            elementList.push(this.normalFormExpression(false));
        }
        while (!this.check(SyntaxTokenKind.RPAREN)) {
            this.consume("Expect ,", SyntaxTokenKind.COMMA);
            commaList.push(this.previous());
            elementList.push(this.normalFormExpression(false));
        }
        this.consume("Expect )", SyntaxTokenKind.RPAREN);
        tupleCloseParen = this.previous();

        if (commaList.length === 0) {
            return new GroupExpressionNode({ 
                groupOpenParen: tupleOpenParen,
                expression: elementList[0],
                groupCloseParen: tupleCloseParen,
            })
        }
        return new TupleExpressionNode({ tupleOpenParen, elementList, commaList, tupleCloseParen });
    }

    private listExpression(): ListExpressionNode {
        let listOpenBracket: SyntaxToken | undefined = undefined;
        const elementList: AttributeNode[] = [];
        const commaList: SyntaxToken[] = [];
        let listCloseBracket: SyntaxToken | undefined = undefined;

        this.consume("Expect a [", SyntaxTokenKind.LBRACKET);
        listOpenBracket = this.previous();

        if (!this.check(SyntaxTokenKind.RBRACKET)) {
            elementList.push(this.attribute());
        }

        while (!this.check(SyntaxTokenKind.RBRACKET)) {
            this.consume("Expect a ,", SyntaxTokenKind.COMMA);
            commaList.push(this.previous());
            elementList.push(this.attribute());
        }

        this.consume("Expect a ]", SyntaxTokenKind.RBRACKET);
        listCloseBracket = this.previous();

        return new ListExpressionNode({ listOpenBracket, elementList, commaList, listCloseBracket });
    }

    private attribute(): AttributeNode {
        const name: SyntaxToken[] = [];
        let valueOpenColon: SyntaxToken | undefined = undefined;
        let value: NormalFormExpressionNode | undefined = undefined;

        this.consume("Expect an identifier", SyntaxTokenKind.IDENTIFIER);
        name.push(this.previous());
        while (this.match(SyntaxTokenKind.IDENTIFIER)) {
            name.push(this.previous());
        }
        if (this.match(SyntaxTokenKind.COLON)) {
            valueOpenColon = this.previous();
            value = this.normalFormExpression(false);
        }
        return new AttributeNode({ name, valueOpenColon, value });
    }

    private canBeField() {
        return this.peek()?.kind === SyntaxTokenKind.KEYWORD && this.peek(1)?.kind === SyntaxTokenKind.COLON;
    }

    private throwOnTrailingNewLines(token: SyntaxToken) {
        if (this.hasTrailingNewLines(token)) {
            throw new ParsingError(ParsingErrorCode.UNEXPECTED_THINGS, "Unexpected newlines", token.offset, token.offset + token.length - 1);
        }
    }

    private hasTrailingWhiteSpaces(token: SyntaxToken): boolean {
        return token.trailingTrivia.find(({ kind }) => {
            return kind === SyntaxTokenKind.SPACE || kind === SyntaxTokenKind.NEWLINE;
        }) !== undefined;
    }

    private isAtEndOfLine(token: SyntaxToken): boolean {
        return this.hasTrailingNewLines(token) || this.peek()?.kind === SyntaxTokenKind.EOF;
    }

    private hasTrailingSpaces(token: SyntaxToken): boolean {
        return token.trailingTrivia.find(({ kind }) => {
            return kind === SyntaxTokenKind.SPACE;
        }) !== undefined;
    }

    private hasTrailingNewLines(token: SyntaxToken): boolean {
        return token.trailingTrivia.find(({ kind }) => {
            return kind === SyntaxTokenKind.NEWLINE;
        }) !== undefined;
    }

    private isValidFunctionApplicationComponent(expression: ExpressionNode): expression is ValidFunctionApplicationArgumentNode {
        return expression instanceof TupleExpressionNode || 
               expression instanceof ListExpressionNode ||
               expression instanceof PrimaryExpressionNode ||
               expression instanceof CallExpressionNode ||
               expression instanceof BlockExpressionNode ||
               expression instanceof FunctionExpressionNode ||
               expression instanceof GroupExpressionNode;
    }

    private throwOnTrailingSpaceViolation(op: SyntaxToken) { 
        if (this.hasTrailingSpaces(op) && !allow_trailing_spaces(op)) {
            throw new ParsingError(ParsingErrorCode.UNEXPECTED_THINGS, `Unexpected spaces after ${op.value}`, op.offset, op.offset + op.length - 1);
        } 
    }

    private violatePrecedingSpaces(previousToken: SyntaxToken, op: SyntaxToken): boolean {
        if (!this.hasTrailingNewLines(previousToken) && this.hasTrailingSpaces(previousToken) && !allow_preceding_spaces(op)) {
            return true;
        }

        return false;
    }
}

const infix_binding_power_map: {
    [index: string]: { left: number, right: number } | undefined;
} = {
    [SyntaxTokenKind.CROSS]: { left: 9, right: 10 },
    [SyntaxTokenKind.ASTERISK]: { left: 11, right: 12 },
    [SyntaxTokenKind.MINUS]: { left: 9, right: 10 },
    [SyntaxTokenKind.FORWARDSLASH]: { left: 11, right: 12 },
    [SyntaxTokenKind.PERCENT]: { left: 11, right: 12 },
    [SyntaxTokenKind.LT]: { left: 7, right: 8 },
    [SyntaxTokenKind.LE]: { left: 7, right: 8 },
    [SyntaxTokenKind.GT]: { left: 7, right: 8 },
    [SyntaxTokenKind.GE]: { left: 7, right: 8 },
    [SyntaxTokenKind.EQUAL]: { left: 2, right: 3 },
    [SyntaxTokenKind.DOUBLE_EQUAL]: { left: 4, right: 5},
    [SyntaxTokenKind.NOT_EQUAL]: { left: 4, right: 5 },
    [SyntaxTokenKind.DOT]: { left: 17, right: 16 },
}

function infix_binding_power(token: SyntaxToken): { left: null, right: null } | { left: number, right: number } {
    const power = infix_binding_power_map[token.kind];
    return power ? power : { left: null, right: null };
}

const prefix_binding_power_map: {
    [index: string]: { left: null, right: number } | undefined;
} = {
    [SyntaxTokenKind.CROSS]: { left: null, right: 15 },
    [SyntaxTokenKind.MINUS]: { left: null, right: 15 },
    [SyntaxTokenKind.LT]: { left: null, right: 15 },
    [SyntaxTokenKind.GT]: { left: null, right: 15 },
    [SyntaxTokenKind.EXCLAMATION]: { left: null, right: 15 }, 
}

function prefix_binding_power(token: SyntaxToken): { left: null, right: null | number } {
    const power = prefix_binding_power_map[token.kind];
    return power ? power : { left: null, right: null };
}

const postfix_binding_power_map: {
    [index: string]: { left: number, right: null } | undefined;
} = {
    [SyntaxTokenKind.LPAREN]: { left: 14, right: null },
}

function postfix_binding_power(token: SyntaxToken): { left: null | number, right: null } {
    const power = postfix_binding_power_map[token.kind];
    return power ? power : { left: null, right: null };
}

function allow_preceding_spaces(token: SyntaxToken): boolean {
    switch (token.kind) {
        case SyntaxTokenKind.DOT:
        case SyntaxTokenKind.LPAREN:
            return false;
        default:
            return true;
    }
}

function allow_trailing_spaces(token: SyntaxToken): boolean {
    switch (token.kind) {
        case SyntaxTokenKind.DOT:
            return false;
        default:
            return true;
    }
}