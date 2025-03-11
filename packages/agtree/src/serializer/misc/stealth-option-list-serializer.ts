// FIXME: Add common values
import { NULL } from '../../utils/constants';
import { type StealthOptionList } from '../../nodes';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { isUndefined } from '../../utils/type-guards';
import { BaseSerializer } from '../base-serializer';
import { ListItemsSerializer } from './list-items-serializer';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common';
import { StealthOptionListMarshallingMap } from '../../marshalling-utils/misc/stealth-option-list-common';

/**
 * `StealthOptionListSerializer` is responsible for serializing a stealth option list.
 */
export class StealthOptionListSerializer extends BaseSerializer {
    /**
     * Serializes a stealth option list node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: StealthOptionList, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMarshallingMap.StealthOptionListNode);

        buffer.writeUint8(StealthOptionListMarshallingMap.Children);
        ListItemsSerializer.serialize(node.children, buffer);

        if (!isUndefined(node.start)) {
            buffer.writeUint8(StealthOptionListMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(StealthOptionListMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
