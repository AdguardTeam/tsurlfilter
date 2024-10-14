/* eslint-disable no-param-reassign */
/**
 * @file Metadata comments
 */

import { StringUtils } from '../../utils/string';
import { AdblockSyntax } from '../../utils/adblockers';
import {
    COLON,
    EMPTY,
    NULL,
    SPACE,
} from '../../utils/constants';
import {
    CommentMarker,
    CommentRuleType,
    type MetadataCommentRule,
    RuleCategory,
    BinaryTypeMap,
    type Value,
} from '../../nodes';
import { defaultParserOptions } from '../options';
import { ParserBase } from '../interface';
import { ValueParser } from '../misc/value';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { isUndefined } from '../../utils/type-guards';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { BINARY_SCHEMA_VERSION } from '../../utils/binary-schema-version';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const enum MetadataCommentRuleSerializationMap {
    Marker = 1,
    Header,
    Value,
    Start,
    End,
}

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
const FREQUENT_HEADERS_DESERIALIZATION_MAP = new Map<number, string>([
    [1, 'Checksum'],
    [2, 'Description'],
    [3, 'Expires'],
    [4, 'Homepage'],
    [5, 'Last Modified'],
    [6, 'LastModified'],
    [7, 'Licence'],
    [8, 'License'],
    [9, 'Time Updated'],
    [10, 'TimeUpdated'],
    [11, 'Version'],
    [12, 'Title'],
]);

/**
 * Value map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 * @note This map is generated from `FREQUENT_HEADERS_DESERIALIZATION_MAP` to keep uppercase characters
 * while deserializing.
 */
const FREQUENT_HEADERS_SERIALIZATION_MAP = new Map<string, number>(
    Array.from(FREQUENT_HEADERS_DESERIALIZATION_MAP.entries()).map(([key, value]) => [value.toLowerCase(), key]),
);

/**
 * Known metadata headers.
 */
export const KNOWN_METADATA_HEADERS = Array.from(FREQUENT_HEADERS_SERIALIZATION_MAP.keys());

/**
 * `MetadataParser` is responsible for parsing metadata comments.
 * Metadata comments are special comments that specify some properties of the list.
 *
 * @example
 * For example, in the case of
 * ```adblock
 * ! Title: My List
 * ```
 * the name of the header is `Title`, and the value is `My List`, which means that
 * the list title is `My List`, and it can be used in the adblocker UI.
 * @see {@link https://help.eyeo.com/adblockplus/how-to-write-filters#special-comments}
 */
export class MetadataCommentRuleParser extends ParserBase {
    /**
     * Parses a raw rule as a metadata comment.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @returns Metadata comment AST or null (if the raw rule cannot be parsed as a metadata comment)
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): MetadataCommentRule | null {
        // Fast check to avoid unnecessary work
        if (raw.indexOf(COLON) === -1) {
            return null;
        }

        let offset = 0;

        // Skip leading spaces before the comment marker
        offset = StringUtils.skipWS(raw, offset);

        // Check if the rule starts with a comment marker (first non-space sequence)
        if (raw[offset] !== CommentMarker.Regular && raw[offset] !== CommentMarker.Hashmark) {
            return null;
        }

        // Consume the comment marker
        const marker = ValueParser.parse(raw[offset], options, baseOffset + offset);

        offset += 1;

        // Skip spaces
        offset = StringUtils.skipWS(raw, offset);

        // Save header start position
        const headerStart = offset;

        // Check if the comment text starts with a known header
        const text = raw.slice(offset);

        for (let i = 0; i < KNOWN_METADATA_HEADERS.length; i += 1) {
            // Check if the comment text starts with the header (case-insensitive)
            if (text.toLocaleLowerCase().startsWith(KNOWN_METADATA_HEADERS[i].toLocaleLowerCase())) {
                // Skip the header
                offset += KNOWN_METADATA_HEADERS[i].length;

                // Save header
                const header = ValueParser.parse(raw.slice(headerStart, offset), options, baseOffset + headerStart);

                // Skip spaces after the header
                offset = StringUtils.skipWS(raw, offset);

                // Check if the rule contains a separator after the header
                if (raw[offset] !== COLON) {
                    return null;
                }

                // Skip the separator
                offset += 1;

                // Skip spaces after the separator
                offset = StringUtils.skipWS(raw, offset);

                // Save the value start position
                const valueStart = offset;

                // Check if the rule contains a value
                if (offset >= raw.length) {
                    return null;
                }

                const valueEnd = StringUtils.skipWSBack(raw, raw.length - 1) + 1;

                // Save the value
                const value = ValueParser.parse(raw.slice(valueStart, valueEnd), options, baseOffset + valueStart);

                const result: MetadataCommentRule = {
                    type: CommentRuleType.MetadataCommentRule,
                    category: RuleCategory.Comment,
                    syntax: AdblockSyntax.Common,
                    marker,
                    header,
                    value,
                };

                if (options.includeRaws) {
                    result.raws = {
                        text: raw,
                    };
                }

                if (options.isLocIncluded) {
                    result.start = baseOffset;
                    result.end = baseOffset + raw.length;
                }

                return result;
            }
        }

        return null;
    }

    /**
     * Converts a metadata comment rule node to a string.
     *
     * @param node Metadata comment rule node.
     * @returns Raw string.
     */
    public static generate(node: MetadataCommentRule): string {
        let result = EMPTY;

        result += ValueParser.generate(node.marker);
        result += SPACE;
        result += ValueParser.generate(node.header);
        result += COLON;
        result += SPACE;
        result += ValueParser.generate(node.value);

        return result;
    }

    /**
     * Serializes a metadata comment node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    // TODO: add support for raws, if ever needed
    public static serialize(node: MetadataCommentRule, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.MetadataCommentRuleNode);

        buffer.writeUint8(MetadataCommentRuleSerializationMap.Marker);
        ValueParser.serialize(node.marker, buffer);

        buffer.writeUint8(MetadataCommentRuleSerializationMap.Header);
        ValueParser.serialize(node.header, buffer, FREQUENT_HEADERS_SERIALIZATION_MAP, true);

        buffer.writeUint8(MetadataCommentRuleSerializationMap.Value);
        ValueParser.serialize(node.value, buffer);

        if (!isUndefined(node.start)) {
            buffer.writeUint8(MetadataCommentRuleSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(MetadataCommentRuleSerializationMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }

    /**
     * Deserializes a metadata comment node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<MetadataCommentRule>): void {
        buffer.assertUint8(BinaryTypeMap.MetadataCommentRuleNode);

        node.type = CommentRuleType.MetadataCommentRule;
        node.category = RuleCategory.Comment;
        node.syntax = AdblockSyntax.Common;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case MetadataCommentRuleSerializationMap.Marker:
                    ValueParser.deserialize(buffer, node.marker = {} as Value);
                    break;

                case MetadataCommentRuleSerializationMap.Header:
                    ValueParser.deserialize(buffer, node.header = {} as Value, FREQUENT_HEADERS_DESERIALIZATION_MAP);
                    break;

                case MetadataCommentRuleSerializationMap.Value:
                    ValueParser.deserialize(buffer, node.value = {} as Value);
                    break;

                case MetadataCommentRuleSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case MetadataCommentRuleSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
