import { BaseSerializer } from './base-serializer.js';
import { type EmptyRule } from '../nodes/index.js';
import type { OutputByteBuffer } from '../utils/output-byte-buffer.js';
import { isUndefined } from '../utils/type-guards.js';
import { NULL } from '../utils/constants.js';
import { EmptyRuleMarshallingMap } from '../marshalling-utils/empty-rule-common.js';
import { BinaryTypeMarshallingMap } from '../marshalling-utils/misc/binary-type-common.js';

/**
 * Serializer for empty rule nodes.
 */
export class EmptyRuleSerializer extends BaseSerializer {
    /**
     * Serializes an empty rule node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: EmptyRule, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMarshallingMap.EmptyRule);

        if (!isUndefined(node.start)) {
            buffer.writeUint8(EmptyRuleMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(EmptyRuleMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
