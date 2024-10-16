import { BaseSerializer } from './base-serializer';
import { BinaryTypeMap, type InvalidRuleError } from '../nodes';
import type { OutputByteBuffer } from '../utils/output-byte-buffer';
import { isUndefined } from '../utils/type-guards';
import { NULL } from '../utils/constants';
import { BINARY_SCHEMA_VERSION } from '../utils/binary-schema-version';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const enum InvalidRuleErrorNodeSerializationMap {
    Name = 1,
    Message,
    Start,
    End,
}

export class InvalidRuleErrorNodeSerializer extends BaseSerializer {
    /**
     * Serializes an invalid rule error node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: InvalidRuleError, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.InvalidRuleErrorNode);

        buffer.writeUint8(InvalidRuleErrorNodeSerializationMap.Name);
        buffer.writeString(node.name);

        buffer.writeUint8(InvalidRuleErrorNodeSerializationMap.Message);
        buffer.writeString(node.message);

        if (!isUndefined(node.start)) {
            buffer.writeUint8(InvalidRuleErrorNodeSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(InvalidRuleErrorNodeSerializationMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
