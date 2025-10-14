import {
    type GenericSchema,
    type InferOutput,
    type ObjectEntries,
    strictObject,
} from 'valibot';

/**
 * Creates a strict object schema by validating the entries against the expected type.
 *
 * @template TExpected The expected type for the object schema.
 * @template TEntries The entries of the object schema.
 *
 * @see {@link strictObject}
 *
 * @param entries The entries schema.
 *
 * @returns A strict object schema.
 *
 * @example
 * ```ts
 * // Valid case
 * interface ValidExample {
 *     foo: string;
 * }
 *
 * const ValidExampleValidator = strictObjectByType<ValidExample>({
 *     foo: v.string(),
 * });
 *
 * // Invalid case
 * interface InvalidExample {
 *     foo: string;
 *     bar: number;
 * }
 *
 * const InvalidExampleValidator = strictObjectByType<InvalidExample>({
 *     foo: v.string(),
 *     baz: v.boolean(), // Error: Does not match the expected type
 *     // Error: Property 'bar' is missing
 * });
 * ```
 */
export function strictObjectByType<
    const TExpected extends object,
    const TEntries extends ObjectEntries = ObjectEntries,
>(
    entries: keyof TEntries & keyof TExpected extends never
        ? never
        : {
            [K in keyof TExpected & keyof TEntries]: InferOutput<TEntries[K]> extends TExpected[K]
                ? TEntries[K]
                : GenericSchema<TExpected[K]>;
        },
) {
    return strictObject(entries);
}
