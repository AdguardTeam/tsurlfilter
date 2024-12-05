/* eslint-disable no-param-reassign */
import { BaseDeserializer } from './base-deserializer';
import { type InvalidRuleError, RuleCategory, type InvalidRule } from '../nodes';
import { NULL } from '../utils/constants';
import { InvalidRuleErrorNodeDeserializer } from './invalid-rule-error-node-deserializer';
import { type InputByteBuffer } from '../utils/input-byte-buffer';
import { InvalidRuleMarshallingMap } from '../marshalling-utils/invalid-rule-common';
import { BinaryTypeMarshallingMap } from '../marshalling-utils/misc/binary-type-common';

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
