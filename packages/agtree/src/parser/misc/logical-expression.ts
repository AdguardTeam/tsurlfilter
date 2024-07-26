/* eslint-disable no-param-reassign */
/* eslint-disable max-classes-per-file */
import { StringUtils } from '../../utils/string';
import {
    BinaryTypeMap,
    type AnyExpressionNode,
    type AnyOperator,
    type ExpressionParenthesisNode,
    type ExpressionVariableNode,
    type ExpressionOperatorNode,
} from '../common';
import {
    AMPERSAND,
    CLOSE_PARENTHESIS,
    EXCLAMATION_MARK,
    NULL,
    OPEN_PARENTHESIS,
    PIPE,
    UNDERSCORE,
} from '../../utils/constants';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { defaultParserOptions } from '../options';
import { ParserBase } from '../interface';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { isUndefined } from '../../utils/type-guards';

/**
 * Property map for binary serialization.
 */
const enum VariableNodeBinaryPropMap {
    Name = 1,
    FrequentName,
    Start,
    End,
}

/**
 * Property map for binary serialization.
 */
const enum OperatorNodeBinaryPropMap {
    Operator = 1,
    Left,
    Right,
    Start,
    End,
}

/**
 * Property map for binary serialization.
 */
const enum ParenthesisNodeBinaryPropMap {
    Expression = 1,
    Start,
    End,
}

/**
 * Possible operators in the logical expression.
 */
export const enum OperatorValue {
    Not = '!',
    And = '&&',
    Or = '||',
}

/**
 * Possible token types in the logical expression.
 */
const enum TokenType {
    Variable,
    Operator,
    Parenthesis,
}

/**
 * Possible node types in the logical expression.
 */
export const enum NodeType {
    Variable = 'Variable',
    Operator = 'Operator',
    Parenthesis = 'Parenthesis',
}

/**
 * Precedence of the operators, larger number means higher precedence.
 */
const OPERATOR_PRECEDENCE = {
    [OperatorValue.Not]: 3,
    [OperatorValue.And]: 2,
    [OperatorValue.Or]: 1,
};

const OPERATOR_BINARY_MAP = new Map<AnyOperator, number>([
    [OperatorValue.Not, 0],
    [OperatorValue.And, 1],
    [OperatorValue.Or, 2],
]);

const OPERATOR_BINARY_MAP_REVERSE = new Map<number, AnyOperator>(
    Array.from(OPERATOR_BINARY_MAP).map(([key, value]) => [value, key]),
);

/**
 * Gets the string representation of the operator from the binary representation.
 *
 * @param binary Binary representation of the operator
 * @returns String representation of the operator
 * @throws If the operator is unknown
 */
const getOperatorOrFail = (binary: number): AnyOperator => {
    const operator = OPERATOR_BINARY_MAP_REVERSE.get(binary);
    if (isUndefined(operator)) {
        throw new Error(`Unknown operator: ${binary}`);
    }
    return operator;
};

/**
 * Serialization map for known variables.
 */
const KNOWN_VARIABLES_MAP = new Map<string, number>([
    ['ext_abp', 0],
    ['ext_ublock', 1],
    ['ext_ubol', 2],
    ['ext_devbuild', 3],
    ['env_chromium', 4],
    ['env_edge', 5],
    ['env_firefox', 6],
    ['env_mobile', 7],
    ['env_safari', 8],
    ['env_mv3', 9],
    ['false', 10],
    ['cap_html_filtering', 11],
    ['cap_user_stylesheet', 12],
    ['adguard', 13],
    ['adguard_app_windows', 14],
    ['adguard_app_mac', 15],
    ['adguard_app_android', 16],
    ['adguard_app_ios', 17],
    ['adguard_ext_safari', 18],
    ['adguard_ext_chromium', 19],
    ['adguard_ext_firefox', 20],
    ['adguard_ext_edge', 21],
    ['adguard_ext_opera', 22],
    ['adguard_ext_android_cb', 23],
]);

/**
 * Deserialization map for known variables.
 */
const KNOWN_VARIABLES_MAP_REVERSE = new Map<number, string>(
    Array.from(KNOWN_VARIABLES_MAP).map(([key, value]) => [value, key]),
);

/**
 * Gets the frequent name of the variable from the binary representation.
 *
 * @param binary Binary representation of the variable
 * @returns Frequent name of the variable
 * @throws If the variable is unknown
 */
const getFrequentNameOrFail = (binary: number): string => {
    const name = KNOWN_VARIABLES_MAP_REVERSE.get(binary);
    if (isUndefined(name)) {
        throw new Error(`Unknown frequent name: ${binary}`);
    }
    return name;
};

/**
 * Represents a token in the expression.
 */
// TODO: Create a separate TokenStream class
interface Token {
    /**
     * Token type.
     */
    type: number;

    /**
     * Start offset in the source code.
     */
    start: number;

    /**
     * End offset in the source code.
     */
    end: number;
}

/**
 * `LogicalExpressionParser` is responsible for parsing logical expressions.
 *
 * @example
 * From the following rule:
 * ```adblock
 * !#if (adguard_ext_android_cb || adguard_ext_safari)
 * ```
 * this parser will parse the expression `(adguard_ext_android_cb || adguard_ext_safari)`.
 */
// TODO: Refactor this class
export class LogicalExpressionParser extends ParserBase {
    /**
     * Split the expression into tokens.
     *
     * @param raw Source code of the expression
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @returns Token list
     * @throws {AdblockSyntaxError} If the expression is invalid
     */
    private static tokenize(raw: string, baseOffset = 0): Token[] {
        const tokens: Token[] = [];
        let offset = 0;

        while (offset < raw.length) {
            const char = raw[offset];

            if (StringUtils.isWhitespace(char)) {
                // Ignore whitespace
                offset += 1;
            } else if (StringUtils.isLetter(char)) {
                // Save the start offset of the variable name
                const nameStart = offset;

                // Variable name shouldn't start with a number or underscore,
                // but can contain them
                while (
                    offset + 1 < raw.length
                    && (StringUtils.isAlphaNumeric(raw[offset + 1]) || raw[offset + 1] === UNDERSCORE)
                ) {
                    offset += 1;
                }

                tokens.push({
                    type: TokenType.Variable,
                    start: nameStart,
                    end: offset + 1,
                });

                offset += 1;
            } else if (char === OPEN_PARENTHESIS || char === CLOSE_PARENTHESIS) {
                // Parenthesis
                tokens.push({
                    type: TokenType.Parenthesis,
                    start: offset,
                    end: offset + 1,
                });

                offset += 1;
            } else if (char === AMPERSAND || char === PIPE) {
                // Parse operator
                if (offset + 1 < raw.length && raw[offset + 1] === char) {
                    tokens.push({
                        type: TokenType.Operator,
                        start: offset,
                        end: offset + 2,
                    });

                    offset += 2;
                } else {
                    throw new AdblockSyntaxError(
                        `Unexpected character "${char}"`,
                        baseOffset + offset,
                        baseOffset + offset + 1,
                    );
                }
            } else if (char === EXCLAMATION_MARK) {
                tokens.push({
                    type: TokenType.Operator,
                    start: offset,
                    end: offset + 1,
                });

                offset += 1;
            } else {
                throw new AdblockSyntaxError(
                    `Unexpected character "${char}"`,
                    baseOffset + offset,
                    baseOffset + offset + 1,
                );
            }
        }

        return tokens;
    }

    /**
     * Parses a logical expression.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @returns Parsed expression
     * @throws {AdblockSyntaxError} If the expression is invalid
     */
    // TODO: Create a separate TokenStream class
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): AnyExpressionNode {
        // Tokenize the source (produces an array of tokens)
        const tokens = LogicalExpressionParser.tokenize(raw, baseOffset);

        // Current token index
        let tokenIndex = 0;

        /**
         * Consumes a token of the expected type.
         *
         * @param type Expected token type
         * @returns The consumed token
         */
        function consume(type: TokenType): Token {
            const token = tokens[tokenIndex];

            if (!token) {
                throw new AdblockSyntaxError(
                    `Expected token of type "${type}", but reached end of input`,
                    baseOffset,
                    baseOffset + raw.length,
                );
            }

            // We only use this function internally, so we can safely ignore this
            // from the coverage report
            // istanbul ignore next
            if (token.type !== type) {
                throw new AdblockSyntaxError(
                    `Expected token of type "${type}", but got "${token.type}"`,
                    baseOffset + token.start,
                    baseOffset + token.end,
                );
            }

            tokenIndex += 1;

            return token;
        }

        /**
         * Parses a variable.
         *
         * @returns Variable node
         */
        function parseVariable(): ExpressionVariableNode {
            const token = consume(TokenType.Variable);

            const result: ExpressionVariableNode = {
                type: NodeType.Variable,
                name: raw.slice(token.start, token.end),
            };

            if (options.isLocIncluded) {
                result.start = baseOffset + token.start;
                result.end = baseOffset + token.end;
            }

            return result;
        }

        /**
         * Parses a binary expression.
         *
         * @param left Left-hand side of the expression
         * @param minPrecedence Minimum precedence of the operator
         * @returns Binary expression node
         */
        function parseBinaryExpression(left: AnyExpressionNode, minPrecedence = 0): AnyExpressionNode {
            let node = left;
            let operatorToken;

            while (tokens[tokenIndex]) {
                operatorToken = tokens[tokenIndex];

                if (!operatorToken || operatorToken.type !== TokenType.Operator) {
                    break;
                }

                // It is safe to cast here, because we already checked the type
                const operator = raw.slice(operatorToken.start, operatorToken.end) as AnyOperator;
                const precedence = OPERATOR_PRECEDENCE[operator];

                if (precedence < minPrecedence) {
                    break;
                }

                tokenIndex += 1;

                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                const right = parseExpression(precedence + 1);

                const newNode: AnyExpressionNode = {
                    type: NodeType.Operator,
                    operator,
                    left: node,
                    right,
                };

                if (options.isLocIncluded) {
                    newNode.start = node.start ?? baseOffset + operatorToken.start;
                    newNode.end = right.end ?? baseOffset + operatorToken.end;
                }

                node = newNode;
            }

            return node;
        }

        /**
         * Parses a parenthesized expression.
         *
         * @returns Parenthesized expression node
         */
        function parseParenthesizedExpression(): ExpressionParenthesisNode {
            consume(TokenType.Parenthesis);
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            const expression = parseExpression();
            consume(TokenType.Parenthesis);

            const result: ExpressionParenthesisNode = {
                type: NodeType.Parenthesis,
                expression,
            };

            if (options.isLocIncluded) {
                result.start = expression.start;
                result.end = expression.end;
            }

            return result;
        }

        /**
         * Parses an expression.
         *
         * @param minPrecedence Minimum precedence of the operator
         * @returns Expression node
         */
        function parseExpression(minPrecedence = 0): AnyExpressionNode {
            let node: AnyExpressionNode;

            const token = tokens[tokenIndex];
            const value = raw.slice(token.start, token.end);

            if (token.type === TokenType.Variable) {
                node = parseVariable();
            } else if (token.type === TokenType.Operator && value === OperatorValue.Not) {
                tokenIndex += 1;

                const expression = parseExpression(OPERATOR_PRECEDENCE[OperatorValue.Not]);

                node = {
                    type: NodeType.Operator,
                    operator: OperatorValue.Not,
                    left: expression,
                };

                if (options.isLocIncluded) {
                    if (expression.end) {
                        node.start = baseOffset + token.start;
                        // no need to shift the node location, because it's already shifted
                        node.end = expression.end;
                    } else {
                        node.start = baseOffset + token.start;
                        node.end = baseOffset + token.end;
                    }
                }
            } else if (token.type === TokenType.Parenthesis && value === OPEN_PARENTHESIS) {
                node = parseParenthesizedExpression();
            } else {
                throw new AdblockSyntaxError(
                    `Unexpected token "${value}"`,
                    baseOffset + token.start,
                    baseOffset + token.end,
                );
            }

            return parseBinaryExpression(node, minPrecedence);
        }

        const expression = parseExpression();

        if (tokenIndex !== tokens.length) {
            throw new AdblockSyntaxError(
                `Unexpected token "${tokens[tokenIndex].type}"`,
                baseOffset + tokens[tokenIndex].start,
                baseOffset + tokens[tokenIndex].end,
            );
        }

        return expression;
    }

    /**
     * Generates a string representation of the logical expression (serialization).
     *
     * @param node Expression node
     * @returns String representation of the logical expression
     */
    public static generate(node: AnyExpressionNode): string {
        if (node.type === NodeType.Variable) {
            return node.name;
        } if (node.type === NodeType.Operator) {
            const left = LogicalExpressionParser.generate(node.left);
            const right = node.right ? LogicalExpressionParser.generate(node.right) : undefined;
            const { operator } = node;

            // Special case for NOT operator
            if (operator === OperatorValue.Not) {
                return `${operator}${left}`;
            }

            // Right operand is required for AND and OR operators
            if (!right) {
                throw new Error('Expected right operand');
            }

            return `${left} ${operator} ${right}`;
        } if (node.type === NodeType.Parenthesis) {
            const expressionString = LogicalExpressionParser.generate(node.expression);

            return `(${expressionString})`;
        }

        // Theoretically, this shouldn't happen if the library is used correctly
        throw new Error('Unexpected node type');
    }

    /**
     * Serializes a variable node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    // TODO: create a common serialize / deserialize interface for such nodes (Variable, Value, Parameter, etc.)
    private static serializeVariableNode(node: ExpressionVariableNode, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.ExpressionVariableNode);

        const frequentName = KNOWN_VARIABLES_MAP.get(node.name);
        if (!isUndefined(frequentName)) {
            buffer.writeUint8(VariableNodeBinaryPropMap.FrequentName);
            buffer.writeUint8(frequentName);
        } else {
            buffer.writeUint8(VariableNodeBinaryPropMap.Name);
            buffer.writeString(node.name);
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(VariableNodeBinaryPropMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(VariableNodeBinaryPropMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }

    /**
     * Serializes a parenthesis node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    private static serializeParenthesisNode(node: ExpressionParenthesisNode, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.ExpressionParenthesisNode);

        buffer.writeUint8(ParenthesisNodeBinaryPropMap.Expression);
        LogicalExpressionParser.serialize(node.expression, buffer);

        if (!isUndefined(node.start)) {
            buffer.writeUint8(ParenthesisNodeBinaryPropMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(ParenthesisNodeBinaryPropMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }

    /**
     * Serializes an operator node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    private static serializeOperatorNode(node: ExpressionOperatorNode, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.ExpressionOperatorNode);

        buffer.writeUint8(OperatorNodeBinaryPropMap.Operator);
        const operatorBinary = OPERATOR_BINARY_MAP.get(node.operator);
        if (isUndefined(operatorBinary)) {
            throw new Error(`Unknown operator: ${node.operator}`);
        }
        buffer.writeUint8(operatorBinary);

        buffer.writeUint8(OperatorNodeBinaryPropMap.Left);
        LogicalExpressionParser.serialize(node.left, buffer);

        if (node.right) {
            buffer.writeUint8(OperatorNodeBinaryPropMap.Right);
            LogicalExpressionParser.serialize(node.right, buffer);
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(OperatorNodeBinaryPropMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(OperatorNodeBinaryPropMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }

    /**
     * Serializes a logical expression node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: AnyExpressionNode, buffer: OutputByteBuffer): void {
        switch (node.type) {
            case NodeType.Variable:
                LogicalExpressionParser.serializeVariableNode(node, buffer);
                break;
            case NodeType.Operator:
                LogicalExpressionParser.serializeOperatorNode(node, buffer);
                break;
            case NodeType.Parenthesis:
                LogicalExpressionParser.serializeParenthesisNode(node, buffer);
                break;

            default:
                throw new Error(`Unexpected node type: ${node.type}`);
        }

        buffer.writeUint8(NULL);
    }

    /**
     * Deserializes a variable node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    private static deserializeVariableNode(buffer: InputByteBuffer, node: Partial<ExpressionVariableNode>): void {
        buffer.assertUint8(BinaryTypeMap.ExpressionVariableNode);

        node.type = NodeType.Variable;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case VariableNodeBinaryPropMap.Name:
                    node.name = buffer.readString();
                    break;

                case VariableNodeBinaryPropMap.FrequentName:
                    node.name = getFrequentNameOrFail(buffer.readUint8());
                    break;

                case VariableNodeBinaryPropMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case VariableNodeBinaryPropMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }

    /**
     * Deserializes a parenthesis node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    private static deserializeParenthesisNode(buffer: InputByteBuffer, node: Partial<ExpressionParenthesisNode>): void {
        buffer.assertUint8(BinaryTypeMap.ExpressionParenthesisNode);

        node.type = NodeType.Parenthesis;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case ParenthesisNodeBinaryPropMap.Expression:
                    LogicalExpressionParser.deserialize(buffer, node.expression = {} as AnyExpressionNode);
                    break;

                case ParenthesisNodeBinaryPropMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case ParenthesisNodeBinaryPropMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }

    /**
     * Deserializes an operator node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    private static deserializeOperatorNode(buffer: InputByteBuffer, node: Partial<ExpressionOperatorNode>): void {
        buffer.assertUint8(BinaryTypeMap.ExpressionOperatorNode);

        node.type = NodeType.Operator;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case OperatorNodeBinaryPropMap.Operator:
                    node.operator = getOperatorOrFail(buffer.readUint8());
                    break;

                case OperatorNodeBinaryPropMap.Left:
                    LogicalExpressionParser.deserialize(buffer, node.left = {} as AnyExpressionNode);
                    break;

                case OperatorNodeBinaryPropMap.Right:
                    LogicalExpressionParser.deserialize(buffer, node.right = {} as AnyExpressionNode);
                    break;

                case OperatorNodeBinaryPropMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case OperatorNodeBinaryPropMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }

    /**
     * Deserializes a logical expression node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<AnyExpressionNode>): void {
        // note: we just do a simple lookahead here, because advancing the buffer is done in the
        // 'sub-deserialize' methods
        let type = buffer.peekUint8();
        while (type !== NULL) {
            switch (type) {
                case BinaryTypeMap.ExpressionVariableNode:
                    LogicalExpressionParser.deserializeVariableNode(buffer, node as Partial<ExpressionVariableNode>);
                    break;

                case BinaryTypeMap.ExpressionOperatorNode:
                    LogicalExpressionParser.deserializeOperatorNode(buffer, node as Partial<ExpressionOperatorNode>);
                    break;

                case BinaryTypeMap.ExpressionParenthesisNode:
                    // eslint-disable-next-line max-len
                    LogicalExpressionParser.deserializeParenthesisNode(buffer, node as Partial<ExpressionParenthesisNode>);
                    break;

                default:
                    throw new Error(`Unexpected node type: ${type}`);
            }

            type = buffer.peekUint8();
        }

        // consume NULL
        buffer.readUint8();
    }
}
