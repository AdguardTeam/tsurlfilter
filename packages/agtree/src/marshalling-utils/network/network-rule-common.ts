import { BINARY_SCHEMA_VERSION } from '../../utils/binary-schema-version.js';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
export const NetworkRuleMarshallingMap = {
    Syntax: 1,
    Raws: 2,
    Exception: 3,
    Pattern: 4,
    ModifierList: 5,
    Start: 6,
    End: 7,
} as const;

// intentionally naming the variable the same as the type
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type NetworkRuleMarshallingMap = typeof NetworkRuleMarshallingMap[keyof typeof NetworkRuleMarshallingMap];
