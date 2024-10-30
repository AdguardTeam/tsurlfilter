import { BaseSerializer } from './base-serializer';
import { type EmptyRule } from '../nodes';
import type { OutputByteBuffer } from '../utils/output-byte-buffer';
import { isUndefined } from '../utils/type-guards';
import { NULL } from '../utils/constants';
import { EmptyRuleMarshallingMap } from '../marshalling-utils/empty-rule-common';
import { BinaryTypeMarshallingMap } from '../marshalling-utils/misc/binary-type-common';

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
