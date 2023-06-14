/**
 * Counts the number of bits in the number and returns it
 *
 * @param a number to count bits
 *
 * @returns The number of bits in the number.
 */
export function getBitCount(a: number): number {
    let count = 0;
    let n = a;

    while (n > 0) {
        count += n & 1;
        n >>= 1;
    }
    return count;
}

/**
 * Count the number of bits enabled in a number based on a bit mask
 *
 * @param base Base number to check
 * @param mask Mask to check
 *
 * @returns The number of bits enabled in the base number based on the mask
 *
 * @example
 * countEnabledBits(0b100, 0b110); // 1
 * countEnabledBits(0b111, 0b000); // 0
 */
export function countEnabledBits(base: number, mask: number) {
    // Get the common bits between the base and the mask
    const common = base & mask;

    // Count the number of bits enabled in the common bits
    return getBitCount(common);
}
