/* eslint-disable no-param-reassign */
import { AgentCommentParser } from './agent-rule';
import {
    type AnyCommentRule,
    CommentRuleType,
    BinaryTypeMap,
    type AgentCommentRule,
    type HintCommentRule,
    type PreProcessorCommentRule,
    type MetadataCommentRule,
    type ConfigCommentRule,
    type CommentRule,
} from '../../nodes';
import { ConfigCommentParser } from './inline-config';
import { HintCommentParser } from './hint-rule';
import { MetadataCommentRuleParser } from './metadata';
import { PreProcessorCommentParser } from './preprocessor';
import { defaultParserOptions } from '../options';
import { BaseParser } from '../interface';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { SimpleCommentParser } from './simple-comment';

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
export class CommentRuleParser extends BaseParser {
    /**
     * Checks whether a rule is a comment.
     *
     * @param raw Raw rule
     * @returns `true` if the rule is a comment, `false` otherwise
     */
    public static isCommentRule(raw: string): boolean {
        const trimmed = raw.trim();
        return SimpleCommentParser.isSimpleComment(trimmed) || AgentCommentParser.isAgentRule(trimmed);
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

        // Note: we parse non-functional comments at the end,
        // if the input does not match any of the previous, more specific comment patterns
        return AgentCommentParser.parse(raw, options, baseOffset)
            || HintCommentParser.parse(raw, options, baseOffset)
            || PreProcessorCommentParser.parse(raw, options, baseOffset)
            || MetadataCommentRuleParser.parse(raw, options, baseOffset)
            || ConfigCommentParser.parse(raw, options, baseOffset)
            || SimpleCommentParser.parse(raw, options, baseOffset);
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
                AgentCommentParser.serialize(node, buffer);
                return;

            case CommentRuleType.HintCommentRule:
                HintCommentParser.serialize(node, buffer);
                return;

            case CommentRuleType.PreProcessorCommentRule:
                PreProcessorCommentParser.serialize(node, buffer);
                return;

            case CommentRuleType.MetadataCommentRule:
                MetadataCommentRuleParser.serialize(node, buffer);
                return;

            case CommentRuleType.ConfigCommentRule:
                ConfigCommentParser.serialize(node, buffer);
                return;

            case CommentRuleType.CommentRule:
                SimpleCommentParser.serialize(node, buffer);
                break;

            default:
                throw new Error('Unknown comment rule type');
        }
    }

    /**
     * Deserializes a comment rule node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<AnyCommentRule>): void {
        const type = buffer.peekUint8();

        switch (type) {
            case BinaryTypeMap.AgentRuleNode:
                AgentCommentParser.deserialize(buffer, node as Partial<AgentCommentRule>);
                return;

            case BinaryTypeMap.HintRuleNode:
                HintCommentParser.deserialize(buffer, node as Partial<HintCommentRule>);
                return;

            case BinaryTypeMap.PreProcessorCommentRuleNode:
                PreProcessorCommentParser.deserialize(buffer, node as Partial<PreProcessorCommentRule>);
                return;

            case BinaryTypeMap.MetadataCommentRuleNode:
                MetadataCommentRuleParser.deserialize(buffer, node as Partial<MetadataCommentRule>);
                return;

            case BinaryTypeMap.ConfigCommentRuleNode:
                ConfigCommentParser.deserialize(buffer, node as Partial<ConfigCommentRule>);
                return;

            case BinaryTypeMap.CommentRuleNode:
                SimpleCommentParser.deserialize(buffer, node as Partial<CommentRule>);
                return;

            default:
                throw new Error(`Unknown comment rule type: ${type}`);
        }
    }
}
