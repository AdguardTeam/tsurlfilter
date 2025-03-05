import { describe, test } from 'vitest';

import { TokenType } from '../../src/common/enums/token-types';
import { addAsProp, testTokenization } from '../helpers/test-utils';

describe('string-token and bad-string-token', () => {
    test.each(addAsProp([
        // trivial cases
        {
            actual: String.raw`'str'`,
            expected: [
                [TokenType.String, 0, 5],
            ],
        },
        {
            actual: String.raw`"str"`,
            expected: [
                [TokenType.String, 0, 5],
            ],
        },

        // string's quote mark is also occurs in the string as an escaped character
        {
            actual: String.raw`'str\'str'`,
            expected: [
                [TokenType.String, 0, 10],
            ],
        },
        {
            actual: String.raw`"str\"str"`,
            expected: [
                [TokenType.String, 0, 10],
            ],
        },

        // should tolerate missing closing quote mark
        {
            actual: String.raw`'str`,
            expected: [
                [TokenType.String, 0, 4],
            ],
        },
        {
            actual: String.raw`"str`,
            expected: [
                [TokenType.String, 0, 4],
            ],
        },

        // should give bad string token if newline is encountered before the closing quote mark
        {
            actual: '"str\n',
            expected: [
                [TokenType.BadString, 0, 5],
            ],
        },
        {
            actual: "'str\n",
            expected: [
                [TokenType.BadString, 0, 5],
            ],
        },
        // carriage return + line feed
        {
            actual: '"str\r\n',
            expected: [
                [TokenType.BadString, 0, 6],
            ],
        },
        {
            actual: "'str\r\n",
            expected: [
                [TokenType.BadString, 0, 6],
            ],
        },

        // should handle newline after string
        {
            actual: "'str'\n",
            expected: [
                [TokenType.String, 0, 5],
                [TokenType.Whitespace, 5, 6],
            ],
        },
        {
            actual: '"str"\n',
            expected: [
                [TokenType.String, 0, 5],
                [TokenType.Whitespace, 5, 6],
            ],
        },

        // \ at the end of the string
        {
            actual: '"str\\',
            expected: [
                [TokenType.String, 0, 5],
            ],
        },

        // escaped newline in string
        {
            actual: '"str\\\nstr"',
            expected: [
                [TokenType.String, 0, 10],
            ],
        },
        {
            actual: "'str\\\nstr'",
            expected: [
                [TokenType.String, 0, 10],
            ],
        },
    ]))("should tokenize '$actual' as $as", (testCase) => {
        testTokenization(testCase);
    });
});
