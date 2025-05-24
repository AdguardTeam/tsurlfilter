/* eslint-disable no-param-reassign */
import { NULL } from '../../utils/constants.js';
import { type Modifier, type ModifierList } from '../../nodes/index.js';
import { BaseDeserializer } from '../base-deserializer.js';
import { ModifierDeserializer } from './modifier-deserializer.js';
import { type InputByteBuffer } from '../../utils/input-byte-buffer.js';
import { ModifierListNodeMarshallingMap } from '../../marshalling-utils/misc/modifier-list-common.js';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common.js';

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
        buffer.assertUint8(BinaryTypeMarshallingMap.ModifierListNode);

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
        // Maybe children are not present in the binary data,
        // in this case, we should initialize it as an empty array.
        if (!node.children) {
            node.children = [];
        }
    }
}
