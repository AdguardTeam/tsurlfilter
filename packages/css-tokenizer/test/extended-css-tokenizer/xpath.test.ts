import { describe, test } from 'vitest';

import { ExtendedCssPseudo } from '../../src/common/enums/extended-css-pseudos';
import { TokenType } from '../../src/common/enums/token-types';
import { tokenizeExtended } from '../../src/extended-css-tokenizer';
import { type TokenData } from '../helpers/test-interfaces';
import { testTokenization } from '../helpers/test-utils';

import { generateDelimStream } from './helpers/delim-generator';
import { createTests, type PseudoValues } from './helpers/test-creator';

const PSEUDO_NAMES = [
    ExtendedCssPseudo.Xpath,
];

const COMPLEX_XPATH = String.raw`//*[contains(text(),"()(cc")]`;
const COMPLEX_XPATH_ESCAPED_QUOTE = String.raw`//*[contains(text(),\"()(cc\")]`;

const PSEUDO_VALUES: PseudoValues = {
    // simple XPath
    ...generateDelimStream([
        String.raw`//test`,
        String.raw` //test`, // preceded by single space
        String.raw`  //test`, // preceded by multiple spaces
        String.raw`//test `, // followed by single space
        String.raw`//test  `, // followed by multiple spaces
    ]),

    // simple XPath as string parameter
    [String.raw`'//test'`]: [
        [TokenType.String, 0, 8],
    ],
    [String.raw`"//test"`]: [
        [TokenType.String, 0, 8],
    ],

    // simple XPath as string parameter preceded by single space
    [String.raw` '//test'`]: [
        [TokenType.Whitespace, 0, 1],
        [TokenType.String, 1, 9],
    ],
    [String.raw` "//test"`]: [
        [TokenType.Whitespace, 0, 1],
        [TokenType.String, 1, 9],
    ],

    // simple XPath as string parameter preceded by multiple spaces
    [String.raw`  '//test'`]: [
        [TokenType.Whitespace, 0, 2],
        [TokenType.String, 2, 10],
    ],
    [String.raw`  "//test"`]: [
        [TokenType.Whitespace, 0, 2],
        [TokenType.String, 2, 10],
    ],

    // simple XPath as string parameter followed by single space
    [String.raw`'//test' `]: [
        [TokenType.String, 0, 8],
        [TokenType.Whitespace, 8, 9],
    ],
    [String.raw`"//test" `]: [
        [TokenType.String, 0, 8],
        [TokenType.Whitespace, 8, 9],
    ],

    // simple XPath as string parameter followed by multiple spaces
    [String.raw`'//test'  `]: [
        [TokenType.String, 0, 8],
        [TokenType.Whitespace, 8, 10],
    ],
    [String.raw`"//test"  `]: [
        [TokenType.String, 0, 8],
        [TokenType.Whitespace, 8, 10],
    ],

    // complex XPath
    ...generateDelimStream([
        COMPLEX_XPATH,
    ]),

    // XPath with parentheses and quotes inside literals
    ...generateDelimStream([
        // a right parenthesis inside a single-quoted literal
        String.raw`//div[contains(text(),')')]`,
        // a quotation mark inside a single-quoted literal
        String.raw`//div[@a='x"y']`,
        // only the matching quotation mark closes a literal
        String.raw`//div[@a='x")y']`,
        // double-quoted forms already handled the other quote
        String.raw`//div[contains(text(),")")]`,
        String.raw`//div[@a="x'y"]`,
        // mixed quotes
        String.raw`//div[contains(text(),'x') and @a="y"]`,
        // a dangling CSS-escaped quote does not start a literal
        String.raw`//div[contains(text(),\')]`,
        String.raw`//div[@a=\"x]`,
        // XPath literals have no escape sequences, so a reverse solidus does not escape the closing quote
        String.raw`//div[@a='C:\']`,
        String.raw`//div[@a="C:\"]`,
        // both reverse solidi of a CSS-escaped reverse solidus are plain characters inside a literal
        String.raw`//div[@a='C:\\']`,
        String.raw`//div[@a="C:\\"]`,
        // an escaped opening quote is paired with the closing quote
        String.raw`//div[@a=\'x']`,
        // an escaped opening quote is paired with the closing quote, and a parenthesis inside stays literal
        String.raw`//div[contains(text(),\')')]`,
        // an escaped reverse solidus before a parenthesis does not escape the parenthesis
        String.raw`//a[contains(a\\)]`,
        // a single escaped parenthesis does not change the balance
        String.raw`//a[contains(a\))]`,
    ]),

    // complex XPath as string parameter
    [`'${COMPLEX_XPATH}'`]: [
        [TokenType.String, 0, 2 + COMPLEX_XPATH.length],
    ],
    [`"${COMPLEX_XPATH_ESCAPED_QUOTE}"`]: [
        [TokenType.String, 0, 2 + COMPLEX_XPATH_ESCAPED_QUOTE.length],
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

    test('should not close the pseudo-class when a literal is not closed', () => {
        const actual = String.raw`:xpath(//div[@a="x])`;

        const expected: TokenData[] = [
            // :xpath(
            [TokenType.Colon, 0, 1],
            [TokenType.Function, 1, 7],
            // The unclosed literal hides the closing parenthesis, so the rest of the source
            // is tokenized as delim-tokens and the parser reports the missing parenthesis
            ...actual.slice(7).split('').map((_, index): TokenData => [
                TokenType.Delim,
                7 + index,
                8 + index,
            ]),
        ];

        testTokenization({ actual, expected }, tokenizeExtended);
    });
});
