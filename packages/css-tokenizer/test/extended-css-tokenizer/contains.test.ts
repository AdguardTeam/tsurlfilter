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
        String.raw`/[^)(]+/`, // class with a right parenthesis before an opening parenthesis
        String.raw`/[)(]/`, // class with a right parenthesis before an opening parenthesis
        String.raw`/[)[]/`, // class with a right parenthesis before an opening square bracket
        String.raw`/[^(]*x/`, // class with an opening parenthesis
        String.raw`/document\.write[(]/`, // class with an opening parenthesis and no other parentheses
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

/**
 * Collects the raw arguments of the top-level function tokens.
 *
 * The argument text is rebuilt from the source between a function name and its
 * matching closing parenthesis. A nested function stays a part of the outer
 * argument.
 *
 * @param actual Source string to tokenize.
 *
 * @returns Argument text of each top-level function, in source order.
 *
 * @throws If a top-level function has no closing parenthesis in the source.
 */
const collectFunctionArguments = (actual: string): string[] => {
    const tokens: Array<[TokenType, number, number]> = [];

    tokenizeExtended(actual, (type, start, end) => {
        tokens.push([type, start, end]);
    });

    const result: string[] = [];
    let index = 0;

    while (index < tokens.length) {
        if (tokens[index][0] !== TokenType.Function) {
            index += 1;
            continue;
        }

        let depth = 1;
        let endIndex = index + 1;

        while (endIndex < tokens.length && depth > 0) {
            const type = tokens[endIndex][0];

            if (type === TokenType.Function || type === TokenType.OpenParenthesis) {
                depth += 1;
            } else if (type === TokenType.CloseParenthesis) {
                depth -= 1;
            }

            endIndex += 1;
        }

        if (depth !== 0) {
            throw new Error(`The function at index ${index} in '${actual}' has no closing parenthesis`);
        }

        result.push(
            tokens.slice(index + 1, endIndex - 1).map(([, start, end]) => actual.slice(start, end)).join(''),
        );
        index = endIndex;
    }

    return result;
};

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
        {
            // an opening parenthesis in a class does not make the class-blind
            // scan lose the closing parenthesis of the argument
            actual: 'div:has-text(/document\\.write[(]/)',
            expectedArgument: '/document\\.write[(]/',
        },
        {
            // the same for a `property: value` argument
            actual: 'div:matches-css(background-image: /document\\.write[(]/)',
            expectedArgument: 'background-image: /document\\.write[(]/',
        },
        {
            // a class may list a right parenthesis before another parenthesis
            // or an opening square bracket
            actual: 'div:has-text(/[^)(]+/) + p',
            expectedArgument: '/[^)(]+/',
        },
        {
            // an opening parenthesis that follows a pseudo-class name starts the
            // next selector, while an opening parenthesis right after the
            // parenthesis in the class belongs to the regexp
            actual: 'div:has-text(/foo[bar):has-text(]/)',
            expectedArgument: '/foo[bar',
        },
        {
            // an opening square bracket that follows a name starts an attribute
            // selector, so the later solidus does not close a regexp literal
            actual: 'div:has-text(/foo[bar) + a[href="/x]y/"])',
            expectedArgument: '/foo[bar',
        },
        {
            // the same for an attribute selector after a combinator
            actual: 'div:has-text(/foo[bar) + [href="/x]y/"])',
            expectedArgument: '/foo[bar',
        },
        {
            // a regexp in the following pseudo-class must not extend the previous
            // argument
            actual: 'div:contains(foo):matches-css(color: /red/)',
            expectedArgument: 'foo',
        },
        {
            // the same for a chain of matches-css pseudo-classes
            actual: 'nyafilmer.lol#?#body > div[class]:empty:matches-css(position: fixed):matches-css(z-index: /\\d+/)',
            expectedArgument: 'position: fixed',
        },
        {
            // a right parenthesis inside a quoted value does not close the argument
            actual: 'div:matches-css(a: "x)y", b: /c/)',
            expectedArgument: 'a: "x)y", b: /c/',
        },
        {
            // the same when the quoted value is the value of the only property
            actual: 'div:matches-css(a: "x)y")',
            expectedArgument: 'a: "x)y"',
        },
        {
            // the same when the property is not a `matches-css` declaration
            actual: 'div:matches-attr(data-x="a)b")',
            expectedArgument: 'data-x="a)b"',
        },
        {
            // the same for an apostrophe-quoted value
            actual: "div:matches-css(a: 'x)y', b: 'z)w')",
            expectedArgument: "a: 'x)y', b: 'z)w'",
        },
        {
            // a quoted value that contains the character class parenthesis does not
            // hide the right parenthesis of the following `property: value` part
            actual: 'div:matches-css(a: /c[)]d/, e: "f)g")',
            expectedArgument: 'a: /c[)]d/, e: "f)g"',
        },
        {
            // an apostrophe in plain text does not open a quoted value, so the
            // following parenthesis still closes the argument
            actual: "div:contains(it's):matches-css(color: /red/)",
            expectedArgument: "it's",
        },
        {
            // an unclosed quote inside a regexp literal must not pair with a quote in
            // a following pseudo-class
            actual: 'div:contains(/a:"b/), span:contains("c")',
            expectedArgument: '/a:"b/',
        },
        {
            // the same for a quote inside a regexp literal of a nested pseudo-class
            actual: 'div:has(:contains(/label:"open/)):contains("next")',
            expectedArgument: ':contains(/label:"open/)',
        },
    ])("should close the $actual pseudo-class after '$expectedArgument'", ({ actual, expectedArgument }) => {
        expect(collectFunctionArguments(actual)[0]).toBe(expectedArgument);
    });

    test.each([
        {
            actual: 'div:contains(foo):matches-css(color: /red/)',
            expected: ['foo', 'color: /red/'],
        },
        {
            actual: 'nyafilmer.lol#?#body > div[class]:empty:matches-css(position: fixed):matches-css(z-index: /\\d+/)',
            expected: ['position: fixed', 'z-index: /\\d+/'],
        },
        {
            actual: 'div:has(> a:contains(ad)):matches-css(display: /block/)',
            expected: ['> a:contains(ad)', 'display: /block/'],
        },
        {
            actual: "div:contains(it's):matches-css(color: /red/)",
            expected: ["it's", 'color: /red/'],
        },
        {
            actual: 'div:matches-css(a: "x)y", b: /c/):matches-css(z-index: /\\d+/)',
            expected: ['a: "x)y", b: /c/', 'z-index: /\\d+/'],
        },
        {
            // a quote inside a regexp literal must not pair with a quote in the
            // following pseudo-class
            actual: 'div:contains(/a:"b/), span:contains("c")',
            expected: ['/a:"b/', '"c"'],
        },
        {
            // the same for a regexp literal of a nested pseudo-class
            actual: 'div:has(:contains(/label:"open/)):contains("next")',
            expected: [':contains(/label:"open/)', '"next"'],
        },
        {
            actual: 'div:matches-attr(data-x="a)b"):matches-css(a: /c/)',
            expected: ['data-x="a)b"', 'a: /c/'],
        },
    ])("should tokenize '$actual' as separate pseudo-classes", ({ actual, expected }) => {
        expect(collectFunctionArguments(actual)).toEqual(expected);
    });
});
