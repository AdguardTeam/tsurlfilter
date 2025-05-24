import { type FilterList } from '../nodes/index.js';
import { NULL } from '../utils/constants.js';
import { type OutputByteBuffer } from '../utils/output-byte-buffer.js';
import { isUndefined } from '../utils/type-guards.js';
import { BaseSerializer } from './base-serializer.js';
import { RuleSerializer } from './rule-serializer.js';
import { FilterListNodeMarshallingMap } from '../marshalling-utils/filter-list-common.js';
import { BinaryTypeMarshallingMap } from '../marshalling-utils/misc/binary-type-common.js';

/**
 * Serializes filter list nodes to binary format.
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
        buffer.writeUint8(BinaryTypeMarshallingMap.FilterListNode);

        buffer.writeUint8(FilterListNodeMarshallingMap.Children);
        const count = node.children.length;
        buffer.writeUint32(count);
        for (let i = 0; i < count; i += 1) {
            RuleSerializer.serialize(node.children[i], buffer);
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(FilterListNodeMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(FilterListNodeMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
