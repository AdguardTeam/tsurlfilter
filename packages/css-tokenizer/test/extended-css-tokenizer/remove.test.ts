import { describe, test } from 'vitest';

import { ExtendedCssPseudo } from '../../src/common/enums/extended-css-pseudos';
import { TokenType } from '../../src/common/enums/token-types';
import { tokenizeExtended } from '../../src/extended-css-tokenizer';
import { testTokenization } from '../helpers/test-utils';

import { generateDelimStream } from './helpers/delim-generator';
import { createTests, type PseudoValues } from './helpers/test-creator';

const PSEUDO_NAMES = [
    ExtendedCssPseudo.RemoveAttr,
    ExtendedCssPseudo.RemoveClass,
];

const PSEUDO_VALUES: PseudoValues = {
    ...generateDelimStream([
        String.raw`href`, // plain attribute name
        String.raw`onclick`, // plain attribute name
        String.raw`ads`, // plain class name
        String.raw`/^on[a-z]+/`, // regexp
        String.raw`/^ad-/`, // short regexp
        String.raw`/^data-(foo|bar)$/i`, // regexp with flags
        String.raw`/^data-[0-9]+$/`, // regexp with character class
        // The argument may contain curly brackets, which are not valid
        // in a selector list, so the tokenizer must not parse it as a selector
        String.raw`/^data-.{2}$/`, // regexp with quantifier
        String.raw` href `, // plain name surrounded by spaces
    ]),

    // Quoted arguments are tokenized as strings
    [String.raw`"onclick"`]: [
        [TokenType.String, 0, 9],
    ],
    [String.raw`'ads'`]: [
        [TokenType.String, 0, 5],
    ],
};

describe(`Extended CSS's :${PSEUDO_NAMES.join(', :')}`, () => {
    test.each(
        createTests(PSEUDO_NAMES, PSEUDO_VALUES),
    )("should tokenize '$actual' as $as", (testData) => testTokenization(testData, tokenizeExtended));
});
