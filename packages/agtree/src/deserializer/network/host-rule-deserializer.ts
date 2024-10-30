/* eslint-disable no-param-reassign */
import { NULL } from '../../utils/constants';
import {
    type HostRule,
    type HostnameList,
    NetworkRuleType,
    RuleCategory,
    type Value,
} from '../../nodes';
import { ValueDeserializer } from '../misc/value-deserializer';
import { HostnameListDeserializer } from './hostname-list-deserializer';
import { BaseDeserializer } from '../base-deserializer';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { HostRuleMarshallingMap } from '../../marshalling-utils/misc/host-rule-common';
import { AdblockSyntax } from '../../utils/adblockers';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common';
import { getSyntaxDeserializationMap } from '../syntax-deserialization-map';

/**
 * `HostRuleSerializer` is responsible for serializing hosts-like rules.
 *
 * HostRule is a structure for simple host-level rules (i.e. /etc/hosts syntax).
 * It also supports "just domain" syntax. In this case, the IP will be set to 0.0.0.0.
 *
 * Rules syntax looks like this:
 * ```text
 * IP_address canonical_hostname [aliases...]
 * ```
 *
 * @example
 * `192.168.1.13 bar.mydomain.org bar` -- ipv4
 * `ff02::1 ip6-allnodes` -- ipv6
 * `::1 localhost ip6-localhost ip6-loopback` -- ipv6 aliases
 * `example.org` -- "just domain" syntax
 * @see {@link http://man7.org/linux/man-pages/man5/hosts.5.html}
 */
export class HostRuleDeserializer extends BaseDeserializer {
    /**
     * Deserializes a modifier node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
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
