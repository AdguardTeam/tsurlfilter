import punycode from 'punycode/punycode.js';
import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import * as errorUtilsModule from '../../../src/utils/error';
import {
    fastHash,
    fastHash31,
    hasSpaces,
    isASCII,
    isRegexPattern,
    prepareASCII,
    removeSlashes,
    toASCII,
} from '../../../src/utils/string';

vi.mock('punycode/punycode.js', () => ({
    default: {
        toASCII: (str: string) => `ascii(${str})`,
        encode: (str: string) => `encoded(${str})`,
    },
}));

vi.mock('../../../src/utils/error', () => ({
    getErrorMessage: (error: Error) => error.message,
}));

describe('String utils', () => {
    describe('fastHash', () => {
        it('returns 0 for empty string', () => {
            expect(fastHash('')).toBe(0);
        });

        it('returns consistent hash for same input', () => {
            const input = 'test string';
            expect(fastHash(input)).toBe(fastHash(input));
        });

        it('returns different hashes for different inputs', () => {
            expect(fastHash('string1')).not.toBe(fastHash('string2'));
        });

        it('returns positive 32-bit unsigned integer', () => {
            const hash = fastHash('a'.repeat(1000));
            expect(hash).toBeGreaterThan(0);
            expect(hash).toBeLessThanOrEqual(0xffffffff); // 2^32 - 1
            expect(Number.isInteger(hash)).toBe(true);
        });

        it('handles unicode characters', () => {
            expect(fastHash('café')).toBeGreaterThan(0);
            expect(fastHash('测试')).toBeGreaterThan(0);
            expect(fastHash('🚀')).toBeGreaterThan(0);
        });
    });

    describe('fastHash31', () => {
        it('returns 0 for empty string', () => {
            expect(fastHash31('')).toBe(0);
        });

        it('returns consistent hash for same input', () => {
            const input = 'test string';
            expect(fastHash31(input)).toBe(fastHash31(input));
        });

        it('returns different hashes for different inputs', () => {
            expect(fastHash31('string1')).not.toBe(fastHash31('string2'));
        });

        it('returns positive 31-bit unsigned integer', () => {
            const hash = fastHash31('a'.repeat(1000));
            expect(hash).toBeGreaterThan(0);
            expect(hash).toBeLessThanOrEqual(0x7fffffff); // 2^31 - 1
            expect(Number.isInteger(hash)).toBe(true);
        });

        it('always returns smaller or equal value compared to fastHash', () => {
            const inputs = ['test', 'hello world', 'unicode 测试', '🚀 rocket'];
            inputs.forEach((input) => {
                const hash = fastHash(input);
                const hash31 = fastHash31(input);
                expect(hash31).toBeLessThanOrEqual(hash);
            });
        });

        it('masks off sign bit correctly', () => {
            // Test with various inputs to ensure the sign bit is always masked
            const inputs = ['a', 'test', 'longer string', 'unicode 🎉'];
            inputs.forEach((input) => {
                const hash31 = fastHash31(input);
                // Ensure the result is always positive (sign bit is 0)
                expect(hash31 & 0x80000000).toBe(0);
            });
        });

        it('handles unicode characters', () => {
            expect(fastHash31('café')).toBeGreaterThan(0);
            expect(fastHash31('测试')).toBeGreaterThan(0);
            expect(fastHash31('🚀')).toBeGreaterThan(0);
        });

        it('relationship with fastHash - should be fastHash & 0x7fffffff', () => {
            const inputs = ['test', 'hello', 'world', '测试', '🎯'];
            inputs.forEach((input) => {
                const hash = fastHash(input);
                const hash31 = fastHash31(input);
                expect(hash31).toBe(hash & 0x7fffffff);
            });
        });
    });

    describe('isASCII', () => {
        it('returns true for ASCII string', () => {
            expect(isASCII('Hello, World!')).toBe(true);
        });

        it('returns false for non-ASCII string', () => {
            expect(isASCII('你好世界!')).toBe(false);
            expect(isASCII('Привет, Мир!')).toBe(false);
        });

        it('returns false for empty string', () => {
            expect(isASCII('')).toBe(false);
        });
    });

    describe('prepareASCII', () => {
        const toASCIISpy = vi.spyOn(punycode, 'toASCII');
        const encodeSpy = vi.spyOn(punycode, 'encode');
        const getErrorMessageSpy = vi.spyOn(errorUtilsModule, 'getErrorMessage');

        it('returns the same ASCII string', () => {
            const input = 'Hello, World!';
            const result = prepareASCII(input);
            expect(result).toBe(input);
            expect(toASCIISpy).not.toHaveBeenCalled();
            expect(encodeSpy).not.toHaveBeenCalled();
        });

        it('converts non-ASCII string using toASCII', () => {
            const input = 'Привет, мир!';
            const result = prepareASCII(input);
            expect(result).toBe(`encoded(ascii(${input}))`);
            expect(toASCIISpy).toHaveBeenCalledTimes(1);
            expect(toASCIISpy).toHaveBeenCalledWith(input);
            expect(encodeSpy).toHaveBeenCalledTimes(1);
            expect(encodeSpy).toHaveBeenCalledWith(`ascii(${input})`);
        });

        it('throws an error if toASCII fails', () => {
            const error = new Error('Invalid domain');
            const input = 'invalid_domain_😀';
            toASCIISpy.mockImplementationOnce(() => {
                throw error;
            });

            expect(() => prepareASCII(input)).toThrowError(
                `Error converting to ASCII: "${input}" due to ${error.message}`,
            );
            expect(getErrorMessageSpy).toHaveBeenCalledTimes(1);
            expect(getErrorMessageSpy).toHaveBeenCalledWith(error);
        });
    });

    describe('toASCII', () => {
        it('converts a list of strings to ASCII', () => {
            expect(toASCII(['Hello', 'Привет', '你好'])).toEqual([
                'Hello',
                'encoded(ascii(Привет))',
                'encoded(ascii(你好))',
            ]);
        });
    });

    describe('removeSlashes', () => {
        it('removes slashes from both ends', () => {
            expect(removeSlashes('/example/')).toBe('example');
        });

        it('does not remove slashes if only leading slash is present', () => {
            const input = '/example';
            expect(removeSlashes(input)).toBe(input);
        });

        it('does not remove slashes if only trailing slash is present', () => {
            const input = 'example/';
            expect(removeSlashes(input)).toBe(input);
        });

        it('does not remove slashes if there are no slashes', () => {
            const input = 'example';
            expect(removeSlashes(input)).toBe(input);
        });

        it('does not remove slashes if string is single slash', () => {
            const input = '/';
            expect(removeSlashes(input)).toBe(input);
        });
    });

    describe('isRegexPattern', () => {
        it('returns true for leading and trailing slashes', () => {
            expect(isRegexPattern('/pattern/')).toBe(true);
        });

        it('returns true for single slash', () => {
            expect(isRegexPattern('/')).toBe(true);
        });

        it('returns false for missing leading slash', () => {
            expect(isRegexPattern('pattern/')).toBe(false);
        });

        it('returns false for missing trailing slash', () => {
            expect(isRegexPattern('/pattern')).toBe(false);
        });

        it('returns false for no slashes', () => {
            expect(isRegexPattern('pattern')).toBe(false);
        });
    });

    describe('hasSpaces', () => {
        it('returns true if string contains spaces', () => {
            expect(hasSpaces('hello world')).toBe(true);
        });

        it('returns false if string does not contain spaces', () => {
            expect(hasSpaces('helloworld')).toBe(false);
        });

        it('returns false for empty string', () => {
            expect(hasSpaces('')).toBe(false);
        });
    });
});
