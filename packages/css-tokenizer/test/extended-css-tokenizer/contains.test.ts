import { describe, test } from 'vitest';

import { tokenizeExtended } from '../../src/extended-css-tokenizer';
import { TokenType } from '../../src/common/enums/token-types';
import { ExtendedCssPseudo } from '../../src/common/enums/extended-css-pseudos';
import { testTokenization } from '../helpers/test-utils';
import { createTests, type PseudoValues } from './helpers/test-creator';
import { generateDelimStream } from './helpers/delim-generator';

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
