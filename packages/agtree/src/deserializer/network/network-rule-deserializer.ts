/* eslint-disable no-param-reassign */
import { NULL } from '../../utils/constants';
import {
    type NetworkRule,
    getSyntaxDeserializationMap,
    type ModifierList,
    NetworkRuleType,
    RuleCategory,
    type Value,
} from '../../nodes';
import { ValueDeserializer } from '../misc/value-deserializer';
import { BaseDeserializer } from '../base-deserializer';
import { ModifierListDeserializer } from '../misc/modifier-list-deserializer';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { NetworkRuleMarshallingMap } from '../../serialization-utils/network/network-rule-common';
import { AdblockSyntax } from '../../utils/adblockers';
import { BinaryTypeMarshallingMap } from '../../common/marshalling-common';

/**
 * `NetworkRuleDeserializer` is responsible for deserializing network rules.
 *
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#basic-rules}
 * @see {@link https://help.eyeo.com/adblockplus/how-to-write-filters#basic}
 */
export class NetworkRuleDeserializer extends BaseDeserializer {
    /**
     * Deserializes a network rule node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<NetworkRule>): void {
        buffer.assertUint8(BinaryTypeMarshallingMap.NetworkRuleNode);

        node.type = NetworkRuleType.NetworkRule;
        node.category = RuleCategory.Network;
        node.modifiers = undefined;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case NetworkRuleMarshallingMap.Syntax:
                    node.syntax = getSyntaxDeserializationMap().get(buffer.readUint8()) ?? AdblockSyntax.Common;
                    break;

                case NetworkRuleMarshallingMap.Exception:
                    node.exception = buffer.readUint8() === 1;
                    break;

                case NetworkRuleMarshallingMap.Pattern:
                    ValueDeserializer.deserialize(buffer, node.pattern = {} as Value);
                    break;

                case NetworkRuleMarshallingMap.ModifierList:
                    ModifierListDeserializer.deserialize(buffer, node.modifiers = {} as ModifierList);
                    break;

                case NetworkRuleMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case NetworkRuleMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}.`);
            }

            prop = buffer.readUint8();
        }
    }
}
