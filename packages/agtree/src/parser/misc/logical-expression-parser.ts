import { StringUtils } from '../../utils/string.js';
import {
    type AnyExpressionNode,
    type ExpressionParenthesisNode,
    type ExpressionVariableNode,
    OperatorValue,
} from '../../nodes/index.js';
import {
    AMPERSAND,
    CLOSE_PARENTHESIS,
    EXCLAMATION_MARK,
    OPEN_PARENTHESIS,
    PIPE,
    UNDERSCORE,
} from '../../utils/constants.js';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error.js';
import { defaultParserOptions } from '../options.js';
import { BaseParser } from '../base-parser.js';

/**
 * Possible token types in the logical expression.
 */
const TokenType = {
    Variable: 0,
    Operator: 1,
    Parenthesis: 2,
} as const;

// intentionally naming the variable the same as the type
// eslint-disable-next-line @typescript-eslint/no-redeclare
type TokenType = typeof TokenType[keyof typeof TokenType];

/**
 * Possible node types in the logical expression.
 */
export const NodeType = {
    Variable: 'Variable',
    Operator: 'Operator',
    Parenthesis: 'Parenthesis',
} as const;

// intentionally naming the variable the same as the type
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type NodeType = typeof NodeType[keyof typeof NodeType];

/**
 * Precedence of the operators, larger number means higher precedence.
 */
const OPERATOR_PRECEDENCE = {
    [OperatorValue.Not]: 3,
    [OperatorValue.And]: 2,
    [OperatorValue.Or]: 1,
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
export class LogicalExpressionParser extends BaseParser {
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
                const operator = raw.slice(operatorToken.start, operatorToken.end) as OperatorValue;
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
}
