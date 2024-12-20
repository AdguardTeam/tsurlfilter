/* eslint-disable no-param-reassign */
import * as tldts from 'tldts';
import isIp from 'is-ip';

import { StringUtils } from '../../utils/string';
import {
    EMPTY,
    NULL,
    SPACE,
    UINT16_MAX,
} from '../../utils/constants';
import {
    type HostRule,
    NetworkRuleType,
    RuleCategory,
    type Value,
    BinaryTypeMap,
    SYNTAX_SERIALIZATION_MAP,
    type HostnameList,
    SYNTAX_DESERIALIZATION_MAP,
} from '../common';
import { defaultParserOptions } from '../options';
import { ParserBase } from '../interface';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { AdblockSyntax } from '../../utils/adblockers';
import { ValueParser } from '../misc/value';
import { isUndefined } from '../../utils/type-guards';
import { BINARY_SCHEMA_VERSION } from '../../utils/binary-schema-version';

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
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const enum HostnameListNodeSerializationMap {
    Children = 1,
    Start,
    End,
}

/**
 * `HostRuleParser` is responsible for parsing hosts-like rules.
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
export class HostRuleParser extends ParserBase {
    public static readonly NULL_IP = '0.0.0.0';

    public static readonly COMMENT_MARKER = '#';

    /**
     * Parses an etc/hosts-like rule.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @returns Host rule node.
     *
     * @throws If the input contains invalid data.
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): HostRule {
        let offset = StringUtils.skipWS(raw, 0);
        const parts: Value[] = [];
        let lastPartStartIndex = offset;
        let comment: Value | null = null;
        const rawLength = raw.length;

        const parsePartIfNeeded = (startIndex: number, endIndex: number): void => {
            if (startIndex < endIndex) {
                parts.push(ValueParser.parse(raw.slice(startIndex, endIndex), options, baseOffset + startIndex));
            }
        };

        while (offset < rawLength) {
            if (StringUtils.isWhitespace(raw[offset])) {
                parsePartIfNeeded(lastPartStartIndex, offset);
                offset = StringUtils.skipWS(raw, offset);
                lastPartStartIndex = offset;
            } else if (raw[offset] === HostRuleParser.COMMENT_MARKER) {
                const commentStart = offset;
                offset = StringUtils.skipWS(raw, offset + 1);
                comment = ValueParser.parse(raw.slice(offset), options, baseOffset + commentStart);
                offset = rawLength;
                lastPartStartIndex = offset;
            } else {
                offset += 1;
            }
        }

        parsePartIfNeeded(lastPartStartIndex, offset);

        const partsLength = parts.length;

        if (partsLength < 1) {
            throw new Error('Host rule must have at least one domain name or an IP address and a domain name');
        }

        const result: Partial<HostRule> = {
            category: RuleCategory.Network,
            type: NetworkRuleType.HostRule,
            syntax: AdblockSyntax.Common,
        };

        if (partsLength === 1) {
            // "Just domain" syntax, e.g. `example.org`
            // In this case, domain should be valid and IP will be set to 0.0.0.0 by default
            if (tldts.getDomain(parts[0].value) !== parts[0].value) {
                throw new Error(`Not a valid domain: ${parts[0].value}`);
            }

            result.ip = {
                type: 'Value',
                value: HostRuleParser.NULL_IP,
            };

            result.hostnames = {
                type: 'HostnameList',
                children: parts,
            };
        } else if (partsLength > 1) {
            // IP + domain list syntax
            const [ip, ...hostnames] = parts;

            if (!isIp(ip.value)) {
                throw new Error(`Invalid IP address: ${ip.value}`);
            }

            for (const { value } of hostnames) {
                if (tldts.getHostname(value) !== value) {
                    throw new Error(`Not a valid hostname: ${value}`);
                }
            }

            result.ip = ip;

            result.hostnames = {
                type: 'HostnameList',
                children: hostnames,
            };
        }

        if (comment) {
            result.comment = comment;
        }

        if (options.includeRaws) {
            result.raws = {
                text: raw,
            };
        }

        return result as HostRule;
    }

    /**
     * Converts a host rule node to a raw string.
     *
     * @param node Host rule node.
     * @returns Raw string.
     */
    public static generate(node: HostRule): string {
        const result: string[] = [];

        if (node.ip) {
            result.push(node.ip.value);
        }

        if (node.hostnames) {
            result.push(SPACE);
            result.push(node.hostnames.children.map(({ value }) => value).join(SPACE));
        }

        if (node.comment) {
            result.push(SPACE);
            result.push(HostRuleParser.COMMENT_MARKER);
            result.push(SPACE);
            result.push(node.comment.value);
        }

        return result.join(EMPTY);
    }

    /**
     * Serializes a hostname list node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    private static serializeHostnameList(node: HostnameList, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.HostnameListNode);

        if (!isUndefined(node.start)) {
            buffer.writeUint8(HostnameListNodeSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(HostnameListNodeSerializationMap.End);
            buffer.writeUint32(node.end);
        }

        const count = node.children.length;
        // If there are no children, we do not write any data related to them, to avoid using unnecessary storage,
        // but children is a required field, so during deserialization we should initialize it as an empty array,
        // if there are no children in the binary data.
        if (count) {
            // note: we store the count, because re-construction of the array is faster if we know the length
            if (count > UINT16_MAX) {
                throw new Error(`Too many children: ${count}, the limit is ${UINT16_MAX}`);
            }

            buffer.writeUint8(HostnameListNodeSerializationMap.Children);
            buffer.writeUint16(count);

            for (let i = 0; i < count; i += 1) {
                ValueParser.serialize(node.children[i], buffer);
            }
        }

        buffer.writeUint8(NULL);
    }

    /**
     * Deserializes a hostname list node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    private static deserializeHostnameList(buffer: InputByteBuffer, node: HostnameList): void {
        buffer.assertUint8(BinaryTypeMap.HostnameListNode);

        node.type = 'HostnameList';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case HostnameListNodeSerializationMap.Children:
                    node.children = new Array(buffer.readUint16());

                    // read children
                    for (let i = 0; i < node.children.length; i += 1) {
                        ValueParser.deserialize(buffer, node.children[i] = {} as Value);
                    }
                    break;
                case HostnameListNodeSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;
                case HostnameListNodeSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;
                default:
                    throw new Error(`Unknown property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
        // Maybe children are not present in the binary data,
        // in this case, we should initialize it as an empty array.
        if (!node.children) {
            node.children = [];
        }
    }

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
        buffer.writeUint8(SYNTAX_SERIALIZATION_MAP.get(node.syntax) ?? 0);

        if (node.ip) {
            buffer.writeUint8(HostRuleSerializationMap.Ip);
            ValueParser.serialize(node.ip, buffer);
        }

        if (node.hostnames) {
            buffer.writeUint8(HostRuleSerializationMap.HostnameList);
            HostRuleParser.serializeHostnameList(node.hostnames, buffer);
        }

        if (node.comment) {
            buffer.writeUint8(HostRuleSerializationMap.Comment);
            ValueParser.serialize(node.comment, buffer);
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

    /**
     * Deserializes a modifier node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<HostRule>): void {
        buffer.assertUint8(BinaryTypeMap.HostRuleNode);

        node.category = RuleCategory.Network;
        node.type = NetworkRuleType.HostRule;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case HostRuleSerializationMap.Syntax:
                    node.syntax = SYNTAX_DESERIALIZATION_MAP.get(buffer.readUint8()) ?? AdblockSyntax.Common;
                    break;

                case HostRuleSerializationMap.Ip:
                    node.ip = {} as Value;
                    ValueParser.deserialize(buffer, node.ip);
                    break;

                case HostRuleSerializationMap.HostnameList:
                    node.hostnames = {} as HostnameList;
                    HostRuleParser.deserializeHostnameList(buffer, node.hostnames);
                    break;

                case HostRuleSerializationMap.Comment:
                    node.comment = {} as Value;
                    ValueParser.deserialize(buffer, node.comment);
                    break;

                case HostRuleSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case HostRuleSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}.`);
            }

            prop = buffer.readUint8();
        }
    }
}
