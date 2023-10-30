import { getStringHash } from '../../src/utils/djb2';

describe('djb2', () => {
    describe('getStringHash', () => {
        test('should be case-insensitive', () => {
            expect(getStringHash('a')).toBe(getStringHash('A'));
            expect(getStringHash('url')).toBe(getStringHash('URL'));
            expect(getStringHash('CamelCase')).toBe(getStringHash('camelcase'));
        });

        test('should work with large strings without overflowing', () => {
            const baseLargeString = 'a'.repeat(10000);

            const largeStrings: string[] = [
                baseLargeString,
                `${baseLargeString}a`, // +1 'a' (different length)
                `b${baseLargeString}`, // +1 leading 'b'
                `${baseLargeString}b`, // +1 trailing 'b'
                `b${baseLargeString}b`, // +1 leading and +1 trailing 'b'
                // eslint-disable-next-line max-len
                `${baseLargeString.slice(0, baseLargeString.length / 2)}b${baseLargeString.slice(baseLargeString.length / 2)}`, // +1 'b' in the middle
            ];

            // all strings should have different hashes
            const hashes = largeStrings.map(getStringHash);

            expect(hashes).toEqual(Array.from(new Set(hashes)));
        });
    });
});
