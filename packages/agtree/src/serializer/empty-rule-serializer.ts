import { BaseSerializer } from './base-serializer';
import { BinaryTypeMap, type EmptyRule } from '../nodes';
import type { OutputByteBuffer } from '../utils/output-byte-buffer';
import { isUndefined } from '../utils/type-guards';
import { NULL } from '../utils/constants';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the `BINARY_SCHEMA_VERSION` !
 *
 * @note Only 256 values can be represented this way.
 */
const enum EmptyRuleSerializationMap {
    Start = 1,
    End,
}

export class EmptyRuleSerializer extends BaseSerializer {
    /**
     * Serializes an empty rule node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: EmptyRule, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.EmptyRule);

        if (!isUndefined(node.start)) {
            buffer.writeUint8(EmptyRuleSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(EmptyRuleSerializationMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
