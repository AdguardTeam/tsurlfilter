/* eslint-disable no-param-reassign */
import { NULL } from '../../utils/constants';
import { BinaryTypeMap, type Modifier, type ModifierList } from '../../nodes';
import { BaseDeserializer } from '../base-deserializer';
import { ModifierDeserializer } from './modifier-deserializer';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { ModifierListNodeMarshallingMap } from '../../serialization-utils/misc/modifier-list-common';

/**
 * `ModifierListDeserializer` is responsible for deserializing modifier lists. Please note that the name is not
 * uniform, "modifiers" are also known as "options".
 *
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#basic-rules-modifiers}
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#non-basic-rules-modifiers}
 * @see {@link https://help.eyeo.com/adblockplus/how-to-write-filters#options}
 */
export class ModifierListDeserializer extends BaseDeserializer {
    /**
     * Deserializes a modifier list node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserialize(buffer: InputByteBuffer, node: ModifierList): void {
        buffer.assertUint8(BinaryTypeMap.ModifierListNode);

        node.type = 'ModifierList';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case ModifierListNodeMarshallingMap.Children:
                    node.children = new Array(buffer.readUint16());

                    // read children
                    for (let i = 0; i < node.children.length; i += 1) {
                        ModifierDeserializer.deserialize(buffer, node.children[i] = {} as Modifier);
                    }
                    break;

                case ModifierListNodeMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case ModifierListNodeMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}.`);
            }
            prop = buffer.readUint8();
        }
    }
}
