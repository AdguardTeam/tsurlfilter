import { getRandomNumber } from './number';
import { getRandomString } from './string';

/**
 * Gets a random element from the specified array.
 *
 * @template T - The type of elements in the array.
 * @param array - The array from which to get a random element.
 * @returns A random element from the array.
 */
export function getRandomElement<T>(array: T[]): T {
    return array[getRandomNumber(array.length)];
}

/**
 * Gets the average value for the specified array of numbers.
 *
 * @param array - The array of numbers for which to calculate the average value.
 * @returns The average value of the numbers in the array.
 */
export function getAverageValue(array: number[]): number {
    return Number((array.reduce((a, b) => a + b, 0) / array.length).toFixed(6));
}

/**
 * Creates an array of random strings.
 *
 * @param size - The size of the array to create.
 * @returns An array of random strings.
 */
export function createRandomStringArray(size: number): string[] {
    const array: string[] = [];
    let i = size;
    while (i--) {
        array.push(getRandomString());
    }
    return array;
}
