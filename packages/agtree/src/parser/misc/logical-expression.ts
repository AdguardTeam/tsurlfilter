/* eslint-disable max-classes-per-file */
import { StringUtils } from '../../utils/string';
import {
    type Location,
    type AnyExpressionNode,
    type AnyOperator,
    type ExpressionParenthesisNode,
    type ExpressionVariableNode,
} from '../common';
import {
    AMPERSAND,
    CLOSE_PARENTHESIS,
    EXCLAMATION_MARK,
    OPEN_PARENTHESIS,
    PIPE,
    UNDERSCORE,
} from '../../utils/constants';
import { locRange, shiftLoc } from '../../utils/location';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { getParserOptions, type ParserOptions } from '../options';

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
export class LogicalExpressionParser {
    /**
     * Split the expression into tokens.
     *
     * @param raw Source code of the expression
     * @param options Parser options. See {@link ParserOptions}.
     * @returns Token list
     * @throws {AdblockSyntaxError} If the expression is invalid
     */
    private static tokenize(raw: string, options: Partial<ParserOptions> = {}): Token[] {
        const { baseLoc } = getParserOptions(options);
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
                        locRange(baseLoc, offset, offset + 1),
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
                    locRange(baseLoc, offset, offset + 1),
                );
            }
        }

        return tokens;
    }

    /**
     * Parses a logical expression.
     *
     * @param raw Source code of the expression
     * @param options Parser options. See {@link ParserOptions}.
     * @returns Parsed expression
     * @throws {AdblockSyntaxError} If the expression is invalid
     */
    // TODO: Create a separate TokenStream class
    public static parse(raw: string, options: Partial<ParserOptions> = {}): AnyExpressionNode {
        // Tokenize the source (produces an array of tokens)
        const tokens = LogicalExpressionParser.tokenize(raw, options);
        const { baseLoc, isLocIncluded } = getParserOptions(options);

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
                    locRange(baseLoc, 0, raw.length),
                );
            }

            // We only use this function internally, so we can safely ignore this
            // from the coverage report
            // istanbul ignore next
            if (token.type !== type) {
                throw new AdblockSyntaxError(
                    `Expected token of type "${type}", but got "${token.type}"`,
                    locRange(baseLoc, token.start, token.end),
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

            if (isLocIncluded) {
                result.loc = locRange(baseLoc, token.start, token.end);
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

                if (isLocIncluded) {
                    let start: Location;
                    let end: Location;

                    if (node.loc) {
                        // no need to shift the node location, because it's already shifted
                        start = node.loc.start;
                    } else {
                        start = shiftLoc(baseLoc, operatorToken.start);
                    }

                    if (right.loc) {
                        // no need to shift the node location, because it's already shifted
                        end = right.loc.end;
                    } else {
                        end = shiftLoc(baseLoc, operatorToken.end);
                    }

                    newNode.loc = {
                        start,
                        end,
                    };
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

            if (isLocIncluded) {
                result.loc = expression.loc;
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

                if (isLocIncluded) {
                    if (expression.loc) {
                        node.loc = {
                            start: shiftLoc(baseLoc, token.start),
                            // no need to shift the node location, because it's already shifted
                            end: expression.loc.end,
                        };
                    } else {
                        node.loc = locRange(baseLoc, token.start, token.end);
                    }
                }
            } else if (token.type === TokenType.Parenthesis && value === OPEN_PARENTHESIS) {
                node = parseParenthesizedExpression();
            } else {
                throw new AdblockSyntaxError(
                    `Unexpected token "${value}"`,
                    locRange(baseLoc, token.start, token.end),
                );
            }

            return parseBinaryExpression(node, minPrecedence);
        }

        const expression = parseExpression();

        if (tokenIndex !== tokens.length) {
            throw new AdblockSyntaxError(
                `Unexpected token "${tokens[tokenIndex].type}"`,
                locRange(baseLoc, tokens[tokenIndex].start, tokens[tokenIndex].end),
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
}
