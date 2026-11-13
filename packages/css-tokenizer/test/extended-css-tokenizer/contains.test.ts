import { describe, expect, test } from 'vitest';

import { ExtendedCssPseudo } from '../../src/common/enums/extended-css-pseudos';
import { TokenType } from '../../src/common/enums/token-types';
import { tokenizeExtended } from '../../src/extended-css-tokenizer';
import { testTokenization } from '../helpers/test-utils';

import { generateDelimStream } from './helpers/delim-generator';
import { createTests, type PseudoValues } from './helpers/test-creator';

const PSEUDO_NAMES = [
    ExtendedCssPseudo.Contains,
    ExtendedCssPseudo.HasText,
    ExtendedCssPseudo.AbpContains,
];

const PSEUDO_VALUES: PseudoValues = {
    ...generateDelimStream([
        String.raw``, // empty
        String.raw` `, // single space
        String.raw`  `, // multiple spaces
        String.raw`a`, // single character
        String.raw`ab`, // multiple characters
        String.raw`a b`, // multiple characters with single space
        String.raw`a  b`, // multiple characters with multiple spaces
        String.raw` a`, // single character preceded by single space
        String.raw`  a`, // single character preceded by multiple spaces
        String.raw`a `, // single character followed by single space
        String.raw`a  `, // single character followed by multiple spaces
        String.raw` a `, // single character surrounded by single spaces
        String.raw`  a  `, // single character surrounded by multiple spaces
        String.raw` a  b `, // multiple characters surrounded by single spaces
        String.raw`  a  b  `, // multiple characters surrounded by multiple spaces
        String.raw`a b c`, // multiple characters with multiple spaces
        String.raw`\(`, // escaped left parenthesis
        String.raw`\)`, // escaped right parenthesis
        String.raw`\(\)`, // escaped parentheses
        String.raw`\)\(`, // escaped parentheses (reversed)
        String.raw`()`, // balanced parentheses
        String.raw`()(())`, // multiple balanced parentheses
        String.raw`(a)`, // single character with balanced parentheses
        String.raw`(a)(())`, // single character with multiple balanced parentheses
        String.raw`(ab)`, // multiple characters with balanced parentheses
        String.raw`a(\))(\()b`, // escaped parentheses with balanced parentheses
        String.raw`/a/`, // simple regular expression
        String.raw`/a/i`, // regular expression with flags
        String.raw`/a/ig`, // regular expression with multiple flags
        String.raw`/a\/b/`, // regular expression with escaped forward slash
        String.raw`/(a|b)/`, // regular expression with balanced parentheses
        String.raw`/^(a|b){3,}$/ig`, // regular expression with balanced parentheses and quantifiers and flags
        String.raw`/a\(\)/i`, // regular expression with escaped parentheses
        String.raw`/a[)]b/`, // right parenthesis in a regexp character class
        String.raw`/[(]a[)]b/`, // parentheses in regexp character classes
        String.raw`/a[^)]b/`, // negated character class with a right parenthesis
        String.raw`/a[\\)]b/`, // escaped reverse solidus before the right parenthesis in a class
        String.raw`/a[\\)]b/i`, // same with a flag
        String.raw`/a[)]b/i`, // right parenthesis in a class and a flag
        String.raw`/a\/[)]b/`, // escaped solidus before a class with a right parenthesis
        String.raw`/[/)]/`, // solidus and right parenthesis in a class
        String.raw`/[\])]/`, // escaped right square bracket before a right parenthesis in a class
        String.raw`/(a\\)/`, // right parenthesis after an escaped reverse solidus
        String.raw`/foo[bar`, // plain text with a solidus but no closing solidus, so no regexp literal
    ]),

    // 1-length string
    [String.raw`'a'`]: [
        [TokenType.String, 0, 3],
    ],
    [String.raw`"a"`]: [
        [TokenType.String, 0, 3],
    ],

    // 2-length string
    [String.raw`'ab'`]: [
        [TokenType.String, 0, 4],
    ],
    [String.raw`"ab"`]: [
        [TokenType.String, 0, 4],
    ],

    // ) in string
    [String.raw`'a)'`]: [
        [TokenType.String, 0, 4],
    ],
    [String.raw`"a)"`]: [
        [TokenType.String, 0, 4],
    ],

    // ( in string
    [String.raw`'a('`]: [
        [TokenType.String, 0, 4],
    ],
    [String.raw`"a("`]: [
        [TokenType.String, 0, 4],
    ],

    // ( and ) in string
    [String.raw`'a()b'`]: [
        [TokenType.String, 0, 6],
    ],
    [String.raw`"a()b"`]: [
        [TokenType.String, 0, 6],
    ],

    // string + something
    [String.raw`'a' 12px`]: [
        [TokenType.String, 0, 3],
        [TokenType.Whitespace, 3, 4],
        [TokenType.Dimension, 4, 8],
    ],

    // single space + string
    [String.raw` 'a'`]: [
        [TokenType.Whitespace, 0, 1],
        [TokenType.String, 1, 4],
    ],

    // multiple spaces + string
    [String.raw`  'a'`]: [
        [TokenType.Whitespace, 0, 2],
        [TokenType.String, 2, 5],
    ],

    // string + single space
    [String.raw`'a' `]: [
        [TokenType.String, 0, 3],
        [TokenType.Whitespace, 3, 4],
    ],

    // string + multiple spaces
    [String.raw`'a'  `]: [
        [TokenType.String, 0, 3],
        [TokenType.Whitespace, 3, 5],
    ],
};

describe(`Extended CSS's :${PSEUDO_NAMES.join(', :')}`, () => {
    test.each(
        createTests(PSEUDO_NAMES, PSEUDO_VALUES),
    )("should tokenize '$actual' as $as", (testData) => testTokenization(testData, tokenizeExtended));
});

describe('Extended CSS pseudo-class argument boundaries', () => {
    test.each([
        {
            // a regexp with a right parenthesis in a character class keeps the
            // whole argument, and the following selector stays outside it
            actual: 'div:has-text(/a[)]b/) + a[href="/x]y/"]',
            expectedArgument: '/a[)]b/',
        },
        {
            // a later selector with a `]` and `/` must not turn the plain-text
            // argument into a regexp
            actual: 'div:has-text(/foo[bar) + a[href="/x]y/"]',
            expectedArgument: '/foo[bar',
        },
        {
            // text after the literal stays in the argument, and the parenthesis
            // inside the character class does not close it
            actual: 'div:has-text(/a[)]b/ + a)',
            expectedArgument: '/a[)]b/ + a',
        },
        {
            // an unbalanced parenthesis outside a class makes the solidus plain
            // text, so the first parenthesis still closes the argument
            actual: 'div:has-text(/a)b[)]c/)',
            expectedArgument: '/a',
        },
        {
            // a right parenthesis in a character class of a `property: value`
            // regexp keeps the whole argument and the following selector
            actual: 'div:matches-css(background-image: /^url\\([)]/) + a[href="/x]y/"]',
            expectedArgument: 'background-image: /^url\\([)]/',
        },
        {
            // a later selector with a `]` and `/` must not turn the plain-text
            // `property: value` argument into a regexp
            actual: 'div:matches-css(background-image: /foo[bar) + a[href="/x]y/"]',
            expectedArgument: 'background-image: /foo[bar',
        },
    ])("should close the $actual pseudo-class after '$expectedArgument'", ({ actual, expectedArgument }) => {
        const tokens: Array<[TokenType, number, number]> = [];

        tokenizeExtended(actual, (type, start, end) => {
            tokens.push([type, start, end]);
        });

        // The argument starts after the function token and ends at the first closing
        // parenthesis that follows it
        const functionIndex = tokens.findIndex(([type]) => type === TokenType.Function);
        const closingParenthesisIndex = tokens.findIndex(
            ([type], index) => index > functionIndex && type === TokenType.CloseParenthesis,
        );
        const argument = tokens
            .slice(functionIndex + 1, closingParenthesisIndex)
            .map(([, start, end]) => actual.slice(start, end))
            .join('');

        expect(argument).toBe(expectedArgument);
    });
});
