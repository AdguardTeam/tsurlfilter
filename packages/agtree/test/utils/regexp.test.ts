import { describe, expect, test } from 'vitest';

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
            {
                actual: '/ex[[ampl[[e.com///.*/banner/',
                expected: true,
            },
            {
                actual: String.raw`/^htt[[[ps?:\/\/.*(example1|example2)\.(com|org)\//`,
                expected: true,
            },
            {
                actual: String.raw`/\.example\.com/.*[a-zA-Z0-9]({4}/`,
                expected: true,
            },
        ])('isRegexPattern should return \'$expected\' for \'$actual\'', ({ actual, expected }) => {
            expect(RegExpUtils.isRegexPattern(actual)).toBe(expected);
        });
    });

    describe('parseRegexLiteral', () => {
        test.each([
            // Not regular expression literals
            { actual: '', expected: null },
            { actual: '/', expected: null },
            { actual: '//', expected: null },
            { actual: 'plain string', expected: null },
            { actual: '/unclosed', expected: null },
            { actual: ' /test/', expected: null },
            // Regular expression literals
            { actual: '/test/', expected: { pattern: 'test', flags: '' } },
            { actual: '/test/gi', expected: { pattern: 'test', flags: 'gi' } },
            // Valid PCRE2, invalid JavaScript: the shape check does not compile
            { actual: '/a++/', expected: { pattern: 'a++', flags: '' } },
            {
                actual: String.raw`/a\/b/`,
                expected: { pattern: String.raw`a\/b`, flags: '' },
            },
            // A slash inside a character class does not close the literal
            { actual: '/[/]/', expected: { pattern: '[/]', flags: '' } },
            // A backslash escapes only the next character: here `\\` is an
            // escaped backslash, so the slash after it closes the literal
            {
                actual: String.raw`/a\\/`,
                expected: { pattern: String.raw`a\\`, flags: '' },
            },
            // Same for a character class: the `]` after an escaped backslash
            // closes the class, and the literal continues
            {
                actual: String.raw`/a[\\]b/`,
                expected: { pattern: String.raw`a[\\]b`, flags: '' },
            },
            // An escaped backslash does not stop a following `[` from opening
            // a character class
            {
                actual: String.raw`/a\\[b]/`,
                expected: { pattern: String.raw`a\\[b]`, flags: '' },
            },
            // The only slash after an escaped backslash is escaped as well
            { actual: String.raw`/a\\`, expected: null },
        ])('parseRegexLiteral should parse \'$actual\'', ({ actual, expected }) => {
            expect(RegExpUtils.parseRegexLiteral(actual)).toEqual(expected);
        });
    });

    describe('parseCoreLibsRegexArgument', () => {
        test.each([
            // Not normal CoreLibs regular expressions: too short, no leading
            // slash, no closing slash, an uppercase flag, an empty pattern, or
            // the underflow class (only lowercase letters after the leading
            // slash). See isCoreLibsRegexArgument for the underflow class.
            { actual: '', expected: null },
            { actual: '/', expected: null },
            { actual: '//', expected: null },
            { actual: 'plain string', expected: null },
            { actual: ' /test/', expected: null },
            { actual: '/ads', expected: null },
            { actual: '/ab', expected: null },
            { actual: '/1ab', expected: null },
            // CoreLibs strips trailing lowercase letters only
            { actual: '/ads/I', expected: null },
            // The stripped flags leave an empty pattern, so the argument is
            // literal text
            { actual: '//x', expected: null },
            { actual: '//abc', expected: null },
            // Regular expressions
            { actual: '/test/', expected: { pattern: 'test', flags: '' } },
            { actual: '/a++/', expected: { pattern: 'a++', flags: '' } },
            { actual: '/[/]/', expected: { pattern: '[/]', flags: '' } },
            // CoreLibs takes the last slash as the delimiter and ignores
            // escapes and character classes, unlike a JavaScript literal
            // scanner
            {
                actual: String.raw`/a\/`,
                expected: { pattern: 'a\\', flags: '' },
            },
            {
                actual: '/a[b/',
                expected: { pattern: 'a[b', flags: '' },
            },
            // `///` is the regular expression `/`
            { actual: '///', expected: { pattern: '/', flags: '' } },
            // Every trailing lowercase letter is a flag, even if CoreLibs
            // does not honor it
            { actual: '/ads/i', expected: { pattern: 'ads', flags: 'i' } },
            { actual: '/a/bc', expected: { pattern: 'a', flags: 'bc' } },
            { actual: '/ads/', expected: { pattern: 'ads', flags: '' } },
            // Slashes inside the pattern are part of the pattern
            { actual: '/a/b/c/', expected: { pattern: 'a/b/c', flags: '' } },
            // Escapes are ignored, so the pattern keeps them
            {
                actual: String.raw`/a\\/`,
                expected: { pattern: String.raw`a\\`, flags: '' },
            },
            {
                actual: String.raw`/a[\\]b/`,
                expected: { pattern: String.raw`a[\\]b`, flags: '' },
            },
        ])('parseCoreLibsRegexArgument should parse \'$actual\'', ({ actual, expected }) => {
            expect(RegExpUtils.parseCoreLibsRegexArgument(actual)).toEqual(expected);
        });
    });

    describe('isCoreLibsRegexArgument', () => {
        test.each([
            // Not regular expressions for CoreLibs
            { actual: '', expected: false },
            { actual: '/', expected: false },
            { actual: '//', expected: false },
            { actual: 'plain string', expected: false },
            { actual: ' /test/', expected: false },
            // An uppercase flag is not stripped, and the last character is not
            // a slash
            { actual: '/ads/I', expected: false },
            // Not only lowercase letters after the leading slash: the last
            // character before the stripped flags is not a slash
            { actual: '/1ab', expected: false },
            // The stripped flags leave an empty pattern
            { actual: '//a', expected: false },
            { actual: '//abc', expected: false },
            // Normal CoreLibs regular expressions
            { actual: '/test/', expected: true },
            { actual: '/a++/', expected: true },
            { actual: '/ads/', expected: true },
            { actual: '/ads/i', expected: true },
            { actual: '/a/b/c/', expected: true },
            { actual: '///', expected: true },
            { actual: String.raw`/a\/`, expected: true },
            { actual: '/a[b/', expected: true },
            // The underflow class: `/` followed only by lowercase letters.
            // CoreLibs strips all of them and takes the regexp branch.
            { actual: '/ads', expected: true },
            { actual: '/ab', expected: true },
        ])('isCoreLibsRegexArgument should return \'$expected\' for \'$actual\'', ({ actual, expected }) => {
            expect(RegExpUtils.isCoreLibsRegexArgument(actual)).toBe(expected);
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
    describe('isNegatedRegexPattern', () => {
        test.each([
            {
                pattern: '/^((?!a).)*$/',
                expected: true,
            },
            {
                pattern: '/^((?!\\/page).)*$/',
                expected: true,
            },
            {
                pattern: '/ex[[ampl[[e.com///.*/banner/',
                expected: false,
            },
        ])('should return $expected for $pattern', ({ pattern, expected }) => {
            expect(RegExpUtils.isNegatedRegexPattern(pattern)).toBe(expected);
        });
    });
    describe('ensureSlashes', () => {
        test.each([
            {
                pattern: 'abc',
                expected: '/abc/',
            },
            {
                pattern: '  abc  ',
                expected: '/  abc  /',
            },
            {
                pattern: '/abc/',
                expected: '/abc/',
            },
            {
                pattern: '/abc',
                expected: '/abc/',
            },
            {
                pattern: 'abc/',
                expected: '/abc/',
            },
        ])('ensureSlashes should return "$expected" for pattern "$pattern"', ({ pattern, expected }) => {
            expect(RegExpUtils.ensureSlashes(pattern)).toBe(expected);
        });
    });
    describe('removeNegationFromRegexPattern', () => {
        test.each([
            {
                pattern: '/^((?!a).)*$/',
                expected: '/a/',
            },
            {
                pattern: '/^((?!\\/page).)*$/',
                expected: String.raw`/\/page/`,
            },
            {
                pattern: '/example.com/',
                expected: '/example.com/',
            },
        ])('should return "$expected" for domain pattern "$pattern"', ({ pattern, expected }) => {
            expect(RegExpUtils.removeNegationFromRegexPattern(pattern)).toBe(expected);
        });
    });

    describe('getLengthRegexp', () => {
        describe('should return correct length regex', () => {
            test.each([
                {
                    min: 1,
                    max: 2,
                    expected: '/^(?=.{1,2}$).*/s',
                },
                {
                    min: 9,
                    max: null,
                    expected: '/^(?=.{9,}$).*/s',
                },
                {
                    min: null,
                    max: 10,
                    expected: '/^(?=.{0,10}$).*/s',
                },
                {
                    min: null,
                    max: null,
                    expected: '/^(?=.{0,}$).*/s',
                },
            ])('should return correct length regex for min: $min and max: $max', ({ min, max, expected }) => {
                expect(RegExpUtils.getLengthRegexp(min, max)).toBe(expected);
            });
        });

        describe('regexp should match as expected', () => {
            test.each([
                // basic cases
                {
                    min: 1,
                    max: 2,
                    actual: '',
                    expected: false,
                },
                {
                    min: 1,
                    max: 2,
                    actual: 'a',
                    expected: true,
                },
                {
                    min: 1,
                    max: 2,
                    actual: 'a'.repeat(2),
                    expected: true,
                },
                {
                    min: 1,
                    max: 2,
                    actual: 'a'.repeat(3),
                    expected: false,
                },

                // max not specified
                {
                    min: 1,
                    max: null,
                    actual: '',
                    expected: false,
                },
                {
                    min: 1,
                    max: null,
                    actual: 'a',
                    expected: true,
                },
                {
                    min: 1,
                    max: null,
                    actual: 'a'.repeat(100),
                    expected: true,
                },

                // min not specified
                {
                    min: null,
                    max: 2,
                    actual: '',
                    expected: true,
                },
                {
                    min: null,
                    max: 2,
                    actual: 'a',
                    expected: true,
                },
                {
                    min: null,
                    max: 2,
                    actual: 'a'.repeat(3),
                    expected: false,
                },

                // both min and max not specified
                {
                    min: null,
                    max: null,
                    actual: '',
                    expected: true,
                },
                {
                    min: null,
                    max: null,
                    actual: 'a',
                    expected: true,
                },
                {
                    min: null,
                    max: null,
                    actual: 'a'.repeat(100),
                    expected: true,
                },

                // matching new lines
                {
                    min: 2,
                    max: 4,
                    actual: 'a\n',
                    expected: true,
                },
                {
                    min: 2,
                    max: 4,
                    actual: 'a\nb',
                    expected: true,
                },
                {
                    min: 2,
                    max: 4,
                    actual: 'a\nb\n',
                    expected: true,
                },
                {
                    min: 2,
                    max: 4,
                    actual: 'a\nb\nc',
                    expected: false,
                },
            ])('should return $expected for min: $min and max: $max', ({
                min,
                max,
                actual,
                expected,
            }) => {
                const regexp = RegExpUtils.getLengthRegexp(min, max);
                // remove leading and trailing slashes and 's' flag
                const withoutSlashes = regexp.substring(1, regexp.length - 2);

                expect(new RegExp(withoutSlashes, 's').test(actual)).toBe(expected);
            });
        });
    });

    describe('globToRegExp', () => {
        test.each([
            {
                actual: '*example*text*',
                expected: '/^.*example.*text.*$/s',
            },
            {
                actual: '*example*$*.com',
                expected: '/^.*example.*\\$.*\\.com$/s',
            },
            {
                actual: '*[test]*{test}*',
                expected: '/^.*\\[test\\].*\\{test\\}.*$/s',
            },
        ])("should return '$expected' for glob '$actual'", ({ actual, expected }) => {
            expect(RegExpUtils.globToRegExp(actual)).toBe(expected);
        });
    });
});
