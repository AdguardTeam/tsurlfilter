import { BINARY_SCHEMA_VERSION } from '../../utils/binary-schema-version.js';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
export const AgentNodeMarshallingMap = {
    Adblock: 1,
    Version: 2,
    Start: 3,
    End: 4,
} as const;

// intentionally naming the variable the same as the type
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type AgentNodeMarshallingMap = typeof AgentNodeMarshallingMap[keyof typeof AgentNodeMarshallingMap];

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
export const FREQUENT_AGENTS_DESERIALIZATION_MAP = new Map<number, string>([
    // AdGuard
    [0, 'AdGuard'],
    [1, 'ADG'],

    // uBlock Origin
    [2, 'uBlock Origin'],
    [3, 'uBlock'],
    [4, 'uBO'],

    // Adblock Plus
    [5, 'Adblock Plus'],
    [6, 'AdblockPlus'],
    [7, 'ABP'],
    [8, 'AdBlock'],
]);
