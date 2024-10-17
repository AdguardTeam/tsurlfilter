import { BaseSerializer } from './base-serializer';
import { BinaryTypeMap, type EmptyRule } from '../nodes';
import type { OutputByteBuffer } from '../utils/output-byte-buffer';
import { isUndefined } from '../utils/type-guards';
import { NULL } from '../utils/constants';
import { EmptyRuleMarshallingMap } from '../serialization-utils/empty-rule-common';

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
