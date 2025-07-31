import { describe, expect, it } from 'vitest';

import {
    fastHash,
    fastHash31,
    findNextNonWhitespace,
    findNextWhitespace,
    findPrevNonWhitespace,
    hasUnquotedSubstring,
    hasWhitespace,
    replaceAll,
    splitByDelimiterWithEscapeCharacter,
    startsAtIndexWith,
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

describe('fastHash31', () => {
    it('returns 0 for empty string', () => {
        expect(fastHash31('')).toBe(0);
    });

    it('returns consistent hash for same input', () => {
        const hash1 = fastHash31('example.com');
        const hash2 = fastHash31('example.com');
        expect(hash1).toBe(hash2);
    });

    it('returns different hashes for different strings', () => {
        const hash1 = fastHash31('example.com');
        const hash2 = fastHash31('example.net');
        expect(hash1).not.toBe(hash2);
    });

    it('hash is always in [1, 2^31-1] for valuable strings', () => {
        const samples = [
            'a',
            'test',
            'example.com',
            'anotherstring',
            'verylongstringverylongstringverylongstring',
        ];
        for (const s of samples) {
            const hash = fastHash31(s);
            expect(hash).toBeGreaterThanOrEqual(1);
            expect(hash).toBeLessThanOrEqual(0x7fffffff);
        }
    });
});

describe('hasWhitespace', () => {
    it('returns true when string has space', () => {
        expect(hasWhitespace('abc def', 0, 7)).toBe(true);
    });

    it('returns true when string has tab', () => {
        expect(hasWhitespace('abc\tdef', 0, 7)).toBe(true);
    });

    it('returns false when no whitespace is present', () => {
        expect(hasWhitespace('abcdef', 0, 6)).toBe(false);
    });

    it('respects start and end boundaries', () => {
        expect(hasWhitespace('ab c de', 0, 2)).toBe(false); // only "ab"
        expect(hasWhitespace('ab c de', 2, 4)).toBe(true); // includes space
    });
});

describe('findNextNonWhitespace', () => {
    it('finds first non-whitespace character', () => {
        expect(findNextNonWhitespace('    abc', 0, 7)).toBe(4);
        expect(findNextNonWhitespace('\t\tfoo', 0, 5)).toBe(2);
    });

    it('returns start if already non-whitespace', () => {
        expect(findNextNonWhitespace('abc', 0, 3)).toBe(0);
    });

    it('returns length if only whitespace remains', () => {
        expect(findNextNonWhitespace('   ', 0, 3)).toBe(3);
    });
});

describe('findPrevNonWhitespace', () => {
    it('finds index before trailing whitespace', () => {
        expect(findPrevNonWhitespace('abc   ', 6)).toBe(3);
    });

    it('returns same index if already clean', () => {
        expect(findPrevNonWhitespace('abc', 3)).toBe(3);
    });

    it('returns 0 if all characters before are whitespace', () => {
        expect(findPrevNonWhitespace('   ', 3)).toBe(0);
    });
});

describe('findNextWhitespace', () => {
    it('finds index of next space', () => {
        expect(findNextWhitespace('abc def', 0)).toBe(3);
    });

    it('finds index of next tab if no space', () => {
        expect(findNextWhitespace('abc\tdef', 0)).toBe(3);
    });

    it('returns string length if no whitespace found', () => {
        expect(findNextWhitespace('abcdef', 0)).toBe(6);
    });

    it('starts search from the given index', () => {
        expect(findNextWhitespace('abc def ghi', 4)).toBe(7);
    });
});
