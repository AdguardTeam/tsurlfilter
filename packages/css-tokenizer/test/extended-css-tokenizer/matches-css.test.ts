import { describe, test } from 'vitest';

import { tokenizeExtended } from '../../src/extended-css-tokenizer';
import { ExtendedCssPseudo } from '../../src/common/enums/extended-css-pseudos';
import { testTokenization } from '../helpers/test-utils';
import { createTests, type PseudoValues } from './helpers/test-creator';
import { generateDelimStream } from './helpers/delim-generator';

const PSEUDO_NAMES = [
    ExtendedCssPseudo.MatchesCss,
];

const PSEUDO_VALUES: PseudoValues = {
    ...generateDelimStream([
        String.raw`:matches-css(width:720px)`,
        String.raw`:matches-css(width: 720px)`,
        String.raw`:matches-css(background-image: /^url\("data:image\/gif;base64.+/)`,
        String.raw`:matches-css(    background-image: /^url\("data:image\/gif;base64.+/    ) + a[href="https://www.example.com/"]`,
        String.raw`:matches-css(background-image:url(data:*))`,
    ]),
};

describe(`Extended CSS's :${PSEUDO_NAMES.join(', :')}`, () => {
    test.each(
        createTests(PSEUDO_NAMES, PSEUDO_VALUES),
    )("should tokenize '$actual' as $as", (testData) => testTokenization(testData, tokenizeExtended));
});
