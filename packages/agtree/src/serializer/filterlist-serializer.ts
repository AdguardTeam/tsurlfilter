import { BinaryTypeMap, type FilterList } from '../nodes';
import { NULL } from '../utils/constants';
import { type OutputByteBuffer } from '../utils/output-byte-buffer';
import { isUndefined } from '../utils/type-guards';
import { BINARY_SCHEMA_VERSION } from '../utils/binary-schema-version';
import { BaseSerializer } from './base-serializer';
import { RuleSerializer } from './rule-serializer';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const enum FilterListNodeSerializationMap {
    Children = 1,
    Start,
    End,
}

/**
 * `FilterListParser` is responsible for parsing a whole adblock filter list (list of rules).
 * It is a wrapper around `RuleParser` which parses each line separately.
 */
export class FilterListSerializer extends BaseSerializer {
    /**
     * Serializes a filter list node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    // TODO: add support for raws, if ever needed
    public static serialize(node: FilterList, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.FilterListNode);

        buffer.writeUint8(FilterListNodeSerializationMap.Children);
        const count = node.children.length;
        buffer.writeUint32(count);
        for (let i = 0; i < count; i += 1) {
            RuleSerializer.serialize(node.children[i], buffer);
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(FilterListNodeSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(FilterListNodeSerializationMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
