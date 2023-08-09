import {
    ADBLOCK_URL_SEPARATOR_REGEX,
    ADBLOCK_URL_START_REGEX,
    ADBLOCK_WILDCARD_REGEX,
    REGEX_ANY_CHARACTERS,
    REGEX_END,
    REGEX_START,
    RegExpUtils,
} from '../../src/utils/regexp';

describe('RegExpUtils', () => {
    describe('isRegexPattern', () => {
        test.each([
            {
                actual: '',
                expected: false,
            },
            {
                actual: '  ',
                expected: false,
            },
            {
                actual: '/',
                expected: false,
            },
            {
                actual: ' //',
                expected: false,
            },
            {
                actual: '//',
                expected: false,
            },
            {
                actual: '/a/',
                expected: true,
            },
            {
                actual: '/a/ ',
                expected: true,
            },
            {
                actual: '  /a/   ',
                expected: true,
            },
            {
                actual: '/^regex$/',
                expected: true,
            },
        ])('isRegexPattern should return \'$expected\' for \'$actual\'', ({ actual, expected }) => {
            expect(RegExpUtils.isRegexPattern(actual)).toBe(expected);
        });
    });

    describe('negateRegexPattern', () => {
        test.each([
            {
                actual: 'a',
                expected: '^((?!a).)*$',
            },
            {
                actual: '/^a$/',
                expected: '/^((?!a).)*$/',
            },
            // Don't negate already negated regex
            {
                actual: '^((?!a).)*$',
                expected: '^((?!a).)*$',
            },
            {
                actual: '/^((?!a).)*$/',
                expected: '/^((?!a).)*$/',
            },
        ])('negateRegexPattern should return \'$expected\' for \'$actual\'', ({ actual, expected }) => {
            expect(RegExpUtils.negateRegexPattern(actual)).toBe(expected);
        });
    });

    // Tests are taken from:
    // https://github.com/AdguardTeam/tsurlfilter/blob/9b26e0b4a0e30b87690bc60f7cf377d112c3085c/packages/tsurlfilter/test/rules/simple-regex.test.ts
    describe('patternToRegexp', () => {
        test.each([
            {
                actual: '||example.org^',
                expected: `${ADBLOCK_URL_START_REGEX}example\\.org${ADBLOCK_URL_SEPARATOR_REGEX}`,
            },
            {
                actual: '|https://example.org|',
                expected: `${REGEX_START}https:\\/\\/example\\.org${REGEX_END}`,
            },
            {
                actual: '|https://example.org/[*]^',
                // eslint-disable-next-line max-len
                expected: `${REGEX_START}https:\\/\\/example\\.org\\/\\[${ADBLOCK_WILDCARD_REGEX}\\]${ADBLOCK_URL_SEPARATOR_REGEX}`,
            },
            {
                actual: '/(example)+\\.org/',
                expected: '(example)+\\.org',
            },
            {
                actual: '||',
                expected: REGEX_ANY_CHARACTERS,
            },
        ])('patternToRegexp should return \'$expected\' for \'$actual\'', ({ actual, expected }) => {
            expect(RegExpUtils.patternToRegexp(actual)).toBe(expected);
        });
    });
});
