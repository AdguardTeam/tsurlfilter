import { ByteBuffer } from '../../src/utils/byte-buffer';
import { encodeText } from '../../src/utils/text-encoder';
import { decodeText } from '../../src/utils/text-decoder';

describe('Text Encoder and Decoder', () => {
    test.each([
        // test with empty string
        {
            actual: '',
            expected: '',
        },

        // test with whitespace characters
        {
            actual: '   ',
            expected: '   ',
        },

        // test with some basic characters
        {
            actual: 'foo,bar,baz',
            expected: 'foo,bar,baz',
        },
        {
            actual: 'árvíztűrő tükörfúrógép',
            expected: 'árvíztűrő tükörfúrógép',
        },

        // test with special characters
        {
            actual: '!@#$%^&*()€',
            expected: '!@#$%^&*()€',
        },

        // test with numbers
        {
            actual: '1234567890',
            expected: '1234567890',
        },

        // test with newline characters
        {
            actual: '\n',
            expected: '\n',
        },

        // test with tab characters
        {
            actual: '\t',
            expected: '\t',
        },

        // test some unicode characters
        {
            actual: '👋🌍',
            expected: '👋🌍',
        },
        {
            actual: '你好',
            expected: '你好',
        },
        {
            actual: 'Hello, 世界! 👋',
            expected: 'Hello, 世界! 👋',
        },
        {
            actual: '안녕 세계',
            expected: '안녕 세계',
        },
        {
            actual: 'مرحبا بالعالم',
            expected: 'مرحبا بالعالم',
        },

        // TODO: add more tests
    ])("encode and decode should work for '$actual'", ({ actual, expected }) => {
        const byteBuffer = new ByteBuffer();
        const bytesWritten = encodeText(actual, byteBuffer, 0);
        const decodeResult = decodeText(byteBuffer, 0);
        expect(decodeResult).toHaveProperty('bytesConsumed', bytesWritten);
        expect(decodeResult).toHaveProperty('decodedText', expected);
    });
});
