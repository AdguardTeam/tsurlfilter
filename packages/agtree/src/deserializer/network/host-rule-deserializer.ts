/* eslint-disable no-param-reassign */
import { NULL } from '../../utils/constants.js';
import {
    type HostRule,
    type HostnameList,
    NetworkRuleType,
    RuleCategory,
    type Value,
} from '../../nodes/index.js';
import { ValueDeserializer } from '../misc/value-deserializer.js';
import { HostnameListDeserializer } from './hostname-list-deserializer.js';
import { BaseDeserializer } from '../base-deserializer.js';
import { type InputByteBuffer } from '../../utils/input-byte-buffer.js';
import { HostRuleMarshallingMap } from '../../marshalling-utils/misc/host-rule-common.js';
import { AdblockSyntax } from '../../utils/adblockers.js';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common.js';
import { getSyntaxDeserializationMap } from '../syntax-deserialization-map.js';

/**
 * `HostRuleDeserializer` is responsible for deserializing hosts-like rules.
 *
 * HostRule is a structure for simple host-level rules (i.e. /etc/hosts syntax).
 * It also supports "just domain" syntax. In this case, the IP will be set to 0.0.0.0.
 */
export class HostRuleDeserializer extends BaseDeserializer {
    /**
     * Deserializes a host rule node from binary format.
     *
     * @param buffer Input byte buffer to read from.
     * @param node Destination node to write to.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<HostRule>): void {
        buffer.assertUint8(BinaryTypeMarshallingMap.HostRuleNode);

        node.category = RuleCategory.Network;
        node.type = NetworkRuleType.HostRule;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case HostRuleMarshallingMap.Syntax:
                    node.syntax = getSyntaxDeserializationMap().get(buffer.readUint8()) ?? AdblockSyntax.Common;
                    break;

                case HostRuleMarshallingMap.Ip:
                    node.ip = {} as Value;
                    ValueDeserializer.deserialize(buffer, node.ip);
                    break;

                case HostRuleMarshallingMap.HostnameList:
                    node.hostnames = {} as HostnameList;
                    HostnameListDeserializer.deserialize(buffer, node.hostnames);
                    break;

                case HostRuleMarshallingMap.Comment:
                    node.comment = {} as Value;
                    ValueDeserializer.deserialize(buffer, node.comment);
                    break;

                case HostRuleMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case HostRuleMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}.`);
            }

            prop = buffer.readUint8();
        }
    }
}
