import { BaseSerializer } from './base-serializer.js';
import { type InvalidRule } from '../nodes/index.js';
import type { OutputByteBuffer } from '../utils/output-byte-buffer.js';
import { isUndefined } from '../utils/type-guards.js';
import { NULL } from '../utils/constants.js';
import { InvalidRuleErrorNodeSerializer } from './invalid-rule-error-node-serializer.js';
import { InvalidRuleMarshallingMap } from '../marshalling-utils/invalid-rule-common.js';
import { BinaryTypeMarshallingMap } from '../marshalling-utils/misc/binary-type-common.js';

/**
 * Serializer for invalid rule nodes.
 */
export class InvalidRuleSerializer extends BaseSerializer {
    /**
     * Serializes an invalid rule node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: InvalidRule, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMarshallingMap.InvalidRule);

        buffer.writeUint8(InvalidRuleMarshallingMap.Error);
        InvalidRuleErrorNodeSerializer.serialize(node.error, buffer);

        if (!isUndefined(node.start)) {
            buffer.writeUint8(InvalidRuleMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(InvalidRuleMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
