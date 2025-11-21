import { BINARY_SCHEMA_VERSION } from '../../../utils/binary-schema-version';

/**
 * Value map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
export const FREQUENT_ADG_HTML_FILTERING_ATTRIBUTE_SERIALIZATION_MAP = new Map<string, number>([
    ['tag-content', 0],
    ['wildcard', 1],
    ['max-length', 2],
    ['min-length', 3],
]);
