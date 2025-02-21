import { describe, test } from 'vitest';

import { tokenizeExtended } from '../../src/extended-css-tokenizer';
import { TokenType } from '../../src/common/enums/token-types';
import { ExtendedCssPseudo } from '../../src/common/enums/extended-css-pseudos';
import { testTokenization } from '../helpers/test-utils';
import { createTests, type PseudoValues } from './helpers/test-creator';
import { generateDelimStream } from './helpers/delim-generator';

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
});
