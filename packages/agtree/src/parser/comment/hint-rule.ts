/* eslint-disable no-param-reassign */
import {
    BACKSLASH,
    CLOSE_PARENTHESIS,
    HINT_MARKER,
    HINT_MARKER_LEN,
    NULL,
    OPEN_PARENTHESIS,
    SPACE,
} from '../../utils/constants';
import { StringUtils } from '../../utils/string';
import {
    CommentRuleType,
    type Hint,
    type HintCommentRule,
    RuleCategory,
    BinaryTypeMap,
    SYNTAX_SERIALIZATION_MAP,
    SYNTAX_DESERIALIZATION_MAP,
} from '../common';
import { HintParser } from './hint';
import { AdblockSyntax } from '../../utils/adblockers';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { defaultParserOptions } from '../options';
import { ParserBase } from '../interface';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
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
const enum HintRuleSerializationMap {
    Syntax = 1,
    Children,
    Start,
    End,
}

/**
 * `HintRuleParser` is responsible for parsing AdGuard hint rules.
 *
 * @example
 * The following hint rule
 * ```adblock
 * !+ NOT_OPTIMIZED PLATFORM(windows)
 * ```
 * contains two hints: `NOT_OPTIMIZED` and `PLATFORM`.
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#hints}
 */
export class HintCommentRuleParser extends ParserBase {
    /**
     * Checks if the raw rule is a hint rule.
     *
     * @param raw Raw rule
     * @returns `true` if the rule is a hint rule, `false` otherwise
     */
    public static isHintRule(raw: string): boolean {
        return raw.trim().startsWith(HINT_MARKER);
    }

    /**
     * Parses a raw rule as a hint comment.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @returns Hint AST or null (if the raw rule cannot be parsed as a hint comment)
     * @throws If the input matches the HINT pattern but syntactically invalid
     * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#hints-1}
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): HintCommentRule | null {
        // Ignore non-hint rules
        if (!HintCommentRuleParser.isHintRule(raw)) {
            return null;
        }

        let offset = 0;

        // Skip whitespace characters before the rule
        offset = StringUtils.skipWS(raw);

        // Skip hint marker
        offset += HINT_MARKER_LEN;

        const hints: Hint[] = [];

        // Collect hints. Each hint is a string, optionally followed by a parameter list,
        // enclosed in parentheses. One rule can contain multiple hints.
        while (offset < raw.length) {
            // Split rule into raw hints (e.g. 'HINT_NAME' or 'HINT_NAME(PARAMS)')
            // Hints are separated by whitespace characters, but we should ignore
            // whitespace characters inside the parameter list

            // Ignore whitespace characters before the hint
            offset = StringUtils.skipWS(raw, offset);

            // Save the start index of the hint
            const hintStartIndex = offset;

            // Find the end of the hint
            let hintEndIndex = offset;
            let balance = 0;

            while (hintEndIndex < raw.length) {
                if (raw[hintEndIndex] === OPEN_PARENTHESIS && raw[hintEndIndex - 1] !== BACKSLASH) {
                    balance += 1;

                    // Throw error for nesting
                    if (balance > 1) {
                        throw new AdblockSyntaxError(
                            'Invalid hint: nested parentheses are not allowed',
                            baseOffset + hintStartIndex,
                            baseOffset + hintEndIndex,
                        );
                    }
                } else if (raw[hintEndIndex] === CLOSE_PARENTHESIS && raw[hintEndIndex - 1] !== BACKSLASH) {
                    balance -= 1;
                } else if (StringUtils.isWhitespace(raw[hintEndIndex]) && balance === 0) {
                    break;
                }

                hintEndIndex += 1;
            }

            offset = hintEndIndex;

            // Skip whitespace characters after the hint
            offset = StringUtils.skipWS(raw, offset);

            // Parse the hint
            const hint = HintParser.parse(
                raw.slice(hintStartIndex, hintEndIndex),
                options,
                baseOffset + hintStartIndex,
            );

            hints.push(hint);
        }

        // Throw error if no hints were found
        if (hints.length === 0) {
            throw new AdblockSyntaxError(
                'Empty hint rule',
                baseOffset,
                baseOffset + offset,
            );
        }

        const result: HintCommentRule = {
            type: CommentRuleType.HintCommentRule,
            category: RuleCategory.Comment,
            syntax: AdblockSyntax.Adg,
            children: hints,
        };

        if (options.includeRaws) {
            result.raws = {
                text: raw,
            };
        }

        if (options.isLocIncluded) {
            result.start = baseOffset;
            result.end = baseOffset + offset;
        }

        return result;
    }

    /**
     * Converts a hint rule node to a raw string.
     *
     * @param node Hint rule node
     * @returns Raw string
     */
    public static generate(node: HintCommentRule): string {
        let result = HINT_MARKER + SPACE;

        result += node.children.map(HintParser.generate).join(SPACE);

        return result;
    }

    /**
     * Serializes a hint rule node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    // TODO: add support for raws, if ever needed
    public static serialize(node: HintCommentRule, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.HintRuleNode);

        if (node.syntax === AdblockSyntax.Adg) {
            buffer.writeUint8(HintRuleSerializationMap.Syntax);
            buffer.writeUint8(SYNTAX_SERIALIZATION_MAP.get(AdblockSyntax.Adg) ?? 0);
        }

        const count = node.children.length;
        // If there are no children, we do not write any data related to them, to avoid using unnecessary storage,
        // but children is a required field, so during deserialization we should initialize it as an empty array,
        // if there are no children in the binary data.
        if (count) {
            buffer.writeUint8(HintRuleSerializationMap.Children);
            // note: we store the count, because re-construction of the array is faster if we know the length
            buffer.writeUint8(count);

            for (let i = 0; i < count; i += 1) {
                HintParser.serialize(node.children[i], buffer);
            }
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(HintRuleSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(HintRuleSerializationMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }

    /**
     * Deserializes a hint rule node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<HintCommentRule>): void {
        buffer.assertUint8(BinaryTypeMap.HintRuleNode);

        node.category = RuleCategory.Comment;
        node.type = CommentRuleType.HintCommentRule;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case HintRuleSerializationMap.Syntax:
                    node.syntax = SYNTAX_DESERIALIZATION_MAP.get(buffer.readUint8()) ?? AdblockSyntax.Common;
                    break;

                case HintRuleSerializationMap.Children:
                    node.children = new Array(buffer.readUint8());

                    // read children
                    for (let i = 0; i < node.children.length; i += 1) {
                        HintParser.deserialize(buffer, node.children[i] = {} as Hint);
                    }
                    break;

                case HintRuleSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case HintRuleSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
        // Maybe children are not present in the binary data,
        // in this case, we should initialize it as an empty array.
        if (!node.children) {
            node.children = [];
        }
    }
}
