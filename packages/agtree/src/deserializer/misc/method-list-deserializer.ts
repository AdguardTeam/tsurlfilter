/* eslint-disable no-param-reassign */
import { NULL } from '../../utils/constants';
import { ListNodeType, type MethodList } from '../../nodes';
import { BaseDeserializer } from '../base-deserializer';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { ListItemsDeserializer } from './list-items-deserializer';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common';
import { MethodListMarshallingMap } from '../../marshalling-utils/misc/method-list-common';

/**
 * `MethodListDeserializer` is responsible for deserializing a method list.
 */
export class MethodListDeserializer extends BaseDeserializer {
    /**
     * Deserializes a method list node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserialize(buffer: InputByteBuffer, node: MethodList): void {
        buffer.assertUint8(BinaryTypeMarshallingMap.MethodListNode);

        node.type = ListNodeType.MethodList;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case MethodListMarshallingMap.Children:
                    ListItemsDeserializer.deserialize(buffer, node.children = []);
                    break;

                case MethodListMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case MethodListMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}.`);
            }

            prop = buffer.readUint8();
        }
    }
}
