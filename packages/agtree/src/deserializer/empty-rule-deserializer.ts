/* eslint-disable no-param-reassign */
import { BaseDeserializer } from './base-deserializer';
import { RuleCategory, type EmptyRule } from '../nodes';
import { NULL } from '../utils/constants';
import { type InputByteBuffer } from '../utils/input-byte-buffer';
import { EmptyRuleMarshallingMap } from '../marshalling-utils/empty-rule-common';
import { AdblockSyntax } from '../utils/adblockers';
import { BinaryTypeMarshallingMap } from '../marshalling-utils/misc/binary-type-common';

/**
 * Deserializer for empty rule nodes.
 * This class handles the deserialization of empty rule nodes from binary format.
 */
export class EmptyRuleDeserializer extends BaseDeserializer {
    /**
     * Deserializes an empty rule node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserialize(buffer: InputByteBuffer, node: EmptyRule): void {
        buffer.assertUint8(BinaryTypeMarshallingMap.EmptyRule);

        node.type = 'EmptyRule';
        node.category = RuleCategory.Empty;
        node.syntax = AdblockSyntax.Common;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case EmptyRuleMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case EmptyRuleMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}.`);
            }
            prop = buffer.readUint8();
        }
    }
}
