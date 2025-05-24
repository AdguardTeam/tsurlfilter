import { BaseSerializer } from './base-serializer.js';
import { type InvalidRuleError } from '../nodes/index.js';
import type { OutputByteBuffer } from '../utils/output-byte-buffer.js';
import { isUndefined } from '../utils/type-guards.js';
import { NULL } from '../utils/constants.js';
import { InvalidRuleErrorNodeMarshallingMap } from '../marshalling-utils/invalid-rule-error-node-common.js';
import { BinaryTypeMarshallingMap } from '../marshalling-utils/misc/binary-type-common.js';

/**
 * Serializer for invalid rule error nodes.
 */
export class InvalidRuleErrorNodeSerializer extends BaseSerializer {
    /**
     * Serializes an invalid rule error node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: InvalidRuleError, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMarshallingMap.InvalidRuleErrorNode);

        buffer.writeUint8(InvalidRuleErrorNodeMarshallingMap.Name);
        buffer.writeString(node.name);

        buffer.writeUint8(InvalidRuleErrorNodeMarshallingMap.Message);
        buffer.writeString(node.message);

        if (!isUndefined(node.start)) {
            buffer.writeUint8(InvalidRuleErrorNodeMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(InvalidRuleErrorNodeMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
