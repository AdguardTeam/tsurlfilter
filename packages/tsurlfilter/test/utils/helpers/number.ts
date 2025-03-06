/**
 * Generates a random number between 0 and the specified maximum value.
 *
 * @param max The maximum value for the random number.
 *
 * @returns A random number between 0 and the specified maximum value.
 */
export function getRandomNumber(max: number): number {
    // `| 0` is more compact and faster than `Math.floor()`.
    return (Math.random() * max) | 0;
}
