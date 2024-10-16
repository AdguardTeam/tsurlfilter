import { BINARY_SCHEMA_VERSION } from '../../utils/binary-schema-version';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
export const enum MetadataCommentRuleSerializationMap {
    Marker = 1,
    Header,
    Value,
    Start,
    End,
}

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
export const FREQUENT_HEADERS_DESERIALIZATION_MAP = new Map<number, string>([
    [1, 'Checksum'],
    [2, 'Description'],
    [3, 'Expires'],
    [4, 'Homepage'],
    [5, 'Last Modified'],
    [6, 'LastModified'],
    [7, 'Licence'],
    [8, 'License'],
    [9, 'Time Updated'],
    [10, 'TimeUpdated'],
    [11, 'Version'],
    [12, 'Title'],
]);
