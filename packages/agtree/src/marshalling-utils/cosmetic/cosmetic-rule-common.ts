import { BINARY_SCHEMA_VERSION } from '../../utils/binary-schema-version.js';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
export const CosmeticRuleMarshallingMap = {
    Syntax: 1,
    Exception: 2,
    Separator: 3,
    Modifiers: 4,
    Domains: 5,
    Body: 6,
    Start: 7,
    End: 8,
} as const;

// intentionally naming the variable the same as the type
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type CosmeticRuleMarshallingMap = typeof CosmeticRuleMarshallingMap[keyof typeof CosmeticRuleMarshallingMap];

/**
 * Value map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
export const COSMETIC_RULE_SEPARATOR_SERIALIZATION_MAP = new Map<string, number>([
    ['##', 0],
    ['#@#', 1],

    ['#?#', 2],
    ['#@?#', 3],

    ['#$#', 4],
    ['#$?#', 5],
    ['#@$#', 6],
    ['#@$?#', 7],

    ['#%#', 8],
    ['#@%#', 9],

    ['$$', 10],
    ['$@$', 11],
]);
