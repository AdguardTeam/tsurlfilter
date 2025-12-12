/* eslint-disable no-param-reassign, no-bitwise */
/**
 * @file Utility for counting set bits in numbers.
 */

/**
 * Counts the number of set bits (1s) in a 32-bit number using Hamming Weight (SWAR) method.
 *
 * This is a fast bit counting algorithm that uses SWAR (SIMD Within A Register) technique.
 * It's significantly faster than string conversion methods and works in O(1) time.
 *
 * @param a Number to count bits in.
 *
 * @returns The number of bits set to 1.
 *
 * @example
 * ```typescript
 * getBitCount(0); // 0
 * getBitCount(7); // 3 (0b111)
 * getBitCount(0xFF); // 8 (0b11111111)
 * ```
 */
export function getBitCount(a: number): number {
    a -= ((a >>> 1) & 0x55555555);
    a = (a & 0x33333333) + ((a >>> 2) & 0x33333333);
    a = (a + (a >>> 4)) & 0x0F0F0F0F;
    a += (a >>> 8);
    a += (a >>> 16);
    return a & 0x3F;
}
