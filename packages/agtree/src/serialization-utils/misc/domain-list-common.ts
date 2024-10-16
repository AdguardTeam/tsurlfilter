import { COMMA, PIPE } from '../../utils/constants';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the binary schema version
 *
 * @note Only 256 values can be represented this way.
 */
export const enum DomainListSerializationMap {
    Separator = 1,
    Children,
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
    [COMMA, 0],
    [PIPE, 1],
]);
