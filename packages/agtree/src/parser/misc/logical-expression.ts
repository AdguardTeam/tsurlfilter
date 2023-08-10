import { StringUtils } from '../../utils/string';
import {
    type AnyExpressionNode,
    type AnyOperator,
    type ExpressionParenthesisNode,
    type ExpressionVariableNode,
    type Location,
    type LocationRange,
    defaultLocation,
} from '../common';
import {
    AMPERSAND,
    CLOSE_PARENTHESIS,
    EXCLAMATION_MARK,
    OPEN_PARENTHESIS,
    PIPE,
    UNDERSCORE,
} from '../../utils/constants';
import { locRange } from '../../utils/location';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';

const OPERATOR_PRECEDENCE = {
    '!': 3,
    '&&': 2,
    '||': 1,
};

/**
 * Represents a token in the expression.
 */
interface Token {
    type: 'Variable' | 'Operator' | 'Parenthesis';
    loc: LocationRange;
    value: string;
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
export class LogicalExpressionParser {
    /**
     * Split the expression into tokens.
     *
     * @param raw Source code of the expression
     * @param loc Location of the expression
     * @returns Token list
     * @throws {AdblockSyntaxError} If the expression is invalid
     */
    private static tokenize(raw: string, loc: Location = defaultLocation): Token[] {
        const tokens: Token[] = [];
        let offset = 0;

        while (offset < raw.length) {
            const char = raw[offset];

            if (StringUtils.isWhitespace(char)) {
                // Ignore whitespace
                offset += 1;
            } else if (StringUtils.isLetter(char)) {
                // Consume variable name
                let name = char;

                // Save the start offset of the variable name
                const nameStart = offset;

                // Variable name shouldn't start with a number or underscore,
                // but can contain them
                while (
                    offset + 1 < raw.length
                    && (StringUtils.isAlphaNumeric(raw[offset + 1]) || raw[offset + 1] === UNDERSCORE)
                ) {
                    offset += 1;
                    name += raw[offset];
                }

                tokens.push({
                    type: 'Variable',
                    value: name,
                    loc: locRange(loc, nameStart, offset + 1),
                });

                offset += 1;
            } else if (char === OPEN_PARENTHESIS || char === CLOSE_PARENTHESIS) {
                // Parenthesis
                tokens.push({
                    type: 'Parenthesis',
                    value: char,
                    loc: locRange(loc, offset, offset + 1),
                });

                offset += 1;
            } else if (char === AMPERSAND || char === PIPE) {
                // Parse operator
                if (offset + 1 < raw.length && raw[offset + 1] === char) {
                    tokens.push({
                        type: 'Operator',
                        value: char + char,
                        loc: locRange(loc, offset, offset + 2),
                    });

                    offset += 2;
                } else {
                    throw new AdblockSyntaxError(
                        `Unexpected character "${char}"`,
                        locRange(loc, offset, offset + 1),
                    );
                }
            } else if (char === EXCLAMATION_MARK) {
                tokens.push({
                    type: 'Operator',
                    value: char,
                    loc: locRange(loc, offset, offset + 1),
                });

                offset += 1;
            } else {
                throw new AdblockSyntaxError(
                    `Unexpected character "${char}"`,
                    locRange(loc, offset, offset + 1),
                );
            }
        }

        return tokens;
    }

    /**
     * Parses a logical expression.
     *
     * @param raw Source code of the expression
     * @param loc Location of the expression
     * @returns Parsed expression
     * @throws {AdblockSyntaxError} If the expression is invalid
     */
    public static parse(raw: string, loc: Location = defaultLocation): AnyExpressionNode {
        // Tokenize the source (produces an array of tokens)
        const tokens = LogicalExpressionParser.tokenize(raw, loc);

        // Current token index
        let tokenIndex = 0;

        /**
         * Consumes a token of the expected type.
         *
         * @param type Expected token type
         * @returns The consumed token
         */
        function consume(type: Token['type']): Token {
            const token = tokens[tokenIndex];

            if (!token) {
                throw new AdblockSyntaxError(
                    `Expected token of type "${type}", but reached end of input`,
                    locRange(loc, 0, raw.length),
                );
            }

            // We only use this function internally, so we can safely ignore this
            // from the coverage report
            // istanbul ignore next
            if (token.type !== type) {
                throw new AdblockSyntaxError(
                    `Expected token of type "${type}", but got "${token.type}"`,
                    // Token location is always shifted, no need locRange
                    {
                        start: token.loc.start,
                        end: token.loc.end,
                    },
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
            const token = consume('Variable');

            return {
                type: 'Variable',
                // Token location is always shifted, no need locRange
                loc: token.loc,
                name: token.value,
            };
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

                if (!operatorToken || operatorToken.type !== 'Operator') {
                    break;
                }

                // It is safe to cast here, because we already checked the type
                const operator = operatorToken.value as AnyOperator;
                const precedence = OPERATOR_PRECEDENCE[operator];

                if (precedence < minPrecedence) {
                    break;
                }

                tokenIndex += 1;

                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                const right = parseExpression(precedence + 1);

                node = {
                    type: 'Operator',
                    // Token location is always shifted, no need locRange
                    loc: {
                        start: node.loc?.start ?? operatorToken.loc.start,
                        end: right.loc?.end ?? operatorToken.loc.end,
                    },
                    operator,
                    left: node,
                    right,
                };
            }

            return node;
        }

        /**
         * Parses a parenthesized expression.
         *
         * @returns Parenthesized expression node
         */
        function parseParenthesizedExpression(): ExpressionParenthesisNode {
            consume('Parenthesis');
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            const expression = parseExpression();
            consume('Parenthesis');

            return {
                type: 'Parenthesis',
                loc: expression.loc,
                expression,
            };
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

            if (token.type === 'Variable') {
                node = parseVariable();
            } else if (token.type === 'Operator' && token.value === '!') {
                tokenIndex += 1;

                const expression = parseExpression(OPERATOR_PRECEDENCE['!']);

                node = {
                    type: 'Operator',
                    // Token location is always shifted, no need locRange
                    loc: { start: token.loc.start, end: expression.loc?.end ?? token.loc.end },
                    operator: '!',
                    left: expression,
                };
            } else if (token.type === 'Parenthesis' && token.value === OPEN_PARENTHESIS) {
                node = parseParenthesizedExpression();
            } else {
                throw new AdblockSyntaxError(
                    `Unexpected token "${token.value}"`,
                    // Token location is always shifted, no need locRange
                    {
                        start: token.loc.start,
                        end: token.loc.end,
                    },
                );
            }

            return parseBinaryExpression(node, minPrecedence);
        }

        const expression = parseExpression();

        if (tokenIndex !== tokens.length) {
            throw new AdblockSyntaxError(
                `Unexpected token "${tokens[tokenIndex].value}"`,
                // Token location is always shifted, no need locRange
                {
                    start: tokens[tokenIndex].loc.start,
                    end: tokens[tokenIndex].loc.end,
                },
            );
        }

        return expression;
    }

    /**
     * Generates a string representation of the logical expression (serialization).
     *
     * @param ast Expression node
     * @returns String representation of the logical expression
     */
    public static generate(ast: AnyExpressionNode): string {
        if (ast.type === 'Variable') {
            return ast.name;
        } if (ast.type === 'Operator') {
            const left = LogicalExpressionParser.generate(ast.left);
            const right = ast.right ? LogicalExpressionParser.generate(ast.right) : undefined;
            const { operator } = ast;

            if (operator === '!') {
                return `${operator}${left}`;
            }

            const leftString = operator === '||' ? `${left}` : left;
            const rightString = operator === '||' ? `${right}` : right;

            return `${leftString} ${operator} ${rightString}`;
        } if (ast.type === 'Parenthesis') {
            const expressionString = LogicalExpressionParser.generate(ast.expression);

            return `(${expressionString})`;
        }

        // Theoretically, this shouldn't happen if the library is used correctly
        throw new Error('Unexpected node type');
    }
}
