import { decodeIdent } from '../../src/utils/ident-decoder';

describe('decodeIdent', () => {
    it.each([
        // empty string
        {
            actual: '',
            expected: '',
        },

        {
            actual: ' ',
            expected: ' ',
        },

        // no escape sequence
        {
            actual: 'ident',
            expected: 'ident',
        },
        {
            actual: '--ident',
            expected: '--ident',
        },
        {
            actual: 'cross-fade',
            expected: 'cross-fade',
        },

        // should decode escaped characters
        {
            actual: String.raw`\75`,
            expected: 'u',
        },

        // should decode escaped characters with leading zeros
        {
            actual: String.raw`\075`,
            expected: 'u',
        },
        {
            actual: String.raw`\00075`,
            expected: 'u',
        },

        // should decode strings that mix escaped characters and non-escaped characters
        {
            actual: String.raw`\75rl`,
            expected: 'url',
        },
        {
            actual: String.raw`\75\72l`,
            expected: 'url',
        },

        // should decode strings that only contain escaped characters - with and without leading zeros
        {
            actual: String.raw`\75\72\6C`,
            expected: 'url',
        },
        {
            actual: String.raw`\075\072\06C`,
            expected: 'url',
        },
        {
            actual: String.raw`\00075\00072\0006C`,
            expected: 'url',
        },

        // if the decoded hex value is 0, it should be replaced with the replacement character
        {
            actual: String.raw`\0`,
            expected: '\uFFFD',
        },
        {
            actual: String.raw`\00000`,
            expected: '\uFFFD',
        },
        // should work if string contain additional characters
        {
            actual: String.raw`\0ident`,
            expected: '\uFFFDident',
        },
        {
            actual: String.raw`\00000ident`,
            expected: '\uFFFDident',
        },

        // if the code point is greater than the maximum allowed code point,
        // it should be replaced with the replacement character
        {
            actual: String.raw`\110000`,
            expected: '\uFFFD',
        },

        // if the code point is between HIGH_SURROGATE_START and LOW_SURROGATE_END,
        // it should be replaced with the replacement character
        {
            actual: String.raw`\DBFF`,
            expected: '\uFFFD',
        },
        {
            actual: String.raw`\DC00`,
            expected: '\uFFFD',
        },
        {
            actual: String.raw`\DFFF`,
            expected: '\uFFFD',
        },
        {
            actual: String.raw`\D800`,
            expected: '\uFFFD',
        },
        {
            actual: String.raw`\DBFF`,
            expected: '\uFFFD',
        },
        {
            actual: String.raw`\DC00`,
            expected: '\uFFFD',
        },
        {
            actual: String.raw`\DFFF`,
            expected: '\uFFFD',
        },

        // should decode escape sequences
        {
            actual: '\\',
            expected: '',
        },
        {
            actual: '\\\\',
            expected: '',
        },
        {
            actual: String.raw`\ident`,
            expected: 'ident',
        },
        {
            actual: 'ident\\',
            expected: 'ident',
        },
        {
            actual: 'ident\\\\',
            expected: 'ident',
        },
        {
            actual: '\\#ident',
            expected: '#ident',
        },

        {
            actual: String.raw`ident\ ident`,
            expected: 'ident ident',
        },
        // if the code point after the escape sequence is whitespace, it should be consumed
        {
            actual: String.raw`\69\64\65\6e\74 ident`,
            expected: 'identident',
        },
        {
            actual: String.raw`\69\64\65\6e\74 \ ident`,
            expected: 'ident ident',
        },
        {
            actual: '\\69\\64\\65\\6e\\74\r\n\\ ident',
            expected: 'ident ident',
        },
        {
            actual: '\\75 rl(foo)',
            expected: 'url(foo)',
        },
        {
            actual: '\\75 \\72 \\6C(foo)',
            expected: 'url(foo)',
        },
        {
            actual: '\\75 \\72\\6C(foo)',
            expected: 'url(foo)',
        },
    ])("should decode '$actual' to '$expected'", ({ actual, expected }) => {
        expect(decodeIdent(actual)).toEqual(expected);
    });
});
