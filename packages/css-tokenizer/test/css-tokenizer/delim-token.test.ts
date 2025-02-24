import { describe, test } from 'vitest';

import { TokenType } from '../../src/common/enums/token-types';
import type { TokenTest } from '../helpers/test-interfaces';
import { addAsProp, testTokenization } from '../helpers/test-utils';

describe('delim-token', () => {
    // Tokenize any unknown character as <delim-token>
    describe('should tokenize any unknown character as <delim-token>', () => {
        test.each(addAsProp([
            {
                actual: '$',
                expected: [
                    [TokenType.Delim, 0, 1],
                ],
            },
            {
                actual: '^',
                expected: [
                    [TokenType.Delim, 0, 1],
                ],
            },
        ] as TokenTest[]))("should tokenize '$actual' as $as", (testCase) => {
            testTokenization(testCase);
        });
    });

    describe("should tokenize '#' as <delim-token> if it isn't followed by a name or a hex digit", () => {
        test.each([
            {
                actual: String.raw`#`,
                expected: [
                    [TokenType.Delim, 0, 1],
                ],
            },
            {
                actual: String.raw`# `,
                expected: [
                    [TokenType.Delim, 0, 1],
                    [TokenType.Whitespace, 1, 2],
                ],
            },
            {
                actual: String.raw`# 0`,
                expected: [
                    [TokenType.Delim, 0, 1],
                    [TokenType.Whitespace, 1, 2],
                    [TokenType.Number, 2, 3],
                ],
            },
        ] as TokenTest[])("should tokenize '#' as <delim-token> in '$actual'", (testCase) => {
            testTokenization(testCase);
        });
    });

    describe("should tokenize '+' as <delim-token> if it isn't a part of a number", () => {
        test.each([
            {
                actual: String.raw`+`,
                expected: [
                    [TokenType.Delim, 0, 1],
                ],
            },
            {
                actual: String.raw`+ `,
                expected: [
                    [TokenType.Delim, 0, 1],
                    [TokenType.Whitespace, 1, 2],
                ],
            },
            {
                actual: String.raw`+ 1`,
                expected: [
                    [TokenType.Delim, 0, 1],
                    [TokenType.Whitespace, 1, 2],
                    [TokenType.Number, 2, 3],
                ],
            },
        ] as TokenTest[])("should tokenize '+' as <delim-token> in '$actual'", (testCase) => {
            testTokenization(testCase);
        });
    });

    describe("should tokenize '-' as <delim-token> if it isn't a part of a number, CDC or ident", () => {
        test.each([
            {
                actual: String.raw`-`,
                expected: [
                    [TokenType.Delim, 0, 1],
                ],
            },
            {
                actual: String.raw`- `,
                expected: [
                    [TokenType.Delim, 0, 1],
                    [TokenType.Whitespace, 1, 2],
                ],
            },
            {
                actual: String.raw`- 1`,
                expected: [
                    [TokenType.Delim, 0, 1],
                    [TokenType.Whitespace, 1, 2],
                    [TokenType.Number, 2, 3],
                ],
            },
            {
                actual: String.raw`- a`,
                expected: [
                    [TokenType.Delim, 0, 1],
                    [TokenType.Whitespace, 1, 2],
                    [TokenType.Ident, 2, 3],
                ],
            },
        ] as TokenTest[])("should tokenize '-' as <delim-token> in '$actual'", (testCase) => {
            testTokenization(testCase);
        });
    });

    describe("should tokenize '.' as <delim-token> if it isn't a part of a number", () => {
        test.each([
            {
                actual: String.raw`.`,
                expected: [
                    [TokenType.Delim, 0, 1],
                ],
            },
            {
                actual: String.raw`. `,
                expected: [
                    [TokenType.Delim, 0, 1],
                    [TokenType.Whitespace, 1, 2],
                ],
            },
            {
                actual: String.raw`. 1`,
                expected: [
                    [TokenType.Delim, 0, 1],
                    [TokenType.Whitespace, 1, 2],
                    [TokenType.Number, 2, 3],
                ],
            },
        ] as TokenTest[])("should tokenize '.' as <delim-token> in '$actual'", (testCase) => {
            testTokenization(testCase);
        });
    });

    describe("should tokenize '<' as <delim-token> if it isn't a part of a CDO", () => {
        test.each([
            {
                actual: String.raw`<`,
                expected: [
                    [TokenType.Delim, 0, 1],
                ],
            },
            {
                actual: String.raw`< `,
                expected: [
                    [TokenType.Delim, 0, 1],
                    [TokenType.Whitespace, 1, 2],
                ],
            },
            {
                actual: String.raw`< !--`,
                expected: [
                    [TokenType.Delim, 0, 1],
                    [TokenType.Whitespace, 1, 2],
                    [TokenType.Delim, 2, 3],
                    [TokenType.Ident, 3, 5],
                ],
            },
        ] as TokenTest[])("should tokenize '<' as <delim-token> in '$actual'", (testCase) => {
            testTokenization(testCase);
        });
    });

    describe("should tokenize '@' as <delim-token> if it isn't a part of an at-keyword", () => {
        test.each([
            {
                actual: String.raw`@`,
                expected: [
                    [TokenType.Delim, 0, 1],
                ],
            },
            {
                actual: String.raw`@ `,
                expected: [
                    [TokenType.Delim, 0, 1],
                    [TokenType.Whitespace, 1, 2],
                ],
            },
            {
                actual: String.raw`@ charset`,
                expected: [
                    [TokenType.Delim, 0, 1],
                    [TokenType.Whitespace, 1, 2],
                    [TokenType.Ident, 2, 9],
                ],
            },
        ] as TokenTest[])("should tokenize '@' as <delim-token> in '$actual'", (testCase) => {
            testTokenization(testCase);
        });
    });

    describe("should tokenize '/' as <delim-token> if it isn't a part of a comment mark", () => {
        test.each([
            {
                actual: String.raw`/`,
                expected: [
                    [TokenType.Delim, 0, 1],
                ],
            },
            {
                actual: String.raw`/ `,
                expected: [
                    [TokenType.Delim, 0, 1],
                    [TokenType.Whitespace, 1, 2],
                ],
            },
            {
                actual: String.raw`/ *`,
                expected: [
                    [TokenType.Delim, 0, 1],
                    [TokenType.Whitespace, 1, 2],
                    [TokenType.Delim, 2, 3],
                ],
            },
        ] as TokenTest[])("should tokenize '/' as <delim-token> in '$actual'", (testCase) => {
            testTokenization(testCase);
        });
    });

    describe("should tokenize '\\' as <delim-token> if it isn't a valid escape", () => {
        test.each([
            {
                actual: '\\\n',
                expected: [
                    [TokenType.Delim, 0, 1],
                    [TokenType.Whitespace, 1, 2],
                ],
            },
        ] as TokenTest[])("should tokenize '\\' as <delim-token> in '$actual'", (testCase) => {
            testTokenization(testCase);
        });
    });
});
