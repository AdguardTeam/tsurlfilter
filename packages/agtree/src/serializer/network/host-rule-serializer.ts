import { NULL } from '../../utils/constants.js';
import { type HostRule } from '../../nodes/index.js';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer.js';
import { ValueSerializer } from '../misc/value-serializer.js';
import { isUndefined } from '../../utils/type-guards.js';
import { HostnameListSerializer } from './hostname-list-serializer.js';
import { BaseSerializer } from '../base-serializer.js';
import { HostRuleMarshallingMap } from '../../marshalling-utils/misc/host-rule-common.js';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common.js';
import { getSyntaxSerializationMap } from '../../marshalling-utils/syntax-serialization-map.js';

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
export class HostRuleSerializer extends BaseSerializer {
    /**
     * Serializes a host rule node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    // TODO: add support for raws, if ever needed
    public static serialize(node: HostRule, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMarshallingMap.HostRuleNode);

        buffer.writeUint8(HostRuleMarshallingMap.Syntax);
        buffer.writeUint8(getSyntaxSerializationMap().get(node.syntax) ?? 0);

        if (node.ip) {
            buffer.writeUint8(HostRuleMarshallingMap.Ip);
            ValueSerializer.serialize(node.ip, buffer);
        }

        if (node.hostnames) {
            buffer.writeUint8(HostRuleMarshallingMap.HostnameList);
            HostnameListSerializer.serialize(node.hostnames, buffer);
        }

        if (node.comment) {
            buffer.writeUint8(HostRuleMarshallingMap.Comment);
            ValueSerializer.serialize(node.comment, buffer);
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(HostRuleMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(HostRuleMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
