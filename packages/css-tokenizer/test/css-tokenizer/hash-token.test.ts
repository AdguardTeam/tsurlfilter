import { TokenType } from '../../src/common/enums/token-types';
import { addAsProp, testTokenization } from '../helpers/test-utils';

describe('hash-token', () => {
    test.each(addAsProp([
        {
            actual: '#00ff00',
            expected: [
                [TokenType.Hash, 0, 7],
            ],
        },
        {
            actual: '#00aabb\\cc',
            expected: [
                [TokenType.Hash, 0, 10],
            ],
        },
    ]))("should tokenize '$actual' as $as", testTokenization);
});
