/* eslint-disable no-param-reassign */
import { AdblockSyntax } from '../../utils/adblockers';
import { AgentCommentRuleParser } from './agent-rule';
import {
    type AnyCommentRule,
    CommentMarker,
    CommentRuleType,
    RuleCategory,
    type Value,
    BinaryTypeMap,
    type AgentCommentRule,
    type HintCommentRule,
    type PreProcessorCommentRule,
    type MetadataCommentRule,
    type ConfigCommentRule,
    type CommentRule,
} from '../common';
import { ConfigCommentRuleParser } from './inline-config';
import { CosmeticRuleSeparatorUtils } from '../../utils/cosmetic-rule-separator';
import { HintCommentRuleParser } from './hint-rule';
import { MetadataCommentRuleParser } from './metadata';
import { PreProcessorCommentRuleParser } from './preprocessor';
import { EMPTY, NULL } from '../../utils/constants';
import { StringUtils } from '../../utils/string';
import { defaultParserOptions } from '../options';
import { ParserBase } from '../interface';
import { ValueParser } from '../misc/value';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { isUndefined } from '../../utils/type-guards';

/**
 * Property map for binary serialization.
 */
const enum BinaryPropMap {
    Marker = 1,
    Text,
    Start,
    End,
}

/**
 * `CommentParser` is responsible for parsing any comment-like adblock rules.
 *
 * @example
 * Example rules:
 *  - Adblock agent rules:
 *      - ```adblock
 *        [AdGuard]
 *        ```
 *      - ```adblock
 *        [Adblock Plus 2.0]
 *        ```
 *      - etc.
 *  - AdGuard hint rules:
 *      - ```adblock
 *        !+ NOT_OPTIMIZED
 *        ```
 *      - ```adblock
 *        !+ NOT_OPTIMIZED PLATFORM(windows)
 *        ```
 *      - etc.
 *  - Pre-processor rules:
 *      - ```adblock
 *        !#if (adguard)
 *        ```
 *      - ```adblock
 *        !#endif
 *        ```
 *      - etc.
 *  - Metadata rules:
 *      - ```adblock
 *        ! Title: My List
 *        ```
 *      - ```adblock
 *        ! Version: 2.0.150
 *        ```
 *      - etc.
 *  - AGLint inline config rules:
 *      - ```adblock
 *        ! aglint-enable some-rule
 *        ```
 *      - ```adblock
 *        ! aglint-disable some-rule
 *        ```
 *      - etc.
 *  - Simple comments:
 *      - Regular version:
 *        ```adblock
 *        ! This is just a comment
 *        ```
 *      - uBlock Origin / "hostlist" version:
 *        ```adblock
 *        # This is just a comment
 *        ```
 *      - etc.
 */
export class CommentRuleParser extends ParserBase {
    /**
     * Checks whether a rule is a regular comment. Regular comments are the ones that start with
     * an exclamation mark (`!`).
     *
     * @param raw Raw rule
     * @returns `true` if the rule is a regular comment, `false` otherwise
     */
    public static isRegularComment(raw: string): boolean {
        // Source may start with a whitespace, so we need to trim it first
        return raw.trim().startsWith(CommentMarker.Regular);
    }

    /**
     * Checks whether a rule is a comment.
     *
     * @param raw Raw rule
     * @returns `true` if the rule is a comment, `false` otherwise
     */
    public static isCommentRule(raw: string): boolean {
        const trimmed = raw.trim();

        // Regular comments
        if (CommentRuleParser.isRegularComment(trimmed)) {
            return true;
        }

        // Hashmark based comments
        if (trimmed.startsWith(CommentMarker.Hashmark)) {
            const result = CosmeticRuleSeparatorUtils.find(trimmed);

            // No separator
            if (result === null) {
                return true;
            }

            // Separator end index
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

        // Adblock agent comment rules
        return AgentCommentRuleParser.isAgentRule(trimmed);
    }

    /**
     * Parses a raw rule as comment.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @returns Comment AST or null (if the raw rule cannot be parsed as comment)
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): AnyCommentRule | null {
        // Ignore non-comment rules
        if (!CommentRuleParser.isCommentRule(raw)) {
            return null;
        }

        // First, try to parse as non-regular comment
        const nonRegular = AgentCommentRuleParser.parse(raw, options, baseOffset)
            || HintCommentRuleParser.parse(raw, options, baseOffset)
            || PreProcessorCommentRuleParser.parse(raw, options, baseOffset)
            || MetadataCommentRuleParser.parse(raw, options, baseOffset)
            || ConfigCommentRuleParser.parse(raw, options, baseOffset);

        if (nonRegular) {
            return nonRegular;
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
        const result: AnyCommentRule = {
            category: RuleCategory.Comment,
            type: CommentRuleType.CommentRule,
            // TODO: Change syntax when hashmark is used?
            syntax: AdblockSyntax.Common,
            marker,
            text,
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

    /**
     * Converts a comment rule node to a string.
     *
     * @param node Comment rule node
     * @returns Raw string
     */
    public static generate(node: AnyCommentRule): string {
        let result = EMPTY;

        // Generate based on the rule type
        switch (node.type) {
            case CommentRuleType.AgentCommentRule:
                return AgentCommentRuleParser.generate(node);

            case CommentRuleType.HintCommentRule:
                return HintCommentRuleParser.generate(node);

            case CommentRuleType.PreProcessorCommentRule:
                return PreProcessorCommentRuleParser.generate(node);

            case CommentRuleType.MetadataCommentRule:
                return MetadataCommentRuleParser.generate(node);

            case CommentRuleType.ConfigCommentRule:
                return ConfigCommentRuleParser.generate(node);

            // Regular comment rule
            case CommentRuleType.CommentRule:
                result += node.marker.value;
                result += node.text.value;
                return result;

            default:
                throw new Error('Unknown comment rule type');
        }
    }

    /**
     * Serializes a comment rule node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: AnyCommentRule, buffer: OutputByteBuffer): void {
        switch (node.type) {
            case CommentRuleType.AgentCommentRule:
                AgentCommentRuleParser.serialize(node, buffer);
                return;

            case CommentRuleType.HintCommentRule:
                HintCommentRuleParser.serialize(node, buffer);
                return;

            case CommentRuleType.PreProcessorCommentRule:
                PreProcessorCommentRuleParser.serialize(node, buffer);
                return;

            case CommentRuleType.MetadataCommentRule:
                MetadataCommentRuleParser.serialize(node, buffer);
                return;

            case CommentRuleType.ConfigCommentRule:
                ConfigCommentRuleParser.serialize(node, buffer);
                return;

            // Regular comment rule
            case CommentRuleType.CommentRule:
                buffer.writeUint8(BinaryTypeMap.CommentRuleNode);

                buffer.writeUint8(BinaryPropMap.Marker);
                ValueParser.serialize(node.marker, buffer);

                buffer.writeUint8(BinaryPropMap.Text);
                ValueParser.serialize(node.text, buffer);

                if (!isUndefined(node.start)) {
                    buffer.writeUint8(BinaryPropMap.Start);
                    buffer.writeUint32(node.start);
                }

                if (!isUndefined(node.end)) {
                    buffer.writeUint8(BinaryPropMap.End);
                    buffer.writeUint32(node.end);
                }

                buffer.writeUint8(NULL);
                break;

            default:
                throw new Error('Unknown comment rule type');
        }
    }

    /**
     * Deserializes a metadata comment node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<AnyCommentRule>): void {
        const type = buffer.peekUint8();

        switch (type) {
            case BinaryTypeMap.AgentRuleNode:
                AgentCommentRuleParser.deserialize(buffer, node as Partial<AgentCommentRule>);
                return;

            case BinaryTypeMap.HintRuleNode:
                HintCommentRuleParser.deserialize(buffer, node as Partial<HintCommentRule>);
                return;

            case BinaryTypeMap.PreProcessorCommentRuleNode:
                PreProcessorCommentRuleParser.deserialize(buffer, node as Partial<PreProcessorCommentRule>);
                return;

            case BinaryTypeMap.MetadataCommentRuleNode:
                MetadataCommentRuleParser.deserialize(buffer, node as Partial<MetadataCommentRule>);
                return;

            case BinaryTypeMap.ConfigCommentRuleNode:
                ConfigCommentRuleParser.deserialize(buffer, node as Partial<ConfigCommentRule>);
                return;

            case BinaryTypeMap.CommentRuleNode:
                buffer.assertUint8(BinaryTypeMap.CommentRuleNode);

                node.type = CommentRuleType.CommentRule;
                node.category = RuleCategory.Comment;
                node.syntax = AdblockSyntax.Common;

                // eslint-disable-next-line no-case-declarations
                let prop = buffer.readUint8();
                while (prop !== NULL) {
                    switch (prop) {
                        case BinaryPropMap.Marker:
                            ValueParser.deserialize(buffer, (node as CommentRule).marker = {} as Value);
                            break;

                        case BinaryPropMap.Text:
                            ValueParser.deserialize(buffer, (node as CommentRule).text = {} as Value);
                            break;

                        case BinaryPropMap.Start:
                            node.start = buffer.readUint32();
                            break;

                        case BinaryPropMap.End:
                            node.end = buffer.readUint32();
                            break;

                        default:
                            throw new Error(`Invalid property: ${prop}`);
                    }
                    prop = buffer.readUint8();
                }
                return;

            default:
                throw new Error(`Unknown comment rule type: ${type}.`);
        }
    }
}
