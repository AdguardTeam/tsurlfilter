/**
 * @file Common utility types.
 */

/**
 * Readonly record type - makes all properties of a record readonly.
 *
 * @template K Key type (string, number, or symbol).
 * @template V Value type.
 *
 * @example
 * ```typescript
 * const config: ReadonlyRecord<string, number> = {
 *     timeout: 1000,
 *     retries: 3,
 * };
 * // config is readonly, cannot modify properties
 * ```
 */
export type ReadonlyRecord<K extends string | number | symbol, V> = {
    readonly [P in K]: V;
};
