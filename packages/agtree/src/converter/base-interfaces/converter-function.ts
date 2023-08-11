/**
 * Signature for a conversion helper function
 *
 * @template T Type of the input and output
 * @param input Input to convert
 * @returns Converted input
 */
export type ConverterFunction<T> = (input: T) => T;
