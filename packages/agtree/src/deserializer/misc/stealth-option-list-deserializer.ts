/* eslint-disable no-param-reassign */
import { NULL } from '../../utils/constants';
import { ListNodeType, type StealthOptionList } from '../../nodes';
import { BaseDeserializer } from '../base-deserializer';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { ListItemsDeserializer } from './list-items-deserializer';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common';
import { StealthOptionListMarshallingMap } from '../../marshalling-utils/misc/stealth-option-list-common';

/**
 * `StealthOptionListDeserializer` is responsible for deserializing a stealth option list.
 */
export class StealthOptionListDeserializer extends BaseDeserializer {
    /**
     * Deserializes a stealth option list node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserialize(buffer: InputByteBuffer, node: StealthOptionList): void {
        buffer.assertUint8(BinaryTypeMarshallingMap.StealthOptionListNode);

        node.type = ListNodeType.StealthOptionList;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case StealthOptionListMarshallingMap.Children:
                    ListItemsDeserializer.deserialize(buffer, node.children = []);
                    break;

                case StealthOptionListMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case StealthOptionListMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}.`);
            }

            prop = buffer.readUint8();
        }
    }
}
