import { TokenType } from '@adguard/css-tokenizer';

import { tokenizeBalanced, tokenizeFnBalanced } from '../../../src/parser/css/balancing';

/**
 * Type of token data.
 *
 * @param type Token type
 * @param start Token start position
 * @param end Token end position
 * @param props Token properties
 * @param balance Balance of the token
 */
type TokenData = [TokenType, number, number, object | undefined, number];

describe('CSS balancing', () => {
    describe('tokenizeBalanced', () => {
        // invalid cases
        test.each([
            '(',
            '()(',
            '())',
            '({)}',
        ])('should throw on unbalanced input: %s', (input) => {
            expect(() => tokenizeBalanced(input, () => {})).toThrow(/^Expected/);
        });

        // valid cases
        test.each([
            // simple pairs
            {
                actual: '()',
                expected: [
                    [TokenType.OpenParenthesis, 0, 1, undefined, 1],
                    [TokenType.CloseParenthesis, 1, 2, undefined, 0],
                ],
            },
            {
                actual: '{}',
                expected: [
                    [TokenType.OpenCurlyBracket, 0, 1, undefined, 1],
                    [TokenType.CloseCurlyBracket, 1, 2, undefined, 0],
                ],
            },
            {
                actual: '[]',
                expected: [
                    [TokenType.OpenSquareBracket, 0, 1, undefined, 1],
                    [TokenType.CloseSquareBracket, 1, 2, undefined, 0],
                ],
            },
            // nested pairs
            {
                actual: '(())',
                expected: [
                    [TokenType.OpenParenthesis, 0, 1, undefined, 1],
                    [TokenType.OpenParenthesis, 1, 2, undefined, 2],
                    [TokenType.CloseParenthesis, 2, 3, undefined, 1],
                    [TokenType.CloseParenthesis, 3, 4, undefined, 0],
                ],
            },
            {
                actual: '{{}}',
                expected: [
                    [TokenType.OpenCurlyBracket, 0, 1, undefined, 1],
                    [TokenType.OpenCurlyBracket, 1, 2, undefined, 2],
                    [TokenType.CloseCurlyBracket, 2, 3, undefined, 1],
                    [TokenType.CloseCurlyBracket, 3, 4, undefined, 0],
                ],
            },
            {
                actual: '[[]]',
                expected: [
                    [TokenType.OpenSquareBracket, 0, 1, undefined, 1],
                    [TokenType.OpenSquareBracket, 1, 2, undefined, 2],
                    [TokenType.CloseSquareBracket, 2, 3, undefined, 1],
                    [TokenType.CloseSquareBracket, 3, 4, undefined, 0],
                ],
            },
            // complicated nested pairs
            {
                actual: '(({[][]}))',
                expected: [
                    [TokenType.OpenParenthesis, 0, 1, undefined, 1],
                    [TokenType.OpenParenthesis, 1, 2, undefined, 2],
                    [TokenType.OpenCurlyBracket, 2, 3, undefined, 3],
                    [TokenType.OpenSquareBracket, 3, 4, undefined, 4],
                    [TokenType.CloseSquareBracket, 4, 5, undefined, 3],
                    [TokenType.OpenSquareBracket, 5, 6, undefined, 4],
                    [TokenType.CloseSquareBracket, 6, 7, undefined, 3],
                    [TokenType.CloseCurlyBracket, 7, 8, undefined, 2],
                    [TokenType.CloseParenthesis, 8, 9, undefined, 1],
                    [TokenType.CloseParenthesis, 9, 10, undefined, 0],
                ],
            },
            // functions
            {
                actual: 'func()',
                expected: [
                    [TokenType.Function, 0, 5, undefined, 1],
                    [TokenType.CloseParenthesis, 5, 6, undefined, 0],
                ],
            },
            {
                actual: 'func1(func2(a))',
                expected: [
                    [TokenType.Function, 0, 6, undefined, 1],
                    [TokenType.Function, 6, 12, undefined, 2],
                    [TokenType.Ident, 12, 13, undefined, 2],
                    [TokenType.CloseParenthesis, 13, 14, undefined, 1],
                    [TokenType.CloseParenthesis, 14, 15, undefined, 0],
                ],
            },
            // complicated case with functions and nested pairs
            {
                actual: 'div > func([]) + div:something({{a:a}})',
                expected: [
                    [TokenType.Ident, 0, 3, undefined, 0],
                    [TokenType.Whitespace, 3, 4, undefined, 0],
                    [TokenType.Delim, 4, 5, undefined, 0],
                    [TokenType.Whitespace, 5, 6, undefined, 0],
                    [TokenType.Function, 6, 11, undefined, 1],
                    [TokenType.OpenSquareBracket, 11, 12, undefined, 2],
                    [TokenType.CloseSquareBracket, 12, 13, undefined, 1],
                    [TokenType.CloseParenthesis, 13, 14, undefined, 0],
                    [TokenType.Whitespace, 14, 15, undefined, 0],
                    [TokenType.Delim, 15, 16, undefined, 0],
                    [TokenType.Whitespace, 16, 17, undefined, 0],
                    [TokenType.Ident, 17, 20, undefined, 0],
                    [TokenType.Colon, 20, 21, undefined, 0],
                    [TokenType.Function, 21, 31, undefined, 1],
                    [TokenType.OpenCurlyBracket, 31, 32, undefined, 2],
                    [TokenType.OpenCurlyBracket, 32, 33, undefined, 3],
                    [TokenType.Ident, 33, 34, undefined, 3],
                    [TokenType.Colon, 34, 35, undefined, 3],
                    [TokenType.Ident, 35, 36, undefined, 3],
                    [TokenType.CloseCurlyBracket, 36, 37, undefined, 2],
                    [TokenType.CloseCurlyBracket, 37, 38, undefined, 1],
                    [TokenType.CloseParenthesis, 38, 39, undefined, 0],
                ],
            },
        ])('should tokenize balanced input: $actual', ({ actual, expected }) => {
            const tokens: TokenData[] = [];

            tokenizeBalanced(actual, (type, start, end, props, balance) => {
                tokens.push([type, start, end, props, balance]);
            });

            expect(tokens).toEqual(expected);
        });
    });

    describe('tokenizeFnBalanced', () => {
        // invalid cases
        test.each([
            'func(',
            'func(()func((',
            'func())',
        ])('should throw on unbalanced input: %s', (input) => {
            expect(() => tokenizeBalanced(input, () => {})).toThrow();
        });

        // valid cases
        test.each([
            // simple pairs
            {
                actual: 'func()',
                expected: [
                    [TokenType.Function, 0, 5, undefined, 1],
                    [TokenType.CloseParenthesis, 5, 6, undefined, 0],
                ],
            },
            // nested pairs
            {
                actual: 'func1(func2(a))',
                expected: [
                    [TokenType.Function, 0, 6, undefined, 1],
                    [TokenType.Function, 6, 12, undefined, 2],
                    [TokenType.Ident, 12, 13, undefined, 2],
                    [TokenType.CloseParenthesis, 13, 14, undefined, 1],
                    [TokenType.CloseParenthesis, 14, 15, undefined, 0],
                ],
            },
            // should not take unbalanced curly brackets into account
            {
                actual: 'func1({{)',
                expected: [
                    [TokenType.Function, 0, 6, undefined, 1],
                    [TokenType.OpenCurlyBracket, 6, 7, undefined, 1],
                    [TokenType.OpenCurlyBracket, 7, 8, undefined, 1],
                    [TokenType.CloseParenthesis, 8, 9, undefined, 0],
                ],
            },
            // should not take unbalanced square brackets into account
            {
                actual: 'func1([[)',
                expected: [
                    [TokenType.Function, 0, 6, undefined, 1],
                    [TokenType.OpenSquareBracket, 6, 7, undefined, 1],
                    [TokenType.OpenSquareBracket, 7, 8, undefined, 1],
                    [TokenType.CloseParenthesis, 8, 9, undefined, 0],
                ],
            },
        ])('should tokenize balanced input: $actual', ({ actual, expected }) => {
            const tokens: TokenData[] = [];

            tokenizeFnBalanced(actual, (type, start, end, props, balance) => {
                tokens.push([type, start, end, props, balance]);
            });

            expect(tokens).toEqual(expected);
        });
    });
});
