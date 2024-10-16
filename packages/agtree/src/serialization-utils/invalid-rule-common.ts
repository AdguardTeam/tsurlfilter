/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the binary schema version.!
 *
 * @note Only 256 values can be represented this way.
 */
export const enum InvalidRuleSerializationMap {
    Error = 1,
    Start,
    End,
}
