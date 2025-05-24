/* eslint-disable no-param-reassign */
import { BaseDeserializer } from './base-deserializer.js';
import { type InvalidRuleError, RuleCategory, type InvalidRule } from '../nodes/index.js';
import { NULL } from '../utils/constants.js';
import { InvalidRuleErrorNodeDeserializer } from './invalid-rule-error-node-deserializer.js';
import { type InputByteBuffer } from '../utils/input-byte-buffer.js';
import { InvalidRuleMarshallingMap } from '../marshalling-utils/invalid-rule-common.js';
import { BinaryTypeMarshallingMap } from '../marshalling-utils/misc/binary-type-common.js';

/**
 * Deserializer for invalid rule nodes.
 * Converts binary data into invalid rule nodes.
 */
export class InvalidRuleDeserializer extends BaseDeserializer {
    /**
     * Deserializes an invalid rule node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserialize(buffer: InputByteBuffer, node: InvalidRule): void {
        buffer.assertUint8(BinaryTypeMarshallingMap.InvalidRule);

        node.type = 'InvalidRule';
        node.category = RuleCategory.Invalid;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case InvalidRuleMarshallingMap.Error:
                    InvalidRuleErrorNodeDeserializer.deserialize(buffer, node.error = {} as InvalidRuleError);
                    break;

                case InvalidRuleMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case InvalidRuleMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}.`);
            }

            prop = buffer.readUint8();
        }
    }
}
