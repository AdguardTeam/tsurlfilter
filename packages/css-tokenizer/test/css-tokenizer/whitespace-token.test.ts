import { TokenType } from '../../src/common/enums/token-types';
import { addAsProp, testTokenization } from '../helpers/test-utils';

describe('whitespace', () => {
    test.each(addAsProp([
        {
            name: 'single space',
            actual: ' ',
            expected: [
                [TokenType.Whitespace, 0, 1],
            ],
        },
        {
            name: 'multiple spaces',
            actual: '  ',
            expected: [
                [TokenType.Whitespace, 0, 2],
            ],
        },
        {
            name: 'tab',
            actual: '\t',
            expected: [
                [TokenType.Whitespace, 0, 1],
            ],
        },
        {
            name: 'newline (LF)',
            actual: '\n',
            expected: [
                [TokenType.Whitespace, 0, 1],
            ],
        },
        {
            name: 'carriage return (CR)',
            actual: '\r',
            expected: [
                [TokenType.Whitespace, 0, 1],
            ],
        },
        {
            name: 'form feed (FF)',
            actual: '\f',
            expected: [
                [TokenType.Whitespace, 0, 1],
            ],
        },
        {
            name: 'carriage return + newline (CRLF)',
            actual: '\r\n',
            expected: [
                [TokenType.Whitespace, 0, 2],
            ],
        },
    ]))("should tokenize '$actual' as $as", testTokenization);
});
