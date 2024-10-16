/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
export const enum ConfigCommentRuleSerializationMap {
    Marker = 1,
    Command,
    Params,
    Comment,
    Start,
    End,
}

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
export const enum ConfigNodeSerializationMap {
    Value = 1,
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
