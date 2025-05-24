import { BINARY_SCHEMA_VERSION } from '../../utils/binary-schema-version.js';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
export const ConfigCommentRuleMarshallingMap = {
    Marker: 1,
    Command: 2,
    Params: 3,
    Comment: 4,
    Start: 5,
    End: 6,
} as const;

// intentionally naming the variable the same as the type
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type ConfigCommentRuleMarshallingMap = typeof ConfigCommentRuleMarshallingMap[
    keyof typeof ConfigCommentRuleMarshallingMap
];

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
export const ConfigNodeMarshallingMap = {
    Value: 1,
    Start: 2,
    End: 3,
} as const;

// intentionally naming the variable the same as the type
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type ConfigNodeMarshallingMap = typeof ConfigNodeMarshallingMap[keyof typeof ConfigNodeMarshallingMap];

/**
 * Value map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 *
 * @see {@link https://github.com/AdguardTeam/AGLint/blob/master/src/linter/inline-config.ts}
 */
export const FREQUENT_COMMANDS_SERIALIZATION_MAP = new Map<string, number>([
    ['aglint', 0],
    ['aglint-disable', 1],
    ['aglint-enable', 2],
    ['aglint-disable-next-line', 3],
    ['aglint-enable-next-line', 4],
]);
