/* eslint-disable no-param-reassign */
/**
 * Counts the number of set bits (1s) in a 32-bit number using Hamming Weight (SWAR) method.
 *
 * @param a Number to count bits in.
 *
 * @returns The number of bits set to 1.
 */
export function getBitCount(a: number): number {
    a -= ((a >>> 1) & 0x55555555);
    a = (a & 0x33333333) + ((a >>> 2) & 0x33333333);
    a = (a + (a >>> 4)) & 0x0F0F0F0F;
    a += (a >>> 8);
    a += (a >>> 16);
    return a & 0x3F;
}

/**
 * Count the number of bits enabled in a number based on a bit mask.
 *
 * @param base Base number to check.
 * @param mask Mask to apply.
 *
 * @returns Number of bits set in `base & mask`.
 */
export function countEnabledBits(base: number, mask: number): number {
    return getBitCount(base & mask);
}
