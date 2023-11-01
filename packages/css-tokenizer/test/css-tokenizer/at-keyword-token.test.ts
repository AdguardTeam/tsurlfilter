import { TokenType } from '../../src/common/enums/token-types';
import { addAsProp, testTokenization } from '../helpers/test-utils';

describe('at-keyword-token', () => {
    test.each(addAsProp([
        {
            actual: '@import',
            expected: [
                [TokenType.AtKeyword, 0, 7],
            ],
        },
        {
            actual: '@charset "utf-8";',
            expected: [
                [TokenType.AtKeyword, 0, 8],
                [TokenType.Whitespace, 8, 9],
                [TokenType.String, 9, 16],
                [TokenType.Semicolon, 16, 17],
            ],
        },
    ]))("should tokenize '$actual' as $as", testTokenization);
});
