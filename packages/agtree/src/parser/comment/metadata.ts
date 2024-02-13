/* eslint-disable no-param-reassign */
/**
 * @file Metadata comments
 */

import { StringUtils } from '../../utils/string';
import { METADATA_HEADERS } from '../../converter/data/metadata';
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
} from '../common';
import { defaultParserOptions } from '../options';
import { ParserBase } from '../interface';
import { ValueParser } from '../misc/value';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { isUndefined } from '../../utils/type-guards';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';

/**
 * Property map for binary serialization.
 */
const enum BinaryPropMap {
    Marker = 1,
    Header,
    Value,
    Start,
    End,
}

// FIXME: add map for known metadata headers

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

        for (let i = 0; i < METADATA_HEADERS.length; i += 1) {
            // Check if the comment text starts with the header (case-insensitive)
            if (text.toLocaleLowerCase().startsWith(METADATA_HEADERS[i].toLocaleLowerCase())) {
                // Skip the header
                offset += METADATA_HEADERS[i].length;

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

                if (options.parseRaws) {
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
     * Converts a metadata comment AST to a string.
     *
     * @param ast - Metadata comment AST
     * @returns Raw string
     */
    public static generate(ast: MetadataCommentRule): string {
        let result = EMPTY;

        result += ast.marker.value;
        result += SPACE;
        result += ast.header.value;
        result += COLON;
        result += SPACE;
        result += ast.value.value;

        return result;
    }

    /**
     * Serializes a metadata comment node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: MetadataCommentRule, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.MetadataCommentRuleNode);

        buffer.writeUint8(BinaryPropMap.Marker);
        ValueParser.serialize(node.marker, buffer);

        buffer.writeUint8(BinaryPropMap.Header);
        ValueParser.serialize(node.header, buffer);

        buffer.writeUint8(BinaryPropMap.Value);
        ValueParser.serialize(node.value, buffer);

        if (!isUndefined(node.start)) {
            buffer.writeUint8(BinaryPropMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(BinaryPropMap.End);
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

        // read buffer until NULL
        let prop = buffer.readUint8();
        while (prop) {
            switch (prop) {
                case BinaryPropMap.Marker:
                    ValueParser.deserialize(buffer, node.marker = {} as Value);
                    break;
                case BinaryPropMap.Header:
                    ValueParser.deserialize(buffer, node.header = {} as Value);
                    break;
                case BinaryPropMap.Value:
                    ValueParser.deserialize(buffer, node.value = {} as Value);
                    break;
                case BinaryPropMap.Start:
                    node.start = buffer.readUint32();
                    break;
                case BinaryPropMap.End:
                    node.end = buffer.readUint32();
                    break;
                default:
                    throw new Error(`Invalid property: ${prop}.`);
            }
            prop = buffer.readUint8();
        }
    }
}
