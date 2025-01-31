import {
    splitByDelimiterWithEscapeCharacter,
    startsAtIndexWith,
    hasUnquotedSubstring,
    fastHash,
    replaceAll,
    getUtf8EncodedLength,
} from '../../src/utils/string-utils';

describe('splitByDelimiterWithEscapeCharacter', () => {
    it('works if splits plain strings with and w/o preserving all tokens', () => {
        let result = splitByDelimiterWithEscapeCharacter('example.org,,,example.com', ',', '\\', false);
        let expected = ['example.org', 'example.com'];
        expect(result).toEqual(expected);

        // Empty tokens must be preserved correctly
        result = splitByDelimiterWithEscapeCharacter('example.org,,,example.com', ',', '\\', true);
        expected = ['example.org', '', '', 'example.com'];
        expect(result).toEqual(expected);

        // Delimiters must be escaped correctly, with escape character removed
        result = splitByDelimiterWithEscapeCharacter('example.org\\,\\,\\,example.com', ',', '\\', true);
        expected = ['example.org,,,example.com'];
        expect(result).toEqual(expected);

        // Empty string must return empty array
        result = splitByDelimiterWithEscapeCharacter('', ',', '\\', true);
        expected = [];
        expect(result).toEqual(expected);

        // Check if index 0 delimiter is trimmed correctly
        result = splitByDelimiterWithEscapeCharacter(',example.org,example.com', ',', '\\', false);
        expected = ['example.org', 'example.com'];
        expect(result).toEqual(expected);

        // Forward slash splitting
        result = splitByDelimiterWithEscapeCharacter('/text-to-be-replaced/new-text/i', '/', '\\', true);
        expected = ['text-to-be-replaced', 'new-text', 'i'];
        expect(result).toEqual(expected);

        // Keep empty token after ending delimiter
        result = splitByDelimiterWithEscapeCharacter(
            '/(<VAST[\\s\\S]*?>)[\\s\\S]*<\\/VAST>/$1<\\/VAST>/',
            '/',
            '\\',
            true,
        );
        expected = ['(<VAST[\\s\\S]*?>)[\\s\\S]*</VAST>', '$1</VAST>', ''];
        expect(result).toEqual(expected);

        // Remove empty token after ending delimiter
        result = splitByDelimiterWithEscapeCharacter(
            '/(<VAST[\\s\\S]*?>)[\\s\\S]*<\\/VAST>/$1<\\/VAST>/',
            '/',
            '\\',
            false,
        );
        expected = ['(<VAST[\\s\\S]*?>)[\\s\\S]*</VAST>', '$1</VAST>'];
        expect(result).toEqual(expected);

        // Keep empty token after delimiter for comma
        result = splitByDelimiterWithEscapeCharacter('example.org,,,example.com,', ',', '\\', true);
        expected = ['example.org', '', '', 'example.com', ''];
        expect(result).toEqual(expected);

        // Escape character should be kept if specified
        result = splitByDelimiterWithEscapeCharacter('qwe\\,rty,1,2,3', ',', '\\', false, false);
        expected = ['qwe\\,rty', '1', '2', '3'];
        expect(result).toEqual(expected);
    });

    it('measures splitByDelimiterWithEscapeCharacter', async () => {
        const startParse = Date.now();

        let count = 0;
        while (count < 2000) {
            count += 1;

            let parts = splitByDelimiterWithEscapeCharacter('example.org,,,example.com', ',', '\\', false);
            expect(parts.length).toEqual(2);

            parts = splitByDelimiterWithEscapeCharacter('example.org,,,example.com', ',', '\\', true);
            expect(parts.length).toEqual(4);
        }

        // eslint-disable-next-line no-console
        console.log(`Elapsed time: ${Date.now() - startParse}`);
    });
});

describe('startsAtIndexWith', () => {
    it('works if it can check simple strings', () => {
        expect(startsAtIndexWith('example', 0, 'ex')).toEqual(true);
        expect(startsAtIndexWith('example', 1, 'xa')).toEqual(true);
        expect(startsAtIndexWith('example', 6, 'e')).toEqual(true);
    });
});

describe('hasUnquotedSubstring', () => {
    it('works if it can check simple strings', () => {
        expect(hasUnquotedSubstring('example', 'ex')).toEqual(true);
        expect(hasUnquotedSubstring('"example"', 'ex')).toEqual(false);
        expect(hasUnquotedSubstring('\\"example\\"', 'ex')).toEqual(true);
    });
});

describe('replaceAll', () => {
    it('works if it can replace simple strings', () => {
        expect(replaceAll('example_example', 'ex', 'EX')).toEqual('EXample_EXample');
    });
});

describe('fastHash', () => {
    it('works if it can fastHash', () => {
        expect(fastHash('')).toEqual(0);
    });

    it('creates unique hashes', () => {
        const hashOne = fastHash('example.com');
        const hashTwo = fastHash('example.net');

        expect(hashOne).not.toBe(hashTwo);
    });

    it('prevent overflow for too long strings', () => {
        const hashOne = fastHash('verylongstringverylongstringverylongstring');
        const hashTwo = fastHash('anotherverylongstringverylongstringverylongstring');

        expect(hashOne).toBeLessThan(2 ** 32);
        expect(hashTwo).toBeLessThan(2 ** 32);

        expect(hashOne).toBeLessThan(Number.MAX_SAFE_INTEGER);
        expect(hashTwo).toBeLessThan(Number.MAX_SAFE_INTEGER);

        expect(hashOne).not.toBe(hashTwo);
    });
});

describe('getUtf8EncodedLength', () => {
    it('should return 0 for an empty string', () => {
        expect(getUtf8EncodedLength('')).toBe(0);
    });

    it('should return 1 for a single ASCII character', () => {
        // ASCII character
        expect(getUtf8EncodedLength('A')).toBe(1);
    });

    it('should return the correct byte length for a string with multiple ASCII characters', () => {
        // "Hello" consists of 5 ASCII characters
        expect(getUtf8EncodedLength('Hello')).toBe(5);
    });

    it('should return 2 for a 2-byte UTF-8 character (e.g., é)', () => {
        // 'é' is a 2-byte character in UTF-8
        expect(getUtf8EncodedLength('é')).toBe(2);
    });

    it('should return 3 for a 3-byte UTF-8 character (e.g., 中)', () => {
        // '中' is a 3-byte character in UTF-8
        expect(getUtf8EncodedLength('中')).toBe(3);
    });

    it('should return 4 for a 4-byte UTF-8 character (e.g., smiley emoji)', () => {
        // '😄' is a 4-byte character in UTF-8 (surrogate pair)
        expect(getUtf8EncodedLength('😄')).toBe(4);
    });

    it('should handle mixed strings with ASCII and multi-byte UTF-8 characters', () => {
        // "Hello " = 6 bytes, 'é' = 2 bytes
        expect(getUtf8EncodedLength('Hello é')).toBe(8);
    });

    it('should handle surrogate pairs correctly', () => {
        const complexEmoji = '👨‍👩‍👧‍👦'; // Family emoji
        expect(getUtf8EncodedLength(complexEmoji)).toBe(25); // Surrogate pairs and ZWJ
    });

    it('should return correct byte length for characters in different byte ranges', () => {
        // 'A' = 1 byte, 'é' = 2 bytes, '中' = 3 bytes, '😄' = 4 bytes
        expect(getUtf8EncodedLength('Aé中😄')).toBe(10);
    });

    it('should correctly handle special characters like newline, tabs, etc.', () => {
        // Newline is a single byte in UTF-8
        expect(getUtf8EncodedLength('\n')).toBe(1);
        // Tab is a single byte in UTF-8
        expect(getUtf8EncodedLength('\t')).toBe(1);
    });
});
