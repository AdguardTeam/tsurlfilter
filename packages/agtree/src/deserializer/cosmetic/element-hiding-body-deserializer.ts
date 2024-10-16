/* eslint-disable no-param-reassign */
import { BaseDeserializer } from '../base-deserializer';
import { BinaryTypeMap, type Value, type ElementHidingRuleBody } from '../../nodes';
import { NULL } from '../../utils/constants';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { ElementHidingRuleSerializationMap } from '../../serialization-utils/cosmetic/body/element-hiding-body-common';
import { ValueDeserializer } from '../misc/value-deserializer';

export class ElementHidingBodyDeserializer extends BaseDeserializer {
    /**
     * Deserializes an element hiding rule body node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserializeElementHidingBody(buffer: InputByteBuffer, node: Partial<ElementHidingRuleBody>): void {
        buffer.assertUint8(BinaryTypeMap.ElementHidingRuleBody);

        node.type = 'ElementHidingRuleBody';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case ElementHidingRuleSerializationMap.SelectorList:
                    ValueDeserializer.deserialize(buffer, node.selectorList = {} as Value);
                    break;

                case ElementHidingRuleSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case ElementHidingRuleSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Unknown property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
