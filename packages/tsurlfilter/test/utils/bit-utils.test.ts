import { describe, it, expect } from 'vitest';
import { getBitCount, countEnabledBits } from '../../src/utils/bit-utils';

describe('getBitCount', () => {
    it('should return 0 for 0', () => {
        expect(getBitCount(0)).toBe(0);
    });

    it('should return 1 for powers of 2', () => {
        expect(getBitCount(1)).toBe(1);
        expect(getBitCount(2)).toBe(1);
        expect(getBitCount(4)).toBe(1);
        expect(getBitCount(8)).toBe(1);
    });

    it('should return correct bit count for binary numbers with multiple bits set', () => {
        expect(getBitCount(3)).toBe(2); // 0b11
        expect(getBitCount(7)).toBe(3); // 0b111
        expect(getBitCount(15)).toBe(4); // 0b1111
        expect(getBitCount(0b10101010)).toBe(4);
        expect(getBitCount(0b11110000)).toBe(4);
        expect(getBitCount(0b11111111)).toBe(8);
    });

    it('should handle 32-bit max unsigned integer correctly', () => {
        expect(getBitCount(0xFFFFFFFF)).toBe(32);
    });

    it('should return correct bit count for alternating bits', () => {
        expect(getBitCount(0xAAAAAAAA)).toBe(16);
        expect(getBitCount(0x55555555)).toBe(16);
    });

    it('should return correct bit count for edge high bit', () => {
        expect(getBitCount(0x80000000)).toBe(1); // only the MSB set
    });

    it('should work with negative numbers via 32-bit wrapping', () => {
        expect(getBitCount(-1 >>> 0)).toBe(32); // -1 as unsigned
        expect(getBitCount(-2147483648 >>> 0)).toBe(1); // MSB only
    });
});

describe('countEnabledBits', () => {
    it('should return 0 when mask is 0', () => {
        expect(countEnabledBits(0b1111, 0b0000)).toBe(0);
    });

    it('should return number of matching bits between base and mask', () => {
        expect(countEnabledBits(0b1111, 0b1010)).toBe(2);
        expect(countEnabledBits(0b1010, 0b0101)).toBe(0);
        expect(countEnabledBits(0b1111, 0b1111)).toBe(4);
    });

    it('should return 0 when base is 0', () => {
        expect(countEnabledBits(0, 0xFFFFFFFF)).toBe(0);
    });

    it('should return correct count with partial overlap', () => {
        expect(countEnabledBits(0b1001, 0b1100)).toBe(1); // only one common bit
    });

    it('should work with max 32-bit values', () => {
        expect(countEnabledBits(0xFFFFFFFF, 0xAAAAAAAA)).toBe(16);
        expect(countEnabledBits(0xFFFFFFFF, 0x55555555)).toBe(16);
    });

    it('should handle negative numbers as unsigned', () => {
        const base = -1 >>> 0; // 0xFFFFFFFF
        const mask = 0x0F0F0F0F;
        expect(countEnabledBits(base, mask)).toBe(getBitCount(mask));
    });
});
