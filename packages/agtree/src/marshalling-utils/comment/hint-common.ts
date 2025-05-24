import { BINARY_SCHEMA_VERSION } from '../../utils/binary-schema-version.js';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
export const HintNodeMarshallingMap = {
    Name: 1,
    Params: 2,
    Start: 3,
    End: 4,
} as const;

// intentionally naming the variable the same as the type
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type HintNodeMarshallingMap = typeof HintNodeMarshallingMap[keyof typeof HintNodeMarshallingMap];

/**
 * Value map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
export const FREQUENT_HINTS_SERIALIZATION_MAP = new Map<string, number>([
    ['NOT_OPTIMIZED', 0],
    ['PLATFORM', 1],
    ['NOT_PLATFORM', 2],
]);

/**
 * Value map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
export const FREQUENT_PLATFORMS_SERIALIZATION_MAP = new Map<string, number>([
    ['windows', 0],
    ['mac', 1],
    ['android', 2],
    ['ios', 3],
    ['ext_chromium', 4],
    ['ext_ff', 5],
    ['ext_edge', 6],
    ['ext_opera', 7],
    ['ext_safari', 8],
    ['ext_android_cb', 9],
    ['ext_ublock', 10],
]);
