import { encodeIntoPolyfill } from '../../src/utils/text-encoder-polyfill';
import { decodeTextPolyfill } from '../../src/utils/text-decoder-polyfill';

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
        // https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder/encodeInto#buffer_sizing
        const buffer = new Uint8Array(actual.length * 3);
        const { written } = encodeIntoPolyfill(actual, buffer);
        expect(decodeTextPolyfill(buffer, 0, written)).toEqual(expected);
    });
});
