import { TokenType } from '../../src/common/enums/token-types';
import { addAsProp, testTokenization } from '../helpers/test-utils';

describe('comment-token', () => {
    test.each(addAsProp([
        // single comment
        {
            actual: '/* comment */',
            expected: [
                [TokenType.Comment, 0, 13],
            ],
        },
        // multiple comments separated by whitespace
        {
            actual: '/* comment 1 */ /* comment 2 */',
            expected: [
                [TokenType.Comment, 0, 15],
                [TokenType.Whitespace, 15, 16],
                [TokenType.Comment, 16, 31],
            ],
        },
        // tokenizer should tolerate missing closing comment mark according to the spec
        {
            actual: '/* comment',
            expected: [
                [TokenType.Comment, 0, 10],
            ],
        },
        // extra space at the end
        {
            actual: '/* comment ',
            expected: [
                [TokenType.Comment, 0, 11],
            ],
        },
        // last comment's closing mark is missing
        {
            actual: '/* comment 1 */ /* comment 2 */ /* comment 3',
            expected: [
                [TokenType.Comment, 0, 15],
                [TokenType.Whitespace, 15, 16],
                [TokenType.Comment, 16, 31],
                [TokenType.Whitespace, 31, 32],
                [TokenType.Comment, 32, 44],
            ],
        },
    ]))("should tokenize '$actual' as $as", testTokenization);
});
