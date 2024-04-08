/* eslint-disable no-param-reassign */
import { AdblockSyntax } from '../../utils/adblockers';
import { EMPTY, NULL } from '../../utils/constants';
import { CosmeticRuleSeparatorUtils } from '../../utils/cosmetic-rule-separator';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { StringUtils } from '../../utils/string';
import { isUndefined } from '../../utils/type-guards';
import {
    BinaryTypeMap,
    CommentMarker,
    type CommentRule,
    CommentRuleType,
    RuleCategory,
    type Value,
} from '../common';
import { ParserBase } from '../interface';
import { ValueParser } from '../misc/value';
import { defaultParserOptions } from '../options';
import { BINARY_SCHEMA_VERSION } from '../../utils/binary-schema-version';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const enum SimpleCommentRuleSerializationMap {
    Marker = 1,
    Text,
    Start,
    End,
}

/**
 * `SimpleCommentParser` is responsible for parsing simple comments.
 * Some comments have a special meaning in adblock syntax, like agent comments or hints,
 * but this parser is only responsible for parsing regular comments,
 * whose only purpose is to provide some human-readable information.
 *
 * @example
 * ```adblock
 * ! This is a simple comment
 * # This is a simple comment, but in host-like syntax
 * ```
 */
export class SimpleCommentParser extends ParserBase {
    /**
     * Checks if the raw rule is a simple comment.
     *
     * @param raw Raw input to check.
     * @returns `true` if the input is a simple comment, `false` otherwise.
     * @note This method does not check for adblock agent comments.
     */
    public static isSimpleComment(raw: string): boolean {
        const trimmed = raw.trim();

        // Exclamation mark based comments
        if (trimmed.startsWith(CommentMarker.Regular)) {
            return true;
        }

        // Hashmark based comments
        // Note: in this case, we must be sure that we do not mistakenly parse a cosmetic rule as a #-like comment,
        // since most cosmetic rule separators also start with #
        if (trimmed.startsWith(CommentMarker.Hashmark)) {
            const result = CosmeticRuleSeparatorUtils.find(trimmed);

            // If we cannot find a separator, it means that the rule is definitely a comment
            if (result === null) {
                return true;
            }

            // Otherwise, we must check if the separator is followed by a valid selector
            const { end } = result;

            // No valid selector
            if (
                !trimmed[end + 1]
                || StringUtils.isWhitespace(trimmed[end + 1])
                || (trimmed[end + 1] === CommentMarker.Hashmark && trimmed[end + 2] === CommentMarker.Hashmark)
            ) {
                return true;
            }
        }

        return false;
    }

    /**
     * Parses a raw rule as a simple comment.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @returns Comment rule node or null (if the raw rule cannot be parsed as a simple comment).
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): CommentRule | null {
        // Ignore non-comment rules
        if (!this.isSimpleComment(raw)) {
            return null;
        }

        // If we are here, it means that the rule is a regular comment
        let offset = 0;

        // Skip leading whitespace (if any)
        offset = StringUtils.skipWS(raw, offset);

        // Get comment marker
        const marker = ValueParser.parse(raw[offset], options, baseOffset + offset);

        // Skip marker
        offset += 1;

        // Get comment text
        const text = ValueParser.parse(raw.slice(offset), options, baseOffset + offset);

        // Regular comment rule
        const result: CommentRule = {
            category: RuleCategory.Comment,
            type: CommentRuleType.CommentRule,
            // TODO: Change syntax when hashmark is used
            syntax: AdblockSyntax.Common,
            marker,
            text,
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

    /**
     * Converts a comment rule node to a string.
     *
     * @param node Comment rule node.
     * @returns Raw string.
     */
    public static generate(node: CommentRule): string {
        let result = EMPTY;

        result += ValueParser.generate(node.marker);
        result += ValueParser.generate(node.text);

        return result;
    }

    /**
     * Serializes a simple comment rule node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    // TODO: add support for raws, if ever needed
    public static serialize(node: CommentRule, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.CommentRuleNode);

        buffer.writeUint8(SimpleCommentRuleSerializationMap.Marker);
        ValueParser.serialize(node.marker, buffer);

        buffer.writeUint8(SimpleCommentRuleSerializationMap.Text);
        ValueParser.serialize(node.text, buffer);

        if (!isUndefined(node.start)) {
            buffer.writeUint8(SimpleCommentRuleSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(SimpleCommentRuleSerializationMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }

    /**
     * Deserializes a simple comment node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<CommentRule>): void {
        buffer.assertUint8(BinaryTypeMap.CommentRuleNode);

        node.type = CommentRuleType.CommentRule;
        node.category = RuleCategory.Comment;
        node.syntax = AdblockSyntax.Common;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case SimpleCommentRuleSerializationMap.Marker:
                    ValueParser.deserialize(buffer, (node as CommentRule).marker = {} as Value);
                    break;

                case SimpleCommentRuleSerializationMap.Text:
                    ValueParser.deserialize(buffer, (node as CommentRule).text = {} as Value);
                    break;

                case SimpleCommentRuleSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case SimpleCommentRuleSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
