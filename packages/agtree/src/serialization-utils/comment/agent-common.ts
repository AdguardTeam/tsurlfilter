/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
export const enum AgentNodeSerializationMap {
    Adblock = 1,
    Version,
    Start,
    End,
}

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

/**
 * Value map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
// FIXME
export const FREQUENT_AGENTS_SERIALIZATION_MAP = new Map<string, number>(
    Array.from(FREQUENT_AGENTS_DESERIALIZATION_MAP).map(([key, value]) => [value.toLowerCase(), key]),
);
