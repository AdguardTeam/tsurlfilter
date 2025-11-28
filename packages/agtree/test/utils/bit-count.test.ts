import { describe, expect, test } from 'vitest';

import { getBitCount } from '../../src/utils/bit-count';

describe('getBitCount', () => {
    test('should return 0 for 0', () => {
        expect(getBitCount(0)).toBe(0);
    });

    test('should return 1 for powers of 2', () => {
        expect(getBitCount(1)).toBe(1);
        expect(getBitCount(2)).toBe(1);
        expect(getBitCount(4)).toBe(1);
        expect(getBitCount(8)).toBe(1);
        expect(getBitCount(16)).toBe(1);
        expect(getBitCount(32)).toBe(1);
        expect(getBitCount(64)).toBe(1);
        expect(getBitCount(128)).toBe(1);
        expect(getBitCount(256)).toBe(1);
        expect(getBitCount(512)).toBe(1);
        expect(getBitCount(1024)).toBe(1);
    });

    test('should return correct bit count for binary numbers with multiple bits set', () => {
        expect(getBitCount(3)).toBe(2); // 0b11
        expect(getBitCount(7)).toBe(3); // 0b111
        expect(getBitCount(15)).toBe(4); // 0b1111
        expect(getBitCount(0b10101010)).toBe(4);
        expect(getBitCount(0b11110000)).toBe(4);
        expect(getBitCount(0b11111111)).toBe(8);
    });

    test('should handle 32-bit max unsigned integer correctly', () => {
        expect(getBitCount(0xFFFFFFFF)).toBe(32);
    });

    test('should return correct bit count for alternating bits', () => {
        expect(getBitCount(0xAAAAAAAA)).toBe(16);
        expect(getBitCount(0x55555555)).toBe(16);
    });

    test('should return correct bit count for edge high bit', () => {
        expect(getBitCount(0x80000000)).toBe(1); // only the MSB set
    });

    test('should work with negative numbers via 32-bit wrapping', () => {
        // eslint-disable-next-line no-bitwise
        expect(getBitCount(-1 >>> 0)).toBe(32); // -1 as unsigned
        // eslint-disable-next-line no-bitwise
        expect(getBitCount(-2147483648 >>> 0)).toBe(1); // MSB only
    });

    test('should handle various bit patterns correctly', () => {
        expect(getBitCount(0b1)).toBe(1);
        expect(getBitCount(0b11)).toBe(2);
        expect(getBitCount(0b101)).toBe(2);
        expect(getBitCount(0b1111)).toBe(4);
        expect(getBitCount(0b10101)).toBe(3);
        expect(getBitCount(0b11011)).toBe(4);
        expect(getBitCount(0b111111)).toBe(6);
    });

    test('should handle large numbers with scattered bits', () => {
        expect(getBitCount(0x12345678)).toBe(13);
        expect(getBitCount(0xABCDEF01)).toBe(18); // 0b10101011110011011110111100000001 = 18 bits
        expect(getBitCount(0xF0F0F0F0)).toBe(16);
        expect(getBitCount(0x0F0F0F0F)).toBe(16);
    });

    test('should be consistent with multiple calls', () => {
        const testValue = 0b11010110;
        const expectedCount = 5;
        expect(getBitCount(testValue)).toBe(expectedCount);
        expect(getBitCount(testValue)).toBe(expectedCount);
        expect(getBitCount(testValue)).toBe(expectedCount);
    });
});
