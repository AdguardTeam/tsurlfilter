import { describe, test } from 'vitest';

import { TokenType } from '../../src/common/enums/token-types';
import { addAsProp, testTokenization } from '../helpers/test-utils';

describe('cdo-token and cdc-token', () => {
    test.each(addAsProp([
        {
            actual: '<!--',
            expected: [
                [TokenType.Cdo, 0, 4],
            ],
        },
        {
            actual: '-->',
            expected: [
                [TokenType.Cdc, 0, 3],
            ],
        },
    ]))("should tokenize '$actual' as $as", (testCase) => {
        testTokenization(testCase);
    });
});
