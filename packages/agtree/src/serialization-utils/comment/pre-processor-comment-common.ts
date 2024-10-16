/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
export const enum PreProcessorRuleSerializationMap {
    Name = 1,
    Params,
    Syntax,
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
 * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#preprocessor-directives}
 * @see {@link https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#pre-parsing-directives}
 */
export const FREQUENT_DIRECTIVES_SERIALIZATION_MAP = new Map<string, number>([
    ['if', 0],
    ['else', 1],
    ['endif', 2],
    ['include', 3],
    ['safari_cb_affinity', 4],
]);

/**
 * Value map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
export const FREQUENT_PARAMS_SERIALIZATION_MAP = new Map<string, number>([
    // safari_cb_affinity parameters
    ['general', 0],
    ['privacy', 1],
    ['social', 2],
    ['security', 3],
    ['other', 4],
    ['custom', 5],
    ['all', 6],
]);
