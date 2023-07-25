import { SyntaxToken } from "../lexer/tokens";

export interface SyntaxNode {
    kind: SyntaxNodeKind;
    start: number;
    end: number;
}

export enum SyntaxNodeKind {
    PROGRAM = '<program>',
    ELEMENT_DECLARATION = '<element-declaration>',
    FIELD_DECLARATION = '<field-declaration>',
    ATTRIBUTE = '<attribute>',

    LITERAL_EXPRESSION = '<literal-expression>',
    PREFIX_EXPRESSION = '<prefix-expression>',
    INFIX_EXPRESSION = '<infix-expression>',
    POSTFIX_EXPRESSION = '<postfix-expression>',
    FUNCTION_EXPRESSION = '<function-expression>',
    FUNCTION_APPLICATION = '<function-application>',
    BLOCK_EXPRESSION = '<block-expression>',
    LIST_EXPRESSION = '<list-expression>',
    TUPLE_EXPRESSION = '<tuple-expression>',
    CALL_EXPRESSION = '<call-expression>',
    PRIMARY_EXPRESSION = '<primary-expression>',
    GROUP_EXPRESSION = '<group-expression>',
    ACCESS_EXPRESSION = '<access-expression>',
}

export class ProgramNode implements SyntaxNode {
    kind: SyntaxNodeKind.PROGRAM = SyntaxNodeKind.PROGRAM;
    start: Readonly<number>;
    end: Readonly<number>;
    body: ElementDeclarationNode[];
    eof: SyntaxToken;
    invalid: SyntaxToken[];

    constructor({
        body,
        eof,
        invalid,
    }: {
        body: ElementDeclarationNode[];
        eof: SyntaxToken;
        invalid?: SyntaxToken[];
    }) {
        this.start = 0;
        this.end = eof.offset - 1;
        this.body = body;
        this.eof = eof;
        this.invalid = invalid ? invalid : [];
    }
}

export class ElementDeclarationNode implements SyntaxNode {
    kind: SyntaxNodeKind.ELEMENT_DECLARATION = SyntaxNodeKind.ELEMENT_DECLARATION;
    start: Readonly<number>;
    end: Readonly<number>;
    type: SyntaxToken;
    name: ExpressionNode;

    as?: SyntaxToken;
    alias?: PrimaryExpressionNode;

    attributeList?: ListExpressionNode;

    bodyOpenColon?: SyntaxToken;
    bodyOpenBrace?: SyntaxToken;
    body: (FieldDeclarationNode | ExpressionNode)[];
    bodyCloseBrace?: SyntaxToken;

    constructor({ 
        type,
        name,
        as,
        alias,
        attributeList,
        bodyOpenColon,
        bodyOpenBrace,
        body,
        bodyCloseBrace,
    }: {
        type: SyntaxToken;
        name: ExpressionNode;
        as?: SyntaxToken;
        alias?: PrimaryExpressionNode;
        attributeList?: ListExpressionNode;
        bodyOpenColon?: SyntaxToken;
        bodyOpenBrace?: SyntaxToken;
        body: (FieldDeclarationNode | ExpressionNode)[];
        bodyCloseBrace?: SyntaxToken;
    }) {
        this.start = type.offset;
        if (bodyCloseBrace) {
            this.end = bodyCloseBrace.offset;
        }
        else {
            this.end = body[body.length - 1].end;
        }
        this.type = type;
        this.name = name;
        this.as = as;
        this.alias = alias;
        this.attributeList = attributeList;
        this.bodyOpenColon = bodyOpenColon;
        this.bodyOpenBrace = bodyOpenBrace;
        this.body = body;
        this.bodyCloseBrace = bodyCloseBrace;
    }
}

export class FieldDeclarationNode implements SyntaxNode {
    kind: SyntaxNodeKind.FIELD_DECLARATION = SyntaxNodeKind.FIELD_DECLARATION;
    start: Readonly<number>;
    end: Readonly<number>;
    name: SyntaxToken;
    valueOpenColon: SyntaxToken;
    value: ExpressionNode;
    attributeList?: ListExpressionNode;

    constructor({
        name,
        valueOpenColon,
        value,
        attributeList,
    }: {
        name: SyntaxToken;
        valueOpenColon: SyntaxToken;
        value: ExpressionNode;
        attributeList?: ListExpressionNode;
    }) {
        this.start = name.offset;
        if (attributeList) {
            this.end = attributeList.end;
        }
        else {
            this.end = value.end;
        }
        this.name = name;
        this.valueOpenColon = valueOpenColon;
        this.value = value;
        this.attributeList = attributeList;
    }
}

export class AttributeNode implements SyntaxNode {
    kind: SyntaxNodeKind.ATTRIBUTE = SyntaxNodeKind.ATTRIBUTE;
    start: Readonly<number>;
    end: Readonly<number>;
    name: SyntaxToken[]
    valueOpenColon?: SyntaxToken;
    value?: ExpressionNode;

    constructor({
        name,
        valueOpenColon,
        value,
    }: {
        name: SyntaxToken[];
        valueOpenColon?: SyntaxToken;
        value?: ExpressionNode;
    }) {
        this.start = name[0].offset;
        if (value) {
            this.end = value.end;
        }
        else {
            const lastName = name[name.length - 1];
            this.end = lastName.offset + lastName.length - 1;
        }
        this.name = name;
        this.valueOpenColon = valueOpenColon;
        this.value = value;
    }
}

export type ExpressionNode = PrefixExpressionNode | InfixExpressionNode | PostfixExpressionNode | LiteralExpressionNode | FunctionApplicationNode | FunctionApplicationNode | BlockExpressionNode | ListExpressionNode | TupleExpressionNode | CallExpressionNode | PrimaryExpressionNode | FunctionExpressionNode | AccessExpressionNode;

export class AccessExpressionNode implements SyntaxNode {
    kind: SyntaxNodeKind.ACCESS_EXPRESSION = SyntaxNodeKind.ACCESS_EXPRESSION;
    start: Readonly<number>;
    end: Readonly<number>;
    container: ExpressionNode;
    dot: SyntaxToken;
    containee: ExpressionNode;

    constructor({
        container,
        dot,
        containee,
    }: {
        container: ExpressionNode,
        dot: SyntaxToken,
        containee: ExpressionNode,
    }) {
        this.start = container.start;
        this.end = containee.end;
        this.container = container;
        this.containee = containee;
        this.dot = dot;
    }
}

export class LiteralExpressionNode implements SyntaxNode {
    kind: SyntaxNodeKind.LITERAL_EXPRESSION = SyntaxNodeKind.LITERAL_EXPRESSION;
    start: Readonly<number>;
    end: Readonly<number>;
    type: SyntaxToken;
    bodyOpenBrace: SyntaxToken;
    body: (FieldDeclarationNode | ExpressionNode)[];
    bodyCloseBrace: SyntaxToken;

    constructor({
        type,
        bodyOpenBrace,
        body,
        bodyCloseBrace,
    }: {
        type: SyntaxToken;
        bodyOpenBrace: SyntaxToken;
        body: (FieldDeclarationNode | ExpressionNode)[];
        bodyCloseBrace: SyntaxToken;
    }) {
        this.start = type.offset;
        this.end = bodyOpenBrace.offset;
        this.type = type;
        this.bodyOpenBrace = bodyOpenBrace;
        this.body = body;
        this.bodyCloseBrace = bodyCloseBrace;
    }
}

export class PrefixExpressionNode implements SyntaxNode {
    kind: SyntaxNodeKind.PREFIX_EXPRESSION = SyntaxNodeKind.PREFIX_EXPRESSION; 
    start: Readonly<number>;
    end: Readonly<number>;
    op: SyntaxToken;
    expression: ExpressionNode;

    constructor({
        op,
        expression,
    }: {
        op: SyntaxToken;
        expression: ExpressionNode;
    }) {
        this.start = op.offset;
        this.end = expression.end;
        this.op = op;
        this.expression = expression;
    }
}

export class InfixExpressionNode implements SyntaxNode {
    kind: SyntaxNodeKind.INFIX_EXPRESSION = SyntaxNodeKind.INFIX_EXPRESSION;
    start: Readonly<number>;
    end: Readonly<number>;
    op: SyntaxToken;
    leftExpression: ExpressionNode;
    rightExpression: ExpressionNode;
    
    constructor({
        op,
        leftExpression,
        rightExpression,
    }: {
        op: SyntaxToken;
        leftExpression: ExpressionNode;
        rightExpression: ExpressionNode;
    }) {
        this.start = leftExpression.start;
        this.end = rightExpression.end;
        this.op = op;
        this.leftExpression = leftExpression;
        this.rightExpression = rightExpression;
    }
}

export class PostfixExpressionNode implements SyntaxNode {
    kind: SyntaxNodeKind.POSTFIX_EXPRESSION = SyntaxNodeKind.POSTFIX_EXPRESSION;
    start: Readonly<number>;
    end: Readonly<number>;
    op: SyntaxToken;
    expression: ExpressionNode;
    
    constructor({
        op,
        expression,
    }: {
        op: SyntaxToken;
        expression: ExpressionNode;
    }) {
        this.start = expression.start;
        this.end = op.offset;
        this.op = op;
        this.expression = expression;
    }
}

export class FunctionExpressionNode implements SyntaxNode {
    kind: SyntaxNodeKind.FUNCTION_EXPRESSION = SyntaxNodeKind.FUNCTION_EXPRESSION;
    start: Readonly<number>;
    end: Readonly<number>;
    value: SyntaxToken;

    constructor({
        value,
    }: {
        value: SyntaxToken;
    }) {
        this.start = value.offset;
        this.end = value.offset + value.length - 1;
        this.value = value;
    }
}

export class FunctionApplicationNode implements SyntaxNode {
    kind: SyntaxNodeKind.FUNCTION_APPLICATION = SyntaxNodeKind.FUNCTION_APPLICATION;
    start: Readonly<number>;
    end: Readonly<number>;
    callee: TupleExpressionNode | ListExpressionNode |  BlockExpressionNode | PrimaryExpressionNode | CallExpressionNode | FunctionExpressionNode;
    arguments: (TupleExpressionNode | ListExpressionNode | BlockExpressionNode | PrimaryExpressionNode | CallExpressionNode | FunctionExpressionNode)[];

    constructor({
        callee,
        arguments: _arguments,
    }: {
        callee: TupleExpressionNode | ListExpressionNode |  BlockExpressionNode | PrimaryExpressionNode | CallExpressionNode | FunctionExpressionNode;
        arguments: (TupleExpressionNode | ListExpressionNode | BlockExpressionNode | PrimaryExpressionNode | CallExpressionNode | FunctionExpressionNode)[];
    }) {
        this.start = callee.start;
        if (_arguments.length === 0) {
            this.end = callee.end;
        }
        else {
            this.end = _arguments[_arguments.length - 1].end;
        }
        this.callee = callee;
        this.arguments = _arguments;
    }
}

export class BlockExpressionNode implements SyntaxNode {
    kind: SyntaxNodeKind.BLOCK_EXPRESSION = SyntaxNodeKind.BLOCK_EXPRESSION;
    start: Readonly<number>;
    end: Readonly<number>;
    blockOpenBrace: SyntaxToken;
    body: ExpressionNode[];
    blockCloseBrace: SyntaxToken;
    
    constructor({
        blockOpenBrace,
        body,
        blockCloseBrace,
    }: {
        blockOpenBrace: SyntaxToken;
        body: ExpressionNode[];
        blockCloseBrace: SyntaxToken;
    }) {
        this.start = blockOpenBrace.offset;
        this.end = blockCloseBrace.offset;
        this.blockOpenBrace = blockOpenBrace;
        this.body = body;
        this.blockCloseBrace = blockCloseBrace;
    }
}

export class ListExpressionNode implements SyntaxNode {
    kind: SyntaxNodeKind.LIST_EXPRESSION = SyntaxNodeKind.LIST_EXPRESSION;
    start: Readonly<number>;
    end: Readonly<number>;
    listOpenBracket: SyntaxToken;
    elementList: AttributeNode[];
    commaList: SyntaxToken[];
    listCloseBracket: SyntaxToken;

    constructor({
        listOpenBracket,
        elementList,
        commaList,
        listCloseBracket,
    }: {
        listOpenBracket: SyntaxToken,
        elementList: AttributeNode[],
        commaList: SyntaxToken[],
        listCloseBracket: SyntaxToken,
    }) {
        this.start = listOpenBracket.offset;
        this.end = listCloseBracket.offset;
        this.listOpenBracket = listOpenBracket;
        this.elementList = elementList;
        this.commaList = commaList;
        this.listCloseBracket = listCloseBracket;
    }
}

export class TupleExpressionNode implements SyntaxNode {
    kind: SyntaxNodeKind.TUPLE_EXPRESSION | SyntaxNodeKind.GROUP_EXPRESSION = SyntaxNodeKind.TUPLE_EXPRESSION;
    start: Readonly<number>;
    end: Readonly<number>;

    tupleOpenParen: SyntaxToken;
    elementList: ExpressionNode[];
    commaList: SyntaxToken[];
    tupleCloseParen: SyntaxToken;

    constructor({
        tupleOpenParen,
        elementList,
        commaList,
        tupleCloseParen,
    }: {
        tupleOpenParen: SyntaxToken;
        elementList: ExpressionNode[];
        commaList: SyntaxToken[];
        tupleCloseParen: SyntaxToken;
    }) {
        this.start = tupleOpenParen.offset;
        this.end = tupleCloseParen.offset;
        this.tupleOpenParen = tupleOpenParen;
        this.elementList = elementList;
        this.commaList = commaList;
        this.tupleCloseParen = tupleCloseParen;
    }
}

export class GroupExpressionNode extends TupleExpressionNode {
    kind: SyntaxNodeKind.GROUP_EXPRESSION = SyntaxNodeKind.GROUP_EXPRESSION;
    constructor({
        groupOpenParen,
        expression,
        groupCloseParen,
    }: {
        groupOpenParen: SyntaxToken,
        expression: ExpressionNode,
        groupCloseParen: SyntaxToken,
    }) {
        super({
            tupleOpenParen: groupOpenParen,
            elementList: [expression],
            commaList: [],
            tupleCloseParen: groupCloseParen
        });
    }
}

export class CallExpressionNode implements SyntaxNode {
    kind: SyntaxNodeKind.CALL_EXPRESSION = SyntaxNodeKind.CALL_EXPRESSION;
    start: Readonly<number>;
    end: Readonly<number>;
    callee: ExpressionNode;
    argumentListOpenParen: SyntaxToken;
    arguments: ExpressionNode[];
    commaList: SyntaxToken[];
    argumentListCloseParen: SyntaxToken;

    constructor({
        callee,
        argumentListOpenParen,
        arguments: _arguments,
        commaList,
        argumentListCloseParen,
    }: {
        callee: ExpressionNode;
        argumentListOpenParen: SyntaxToken;
        arguments: ExpressionNode[];
        commaList: SyntaxToken[];
        argumentListCloseParen: SyntaxToken;
    }) {
        this.start = callee.start;
        this.end = argumentListCloseParen.offset;
        this.callee = callee;
        this.argumentListOpenParen = argumentListOpenParen;
        this.arguments = _arguments;
        this.commaList = commaList;
        this.argumentListCloseParen = argumentListCloseParen;
    }
}

export class PrimaryExpressionNode implements SyntaxNode {
    kind: SyntaxNodeKind.PRIMARY_EXPRESSION = SyntaxNodeKind.PRIMARY_EXPRESSION; 
    start: Readonly<number>;
    end: Readonly<number>;
    expression: SyntaxToken;
    constructor({
        expression
    }: {
        expression: SyntaxToken;
    }) {
        this.start = expression.offset;
        this.end = expression.offset + expression.length - 1;
        this.expression = expression;
    }
}