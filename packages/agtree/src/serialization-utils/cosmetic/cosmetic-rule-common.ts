import { BINARY_SCHEMA_VERSION } from '../../utils/binary-schema-version';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
export const enum CosmeticRuleSerializationMap {
    Syntax = 1,
    Exception,
    Separator,
    Modifiers,
    Domains,
    Body,
    Start,
    End,
}

/**
 * Value map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
export const SEPARATOR_SERIALIZATION_MAP = new Map<string, number>([
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
