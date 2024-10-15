import { NULL } from '../../utils/constants';
import { type MetadataCommentRule, BinaryTypeMap } from '../../nodes';
import { ValueSerializer } from '../misc/value-serializer';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { isUndefined } from '../../utils/type-guards';
import { BINARY_SCHEMA_VERSION } from '../../utils/binary-schema-version';
import { BaseSerializer } from '../base-serializer';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const enum MetadataCommentRuleSerializationMap {
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
const FREQUENT_HEADERS_DESERIALIZATION_MAP = new Map<number, string>([
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

/**
 * Value map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 * @note This map is generated from `FREQUENT_HEADERS_DESERIALIZATION_MAP` to keep uppercase characters
 * while deserializing.
 */
let FREQUENT_HEADERS_SERIALIZATION_MAP: Map<string, number>;
const getFrequentHeadersSerializationMap = () => {
    if (!FREQUENT_HEADERS_SERIALIZATION_MAP) {
        FREQUENT_HEADERS_SERIALIZATION_MAP = new Map<string, number>(
            Array.from(FREQUENT_HEADERS_DESERIALIZATION_MAP.entries())
                .map(([key, value]) => [value.toLowerCase(), key]),
        );
    }
    return FREQUENT_HEADERS_SERIALIZATION_MAP;
};

/**
 * `MetadataCommentSerializer` is responsible for serializing metadata comments.
 * Metadata comments are special comments that specify some properties of the list.
 *
 * @example
 * For example, in the case of
 * ```adblock
 * ! Title: My List
 * ```
 * the name of the header is `Title`, and the value is `My List`, which means that
 * the list title is `My List`, and it can be used in the adblocker UI.
 * @see {@link https://help.eyeo.com/adblockplus/how-to-write-filters#special-comments}
 */
export class MetadataCommentSerializer extends BaseSerializer {
    /**
     * Serializes a metadata comment node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    // TODO: add support for raws, if ever needed
    public static serialize(node: MetadataCommentRule, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.MetadataCommentRuleNode);

        buffer.writeUint8(MetadataCommentRuleSerializationMap.Marker);
        ValueSerializer.serialize(node.marker, buffer);

        buffer.writeUint8(MetadataCommentRuleSerializationMap.Header);
        ValueSerializer.serialize(node.header, buffer, getFrequentHeadersSerializationMap(), true);

        buffer.writeUint8(MetadataCommentRuleSerializationMap.Value);
        ValueSerializer.serialize(node.value, buffer);

        if (!isUndefined(node.start)) {
            buffer.writeUint8(MetadataCommentRuleSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(MetadataCommentRuleSerializationMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
