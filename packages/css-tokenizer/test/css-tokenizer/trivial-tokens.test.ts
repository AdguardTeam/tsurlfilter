import { describe, test } from 'vitest';

import { TokenType } from '../../src/common/enums/token-types';
import { addAsProp, testTokenization } from '../helpers/test-utils';

describe('trivial tokens', () => {
    test.each(addAsProp([
        {
            actual: '(',
            expected: [
                [TokenType.OpenParenthesis, 0, 1],
            ],
        },
        {
            actual: ')',
            expected: [
                [TokenType.CloseParenthesis, 0, 1],
            ],
        },
        {
            actual: '[',
            expected: [
                [TokenType.OpenSquareBracket, 0, 1],
            ],
        },
        {
            actual: ']',
            expected: [
                [TokenType.CloseSquareBracket, 0, 1],
            ],
        },
        {
            actual: '{',
            expected: [
                [TokenType.OpenCurlyBracket, 0, 1],
            ],
        },
        {
            actual: '}',
            expected: [
                [TokenType.CloseCurlyBracket, 0, 1],
            ],
        },
        {
            actual: ':',
            expected: [
                [TokenType.Colon, 0, 1],
            ],
        },
        {
            actual: ',',
            expected: [
                [TokenType.Comma, 0, 1],
            ],
        },
        {
            actual: ';',
            expected: [
                [TokenType.Semicolon, 0, 1],
            ],
        },
    ]))("should tokenize '$actual' as $as", (testCase) => {
        testTokenization(testCase);
    });
});
