/* eslint-disable no-param-reassign */
import { BaseDeserializer } from './base-deserializer';
import { BinaryTypeMap, type InvalidRuleError } from '../nodes';
import { NULL } from '../utils/constants';
import { type InputByteBuffer } from '../utils/input-byte-buffer';
import { InvalidRuleErrorNodeMarshallingMap } from '../serialization-utils/invalid-rule-error-node-common';

export class InvalidRuleErrorNodeDeserializer extends BaseDeserializer {
    /**
     * Deserializes an invalid rule error node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserializeInvalidRuleErrorNode(buffer: InputByteBuffer, node: Partial<InvalidRuleError>): void {
        buffer.assertUint8(BinaryTypeMap.InvalidRuleErrorNode);

        node.type = 'InvalidRuleError';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case InvalidRuleErrorNodeMarshallingMap.Name:
                    node.name = buffer.readString();
                    break;

                case InvalidRuleErrorNodeMarshallingMap.Message:
                    node.message = buffer.readString();
                    break;

                case InvalidRuleErrorNodeMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case InvalidRuleErrorNodeMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}.`);
            }
            prop = buffer.readUint8();
        }
    }
}
