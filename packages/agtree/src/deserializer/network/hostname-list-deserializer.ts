/* eslint-disable no-param-reassign */
import { BaseDeserializer } from '../base-deserializer';
import { BinaryTypeMap, type Value, type HostnameList } from '../../nodes';
import { NULL } from '../../utils/constants';
import { ValueDeserializer } from '../misc/value-deserializer';
import { HostnameListNodeMarshallingMap } from '../../serialization-utils/misc/hostname-list-common';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';

export class HostnameListDeserializer extends BaseDeserializer {
    /**
     * Deserializes a hostname list node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserialize(buffer: InputByteBuffer, node: HostnameList): void {
        buffer.assertUint8(BinaryTypeMap.HostnameListNode);

        node.type = 'HostnameList';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case HostnameListNodeMarshallingMap.Children:
                    node.children = new Array(buffer.readUint16());

                    // read children
                    for (let i = 0; i < node.children.length; i += 1) {
                        ValueDeserializer.deserialize(buffer, node.children[i] = {} as Value);
                    }
                    break;
                case HostnameListNodeMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;
                case HostnameListNodeMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;
                default:
                    throw new Error(`Unknown property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
