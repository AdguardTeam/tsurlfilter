/* eslint-disable no-param-reassign */
import { BaseDeserializer } from '../base-deserializer.js';
import { type Value, type ElementHidingRuleBody } from '../../nodes/index.js';
import { NULL } from '../../utils/constants.js';
import { type InputByteBuffer } from '../../utils/input-byte-buffer.js';
import { ElementHidingRuleMarshallingMap } from '../../marshalling-utils/cosmetic/body/element-hiding-body-common.js';
import { ValueDeserializer } from '../misc/value-deserializer.js';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common.js';

/**
 * Deserializes element hiding rule body nodes from binary data.
 * Populates the provided node with the deserialized data.
 */
export class ElementHidingBodyDeserializer extends BaseDeserializer {
    /**
     * Deserializes an element hiding rule body node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserializeElementHidingBody(buffer: InputByteBuffer, node: Partial<ElementHidingRuleBody>): void {
        buffer.assertUint8(BinaryTypeMarshallingMap.ElementHidingRuleBody);

        node.type = 'ElementHidingRuleBody';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case ElementHidingRuleMarshallingMap.SelectorList:
                    ValueDeserializer.deserialize(buffer, node.selectorList = {} as Value);
                    break;

                case ElementHidingRuleMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case ElementHidingRuleMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Unknown property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
