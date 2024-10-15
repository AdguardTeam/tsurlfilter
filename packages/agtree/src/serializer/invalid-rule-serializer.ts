import { BaseSerializer } from './base-serializer';
import { BinaryTypeMap, type InvalidRule } from '../nodes';
import type { OutputByteBuffer } from '../utils/output-byte-buffer';
import { isUndefined } from '../utils/type-guards';
import { NULL } from '../utils/constants';
import { InvalidRuleErrorNodeSerializer } from './invalid-rule-error-node-serializer';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the binary schema version.!
 *
 * @note Only 256 values can be represented this way.
 */
const enum InvalidRuleSerializationMap {
    Error = 1,
    Start,
    End,
}

export class InvalidRuleSerializer extends BaseSerializer {
    /**
     * Serializes an invalid rule node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: InvalidRule, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.InvalidRule);

        buffer.writeUint8(InvalidRuleSerializationMap.Error);
        InvalidRuleErrorNodeSerializer.serialize(node.error, buffer);

        if (!isUndefined(node.start)) {
            buffer.writeUint8(InvalidRuleSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(InvalidRuleSerializationMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
