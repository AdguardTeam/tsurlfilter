/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
export const KNOWN_METADATA_HEADERS = new Set([
    'Checksum',
    'Description',
    'Expires',
    'Homepage',
    'Last Modified',
    'LastModified',
    'Licence',
    'License',
    'Time Updated',
    'TimeUpdated',
    'Version',
    'Title',
]);
