import { ParsingError, ParsingErrorCode } from "../errors";
import { SyntaxToken, SyntaxTokenKind, isOpToken } from "../lexer/tokens";
import { Result } from "../result";
import { ParsingContext, ParsingContextStack } from "./contextStack";
import { AttributeNode, BlockExpressionNode, CallExpressionNode, ElementDeclarationNode, ExpressionNode, FieldDeclarationNode, FunctionApplicationNode, FunctionExpressionNode, GroupExpressionNode, InfixExpressionNode, ListExpressionNode, LiteralNode, NormalFormExpressionNode, PostfixExpressionNode, PrefixExpressionNode, PrimaryExpressionNode, ProgramNode, SyntaxNode, SyntaxNodeKind, TupleExpressionNode, VariableNode } from "./nodes";

export class Parser {
    private tokens: SyntaxToken[];
    private current: number = 0;
    private errors: ParsingError[] = [];
    private contextStack: ParsingContextStack = new ParsingContextStack();

    constructor(tokens: SyntaxToken[]) {
        this.tokens = tokens;
    }

    private isAtEnd(): boolean {
        return this.current >= this.tokens.length || this.tokens[this.current].kind === SyntaxTokenKind.EOF;
    }

    private init() {
        this.current = 0;
        this.errors = [];
        this.contextStack = new ParsingContextStack();
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
            throw new ParsingError(ParsingErrorCode.EXPECTED_THINGS, message, invalidToken.offset, invalidToken.offset + invalidToken.length);
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
                if (!(this.peek()?.kind === SyntaxTokenKind.EOF)) {
                    invalid.push(this.advance());
                }
                else {
                    const eof = this.peek()!;
                    this.errors.push(new ParsingError(ParsingErrorCode.INVALID, "Unexpected EOF", eof.offset, eof.offset + 1));
                }
            }
        }

        const eof = this.advance();
        const program = new ProgramNode({ body, eof, invalid });

        return new Result(program, this.errors);        
    }

    private elementDeclaration(): ElementDeclarationNode {
        this.consume("Expect identifier", SyntaxTokenKind.IDENTIFIER);
        const type = this.previous();
        let name: NormalFormExpressionNode | undefined = undefined;
        let as: SyntaxToken | undefined = undefined;
        let alias: NormalFormExpressionNode | undefined = undefined;

        if (this.peek()?.kind !== SyntaxTokenKind.COLON && this.peek()?.kind !== SyntaxTokenKind.LBRACE) {
            try {
                name = this.normalFormExpression();
            }
            catch (e) {
                this.synchronizeElementDeclarationName(e);
            }

            const nextWord = this.peek();
            if (nextWord?.kind === SyntaxTokenKind.IDENTIFIER && nextWord?.value === 'as') {
                as = this.advance();
                try {
                    alias = this.normalFormExpression();
                }
                catch (e) {
                    this.synchronizeElementDeclarationAlias(e);
                }
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
        
        if (!this.check(SyntaxTokenKind.COLON, SyntaxTokenKind.LBRACE)) {
            const token = this.peek()!;
            this.errors.push(new ParsingError(ParsingErrorCode.EXPECTED_THINGS, "Expect { or :", token.offset, token.offset + token.length));
            while (!this.isAtEnd() && !this.check(SyntaxTokenKind.COLON, SyntaxTokenKind.LBRACE)) {
                this.advance();
            }
        }

        if (this.match(SyntaxTokenKind.COLON)) {
            bodyOpenColon = this.previous();
            body = [this.normalFormExpression()];
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

    synchronizeElementDeclarationName(e: unknown) {
        if (!(e instanceof ParsingError)) {
            throw e;
        }
        this.errors.push(e);

        while (!this.isAtEnd()) {
            const token = this.peek()!;
            if (token.kind === SyntaxTokenKind.IDENTIFIER && token.value === 'as'
             || token.kind === SyntaxTokenKind.LBRACE 
             || token.kind === SyntaxTokenKind.COLON) {
                break;
            }
            this.advance();
        }
    }

    synchronizeElementDeclarationAlias(e: unknown) {
        if (!(e instanceof ParsingError)) {
            throw e;
        }
        this.errors.push(e);
        
        while (!this.isAtEnd()) {
            const token = this.peek()!;
            if (token.kind === SyntaxTokenKind.LBRACE || token.kind === SyntaxTokenKind.COLON) {
                break;
            }
            this.advance();
        }
    }

    synchronizeElementDeclarationBody(e: unknown) {
        if (!(e instanceof ParsingError)) {
            throw e;
        }
        this.errors.push(e);

        while (!this.isAtEnd()) {
            const token = this.peek()!;
            if (token.kind === SyntaxTokenKind.RBRACE || token.kind === SyntaxTokenKind.COLON || this.isAtStartOfLine(this.previous(), token)) {
                break;
            }
            this.advance();
        }
    }

    private fieldDeclaration(): FieldDeclarationNode {
        this.consume("Expect identifier", SyntaxTokenKind.IDENTIFIER);
        const name = this.previous();
        this.consume("Expect :", SyntaxTokenKind.COLON);
        const valueOpenColon = this.previous(); 
        const value = this.normalFormExpression();
        let attributeList: ListExpressionNode | undefined = undefined;
        if (this.check(SyntaxTokenKind.LBRACKET)) {
            attributeList = this.listExpression();
        }
        return new FieldDeclarationNode({ name, valueOpenColon, value, attributeList });
    }


    private expression(): ExpressionNode {
        const _arguments: ExpressionNode[] = [];

        const callee: ExpressionNode = this.normalFormExpression();
        
        if (this.hasTrailingNewLines(this.previous())) {
            return callee;
        } 

        let previousComponent: ExpressionNode = callee;
        let previousToken = this.previous();
        
        while (!this.isAtEnd() && !this.hasTrailingNewLines(previousToken)) {
            if (!this.hasTrailingSpaces(previousToken)) {
                this.errors.push(new ParsingError(ParsingErrorCode.EXPECTED_THINGS, "Expect a following space", previousComponent.start, previousComponent.end));
            }
            previousComponent = this.normalFormExpression();
            _arguments.push(previousComponent);
            previousToken = this.previous();
        }

        return new FunctionApplicationNode({ callee: callee, arguments: _arguments });

    }

    private normalFormExpression(): NormalFormExpressionNode {
        const expression = this.expression_bp(0);
        return expression;
    }

    private expression_bp(mbp: number): NormalFormExpressionNode {
        let leftExpression: NormalFormExpressionNode | undefined = undefined;

        if (isOpToken(this.peek()) && this.peek()!.kind !== SyntaxTokenKind.LPAREN) {
            const prefixOp = this.peek()!;
            const opPrefixPower = prefix_binding_power(prefixOp);

            if (opPrefixPower.right === null) {
                throw new ParsingError(ParsingErrorCode.UNEXPECTED_THINGS, `Unexpected prefix ${prefixOp.value} in an expression`, prefixOp.offset, prefixOp.offset + prefixOp.length + 1);
            }

            this.advance();
            const prefixExpression = this.expression_bp(opPrefixPower.right);
            leftExpression = new PrefixExpressionNode({ op: prefixOp, expression: prefixExpression });
        }
        else {
            leftExpression = this.extractOperand();
        }

        while (!this.isAtEnd()) {
            const c = this.peek()!;
            if (!isOpToken(c)) {
                break;
            }
            else {
                const previousOp = this.previous();
                const op = c;
                const opPostfixPower = postfix_binding_power(op);

                if (opPostfixPower.left !== null) {
                    if (opPostfixPower.left <= mbp) {
                        break;
                    }

                    if (op.kind === SyntaxTokenKind.LPAREN) {
                        if (this.isAtStartOfLine(previousOp, op) && !this.contextStack.isWithinGroupExpressionContext() && !this.contextStack.isWithinGroupExpressionContext()) {
                            break;
                        }
                        const argumentList = this.tupleExpression();
                        leftExpression = new CallExpressionNode({
                            callee: leftExpression,
                            argumentList,
                        });
                        continue;
                    }

                    this.advance();

                    leftExpression = new PostfixExpressionNode({ expression: leftExpression!, op: op });
                }
                else {
                    const opInfixPower = infix_binding_power(op);
                    if (opInfixPower.left === null || opInfixPower.left <= mbp) {
                        break;
                    }

                    this.advance();
                    const rightExpression = this.expression_bp(opInfixPower.right);
                    leftExpression = new InfixExpressionNode({ leftExpression: leftExpression!, op, rightExpression });
                }
            }
        }
        return leftExpression;
    }

    private extractOperand(): PrimaryExpressionNode | ListExpressionNode | BlockExpressionNode | TupleExpressionNode | FunctionExpressionNode | GroupExpressionNode {
        if (this.check(SyntaxTokenKind.NUMERIC_LITERAL, SyntaxTokenKind.STRING_LITERAL, SyntaxTokenKind.COLOR_LITERAL, SyntaxTokenKind.QUOTED_STRING, SyntaxTokenKind.IDENTIFIER)) {
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
        throw new ParsingError(ParsingErrorCode.UNEXPECTED_THINGS, `Invalid start of operand "${nextToken.value}"`, nextToken.offset, nextToken.offset + nextToken.length);
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
            try {
                body.push(this.expression());
            }
            catch (e) {
                this.synchronizeBlock(e);
            }
        }
        this.consume("Expect }", SyntaxTokenKind.RBRACE);
        blockCloseBrace = this.previous();

        return new BlockExpressionNode({ blockOpenBrace , body, blockCloseBrace });
    }

    synchronizeBlock(e: unknown) {
        if (!(e instanceof ParsingError)) {
            throw e;
        }
        this.errors.push(e);

        while (!this.isAtEnd()) {
            const token = this.peek()!;
            if (token.kind === SyntaxTokenKind.RBRACE || this.isAtStartOfLine(this.previous(), token)) {
                break;
            }
            this.advance();
        }    
    }

    private primaryExpression(): PrimaryExpressionNode {
        if (this.match(SyntaxTokenKind.COLOR_LITERAL, SyntaxTokenKind.STRING_LITERAL, SyntaxTokenKind.NUMERIC_LITERAL)) {
            return new PrimaryExpressionNode({ expression: new LiteralNode({ literal: this.previous() })});
        }
        if (this.match(SyntaxTokenKind.QUOTED_STRING, SyntaxTokenKind.IDENTIFIER)) {
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

        this.contextStack.push(ParsingContext.GroupExpression);

        if (!this.check(SyntaxTokenKind.RPAREN)) {
            elementList.push(this.normalFormExpression());
        }
        while (!this.check(SyntaxTokenKind.RPAREN)) {
            this.consume("Expect ,", SyntaxTokenKind.COMMA);
            commaList.push(this.previous());
            try {
                elementList.push(this.normalFormExpression());
            }
            catch (e) {
                this.synchronizeTuple(e);
            }
        }
        this.consume("Expect )", SyntaxTokenKind.RPAREN);
        tupleCloseParen = this.previous();

        this.contextStack.pop();

        if (elementList.length === 1) {
            return new GroupExpressionNode({ 
                groupOpenParen: tupleOpenParen,
                expression: elementList[0],
                groupCloseParen: tupleCloseParen,
            })
        }
        return new TupleExpressionNode({ tupleOpenParen, elementList, commaList, tupleCloseParen });
    }
    
    synchronizeTuple(e: unknown) {
        if (!(e instanceof ParsingError)) {
            throw e;
        }
        this.errors.push(e);

        while (!this.isAtEnd()) {
            const token = this.peek()!;
            if (token.kind === SyntaxTokenKind.RPAREN || this.isAtStartOfLine(this.previous(), token)) {
                break;
            }
            this.advance();
        }    
    }

    private listExpression(): ListExpressionNode {
        let listOpenBracket: SyntaxToken | undefined = undefined;
        const elementList: AttributeNode[] = [];
        const commaList: SyntaxToken[] = [];
        let listCloseBracket: SyntaxToken | undefined = undefined;
        const separator = SyntaxTokenKind.COMMA;
        const closing = SyntaxTokenKind.RBRACKET;

        this.consume("Expect a [", SyntaxTokenKind.LBRACKET);
        listOpenBracket = this.previous();

        this.contextStack.push(ParsingContext.ListExpression);

        if (!this.check(SyntaxTokenKind.RBRACKET)) {
            elementList.push(this.attribute(closing, separator));
        }

        while (!this.check(SyntaxTokenKind.RBRACKET)) {
            this.consume("Expect a ,", SyntaxTokenKind.COMMA);
            commaList.push(this.previous());
            elementList.push(this.attribute(closing, separator));
        }

        this.consume("Expect a ]", SyntaxTokenKind.RBRACKET);
        listCloseBracket = this.previous();

        this.contextStack.pop();

        return new ListExpressionNode({ listOpenBracket, elementList, commaList, listCloseBracket });
    }

    private attribute(closing?: SyntaxTokenKind, separator?: SyntaxTokenKind): AttributeNode {
        const name: SyntaxToken[] = [];
        let valueOpenColon: SyntaxToken | undefined = undefined;
        let value: NormalFormExpressionNode | undefined = undefined;

        if (this.check(SyntaxTokenKind.COLON) || closing && separator && this.check(closing, separator)) {
            const token = this.peek()!;
            this.errors.push(new ParsingError(ParsingErrorCode.INVALID, "Expect a non-empty attribute name", token.offset, token.offset + token.length));
        }
        
        while (!this.isAtEnd() && !this.check(SyntaxTokenKind.COLON) && (!closing || !separator || !this.check(closing, separator))) {
            try {
                this.consume("Expect an identifier", SyntaxTokenKind.IDENTIFIER);
                name.push(this.previous());
            }
            catch (e) {
                this.synchronizeAttributeName(e);
            }
        }

        if (this.match(SyntaxTokenKind.COLON)) {
            valueOpenColon = this.previous();
            try {
                value = this.normalFormExpression();
            }
            catch (e) {
                this.synchronizeAttributeValue(e);
            }
        }

        while (!this.isAtEnd() && closing && separator && !this.check(closing, separator)) {
            const invalidToken = this.advance();
            this.errors.push(new ParsingError(ParsingErrorCode.UNEXPECTED_THINGS, "Unexpected token", invalidToken.offset, invalidToken.offset + invalidToken.length));
        }

        return new AttributeNode({ name, valueOpenColon, value });
    }

    synchronizeAttributeName(e: unknown) {
        if (!(e instanceof ParsingError)) {
            throw e;
        }
        this.errors.push(e);

        while (!this.isAtEnd()) {
            const token = this.peek()!;
            if (token.kind === SyntaxTokenKind.COMMA || token.kind === SyntaxTokenKind.RBRACKET || token.kind === SyntaxTokenKind.COLON) {
                break;
            }
            this.advance();
        }    
    }

    synchronizeAttributeValue(e: unknown) {
        if (!(e instanceof ParsingError)) {
            throw e;
        }
        this.errors.push(e);

        while (!this.isAtEnd()) {
            const token = this.peek()!;
            if (token.kind === SyntaxTokenKind.COMMA || token.kind === SyntaxTokenKind.RBRACKET) {
                break;
            }
            this.advance();
        }    
    }

    private canBeField() {
        return this.peek()?.kind === SyntaxTokenKind.IDENTIFIER && this.peek(1)?.kind === SyntaxTokenKind.COLON;
    }

    private isAtEndOfLine(token: SyntaxToken): boolean {
        return this.hasTrailingNewLines(token) || this.peek()?.kind === SyntaxTokenKind.EOF;
    }

    private hasTrailingNewLines(token: SyntaxToken): boolean {
        return token.trailingTrivia.find(({ kind }) => kind === SyntaxTokenKind.NEWLINE) !== undefined;
    }

    private isAtStartOfLine(previous: SyntaxToken, token: SyntaxToken): boolean {
        const hasLeadingNewLines = token.leadingTrivia.find(({ kind }) => kind === SyntaxTokenKind.NEWLINE) !== undefined;
        return hasLeadingNewLines || this.hasTrailingNewLines(previous);
    }

    private hasTrailingSpaces(token: SyntaxToken): boolean {
        return token.trailingTrivia.find(({ kind }) => kind === SyntaxTokenKind.SPACE) !== undefined;
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
    [SyntaxTokenKind.DOT]: { left: 16, right: 17 },
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