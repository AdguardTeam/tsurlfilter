/* eslint-disable no-param-reassign */
import { BaseDeserializer } from './base-deserializer.js';
import { type InvalidRuleError } from '../nodes/index.js';
import { NULL } from '../utils/constants.js';
import { type InputByteBuffer } from '../utils/input-byte-buffer.js';
import { InvalidRuleErrorNodeMarshallingMap } from '../marshalling-utils/invalid-rule-error-node-common.js';
import { BinaryTypeMarshallingMap } from '../marshalling-utils/misc/binary-type-common.js';

/**
 * Deserializer for invalid rule error nodes.
 * Converts binary data into invalid rule error nodes.
 */
export class InvalidRuleErrorNodeDeserializer extends BaseDeserializer {
    /**
     * Deserializes an invalid rule error node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<InvalidRuleError>): void {
        buffer.assertUint8(BinaryTypeMarshallingMap.InvalidRuleErrorNode);

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
