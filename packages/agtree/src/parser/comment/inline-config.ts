/* eslint-disable no-param-reassign */
/**
 * @file AGLint configuration comments. Inspired by ESLint inline configuration comments.
 * @see {@link https://eslint.org/docs/latest/user-guide/configuring/rules#using-configuration-comments}
 */

import JSON5 from 'json5';

import { AdblockSyntax } from '../../utils/adblockers';
import {
    AGLINT_COMMAND_PREFIX,
    AGLINT_CONFIG_COMMENT_MARKER,
    COMMA,
    NULL,
} from '../../utils/constants';
import {
    CommentMarker,
    CommentRuleType,
    type ConfigCommentRule,
    type ParameterList,
    RuleCategory,
    type Value,
    BinaryTypeMap,
    type ConfigNode,
} from '../../nodes';
import { StringUtils } from '../../utils/string';
import { ParameterListParser } from '../misc/parameter-list';
import { defaultParserOptions } from '../options';
import { BaseParser } from '../interface';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { ValueParser } from '../misc/value';
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
const enum ConfigCommentRuleSerializationMap {
    Marker = 1,
    Command,
    Params,
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
const enum ConfigNodeSerializationMap {
    Value = 1,
    Start,
    End,
}

/**
 * Value map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 *
 * @see {@link https://github.com/AdguardTeam/AGLint/blob/master/src/linter/inline-config.ts}
 */
const FREQUENT_COMMANDS_SERIALIZATION_MAP = new Map<string, number>([
    ['aglint', 0],
    ['aglint-disable', 1],
    ['aglint-enable', 2],
    ['aglint-disable-next-line', 3],
    ['aglint-enable-next-line', 4],
]);

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
// FIXME
const FREQUENT_COMMANDS_DESERIALIZATION_MAP = new Map<number, string>(
    Array.from(FREQUENT_COMMANDS_SERIALIZATION_MAP).map(([key, value]) => [value, key]),
);

/**
 * `ConfigCommentParser` is responsible for parsing inline AGLint configuration rules.
 * Generally, the idea is inspired by ESLint inline configuration comments.
 *
 * @see {@link https://eslint.org/docs/latest/user-guide/configuring/rules#using-configuration-comments}
 */
export class ConfigCommentParser extends BaseParser {
    /**
     * Checks if the raw rule is an inline configuration comment rule.
     *
     * @param raw Raw rule
     * @returns `true` if the rule is an inline configuration comment rule, otherwise `false`.
     */
    public static isConfigComment(raw: string): boolean {
        const trimmed = raw.trim();

        if (trimmed[0] === CommentMarker.Regular || trimmed[0] === CommentMarker.Hashmark) {
            // Skip comment marker and trim comment text (it is necessary because of "!     something")
            const text = raw.slice(1).trim();

            // The code below is "not pretty", but it runs fast, which is necessary, since it will run on EVERY comment
            // The essence of the indicator is that the control comment always starts with the "aglint" prefix
            return (
                (text[0] === 'a' || text[0] === 'A')
                && (text[1] === 'g' || text[1] === 'G')
                && (text[2] === 'l' || text[2] === 'L')
                && (text[3] === 'i' || text[3] === 'I')
                && (text[4] === 'n' || text[4] === 'N')
                && (text[5] === 't' || text[5] === 'T')
            );
        }

        return false;
    }

    /**
     * Parses a raw rule as an inline configuration comment.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @returns
     * Inline configuration comment AST or null (if the raw rule cannot be parsed as configuration comment)
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): ConfigCommentRule | null {
        if (!ConfigCommentParser.isConfigComment(raw)) {
            return null;
        }

        let offset = 0;

        // Skip leading whitespace (if any)
        offset = StringUtils.skipWS(raw, offset);

        // Get comment marker
        const marker = ValueParser.parse(raw[offset], options, baseOffset + offset);

        // Skip marker
        offset += 1;

        // Skip whitespace (if any)
        offset = StringUtils.skipWS(raw, offset);

        // Save the command start position
        const commandStart = offset;

        // Get comment text, for example: "aglint-disable-next-line"
        offset = StringUtils.findNextWhitespaceCharacter(raw, offset);

        const command = ValueParser.parse(raw.slice(commandStart, offset), options, baseOffset + commandStart);

        // Skip whitespace after command
        offset = StringUtils.skipWS(raw, offset);

        // Get comment (if any)
        const commentStart = raw.indexOf(AGLINT_CONFIG_COMMENT_MARKER, offset);
        const commentEnd = commentStart !== -1 ? StringUtils.skipWSBack(raw) + 1 : -1;

        let comment: Value | undefined;

        // Check if there is a comment
        if (commentStart !== -1) {
            comment = ValueParser.parse(raw.slice(commentStart, commentEnd), options, baseOffset + commentStart);
        }

        // Get parameter
        const paramsStart = offset;
        const paramsEnd = commentStart !== -1
            ? StringUtils.skipWSBack(raw, commentStart - 1) + 1
            : StringUtils.skipWSBack(raw) + 1;

        let params: ConfigNode | ParameterList | undefined;

        // `! aglint ...` config comment
        if (command.value === AGLINT_COMMAND_PREFIX) {
            params = {
                type: 'ConfigNode',
                // It is necessary to use JSON5.parse instead of JSON.parse because JSON5 allows unquoted keys.
                // But don't forget to add { } to the beginning and end of the string,
                // otherwise JSON5 will not be able to parse it.
                // TODO: Better solution? ESLint uses "levn" package for parsing these comments.
                value: JSON5.parse(`{${raw.slice(paramsStart, paramsEnd)}}`),
            };

            if (options.isLocIncluded) {
                params.start = paramsStart;
                params.end = paramsEnd;
            }

            // Throw error for empty config
            if (Object.keys(params.value).length === 0) {
                throw new Error('Empty AGLint config');
            }
        } else if (paramsStart < paramsEnd) {
            params = ParameterListParser.parse(
                raw.slice(paramsStart, paramsEnd),
                options,
                baseOffset + paramsStart,
                COMMA,
            );
        }

        const result: ConfigCommentRule = {
            type: CommentRuleType.ConfigCommentRule,
            category: RuleCategory.Comment,
            syntax: AdblockSyntax.Common,
            marker,
            command,
            params,
            comment,
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
     * Serializes a config node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    private static serializeConfigNode(node: ConfigNode, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.ConfigNode);

        buffer.writeUint8(ConfigNodeSerializationMap.Value);
        // note: we don't support serializing generic objects, only AGTree nodes
        // this is a very special case, so we just stringify the configuration object
        buffer.writeString(JSON.stringify(node.value));

        if (!isUndefined(node.start)) {
            buffer.writeUint8(ConfigNodeSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(ConfigNodeSerializationMap.End);
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
    private static deserializeConfigNode(buffer: InputByteBuffer, node: Partial<ConfigNode>): void {
        buffer.assertUint8(BinaryTypeMap.ConfigNode);

        node.type = 'ConfigNode';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case ConfigNodeSerializationMap.Value:
                    // note: it is safe to use JSON.parse here, because we serialized it with JSON.stringify
                    node.value = JSON.parse(buffer.readString());
                    break;

                case ConfigNodeSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case ConfigNodeSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}.`);
            }

            prop = buffer.readUint8();
        }
    }

    /**
     * Deserializes a metadata comment node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<ConfigCommentRule>): void {
        buffer.assertUint8(BinaryTypeMap.ConfigCommentRuleNode);

        node.type = CommentRuleType.ConfigCommentRule;
        node.category = RuleCategory.Comment;
        node.syntax = AdblockSyntax.Common;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case ConfigCommentRuleSerializationMap.Marker:
                    ValueParser.deserialize(buffer, node.marker = {} as Value);
                    break;

                case ConfigCommentRuleSerializationMap.Command:
                    ValueParser.deserialize(buffer, node.command = {} as Value, FREQUENT_COMMANDS_DESERIALIZATION_MAP);
                    break;

                case ConfigCommentRuleSerializationMap.Params:
                    if (buffer.peekUint8() === BinaryTypeMap.ConfigNode) {
                        ConfigCommentParser.deserializeConfigNode(buffer, node.params = {} as ConfigNode);
                    } else {
                        ParameterListParser.deserialize(buffer, node.params = {} as ParameterList);
                    }
                    break;

                case ConfigCommentRuleSerializationMap.Comment:
                    ValueParser.deserialize(buffer, node.comment = {} as Value);
                    break;

                case ConfigCommentRuleSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case ConfigCommentRuleSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
