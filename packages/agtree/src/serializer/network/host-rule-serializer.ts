import { NULL } from '../../utils/constants';
import { type HostRule, BinaryTypeMap, getSyntaxSerializationMap } from '../../nodes';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { ValueSerializer } from '../misc/value-serializer';
import { isUndefined } from '../../utils/type-guards';
import { BINARY_SCHEMA_VERSION } from '../../utils/binary-schema-version';
import { HostnameListSerializer } from './hostname-list-serializer';
import { BaseSerializer } from '../base-serializer';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const enum HostRuleSerializationMap {
    Syntax = 1,
    Raws,
    Ip,
    HostnameList,
    Comment,
    Start,
    End,
}

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
        buffer.writeUint8(BinaryTypeMap.HostRuleNode);

        buffer.writeUint8(HostRuleSerializationMap.Syntax);
        buffer.writeUint8(getSyntaxSerializationMap().get(node.syntax) ?? 0);

        if (node.ip) {
            buffer.writeUint8(HostRuleSerializationMap.Ip);
            ValueSerializer.serialize(node.ip, buffer);
        }

        if (node.hostnames) {
            buffer.writeUint8(HostRuleSerializationMap.HostnameList);
            HostnameListSerializer.serialize(node.hostnames, buffer);
        }

        if (node.comment) {
            buffer.writeUint8(HostRuleSerializationMap.Comment);
            ValueSerializer.serialize(node.comment, buffer);
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(HostRuleSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(HostRuleSerializationMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
