/* eslint-disable no-param-reassign */
import {
    CLOSE_SQUARE_BRACKET,
    NULL,
    OPEN_SQUARE_BRACKET,
    SEMICOLON,
    SPACE,
    UINT8_MAX,
} from '../../utils/constants';
import { StringUtils } from '../../utils/string';
import {
    type AgentCommentRule,
    CommentRuleType,
    RuleCategory,
    BinaryTypeMap,
    type Agent,
} from '../common';
import { AgentParser } from './agent';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { AdblockSyntax } from '../../utils/adblockers';
import { CosmeticRuleSeparatorUtils } from '../../utils/cosmetic-rule-separator';
import { ParserBase } from '../interface';
import { defaultParserOptions } from '../options';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { isNull, isUndefined } from '../../utils/type-guards';
import { BINARY_SCHEMA_VERSION } from '../../utils/binary-schema-version';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const enum AgentRuleSerializationMap {
    Children = 1,
    Start,
    End,
}

/**
 * `AgentParser` is responsible for parsing an Adblock agent rules.
 * Adblock agent comment marks that the filter list is supposed to
 * be used by the specified ad blockers.
 *
 * @example
 *  - ```adblock
 *    [AdGuard]
 *    ```
 *  - ```adblock
 *    [Adblock Plus 2.0]
 *    ```
 *  - ```adblock
 *    [uBlock Origin]
 *    ```
 *  - ```adblock
 *    [uBlock Origin 1.45.3]
 *    ```
 *  - ```adblock
 *    [Adblock Plus 2.0; AdGuard]
 *    ```
 */
export class AgentCommentRuleParser extends ParserBase {
    /**
     * Checks if the raw rule is an adblock agent comment.
     *
     * @param raw Raw rule
     * @returns `true` if the rule is an adblock agent, `false` otherwise
     */
    public static isAgentRule(raw: string): boolean {
        const rawTrimmed = raw.trim();

        if (rawTrimmed.startsWith(OPEN_SQUARE_BRACKET) && rawTrimmed.endsWith(CLOSE_SQUARE_BRACKET)) {
            // Avoid this case: [$adg-modifier]##[class^="adg-"]
            return isNull(CosmeticRuleSeparatorUtils.find(rawTrimmed));
        }

        return false;
    }

    /**
     * Parses a raw rule as an adblock agent comment.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @returns Agent rule AST or null (if the raw rule cannot be parsed as an adblock agent comment)
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): AgentCommentRule | null {
        // Ignore non-agent rules
        if (!AgentCommentRuleParser.isAgentRule(raw)) {
            return null;
        }

        let offset = 0;

        // Skip whitespace characters before the rule
        offset = StringUtils.skipWS(raw, offset);

        // Skip opening bracket
        offset += 1;

        // last character should be a closing bracket
        const closingBracketIndex = StringUtils.skipWSBack(raw, raw.length - 1);

        if (closingBracketIndex === -1 || raw[closingBracketIndex] !== CLOSE_SQUARE_BRACKET) {
            throw new AdblockSyntaxError(
                'Missing closing bracket',
                offset,
                offset + raw.length,
            );
        }

        // Initialize the agent list
        const result: AgentCommentRule = {
            type: CommentRuleType.AgentCommentRule,
            syntax: AdblockSyntax.Common,
            category: RuleCategory.Comment,
            children: [],
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

        while (offset < closingBracketIndex) {
            // Skip whitespace characters before the agent
            offset = StringUtils.skipWS(raw, offset);

            // Find the separator or the closing bracket
            let separatorIndex = raw.indexOf(SEMICOLON, offset);

            if (separatorIndex === -1) {
                separatorIndex = closingBracketIndex;
            }

            // Find the last non-whitespace character of the agent
            // [AdGuard  ; Adblock Plus 2.0]
            //        ^
            // (if we have spaces between the agent name and the separator)
            const agentEndIndex = StringUtils.findLastNonWhitespaceCharacter(
                raw.slice(offset, separatorIndex),
            ) + offset + 1;

            // Collect the agent
            result.children.push(
                AgentParser.parse(raw.slice(offset, agentEndIndex), options, baseOffset + offset),
            );

            // Set the offset to the next agent or the end of the rule
            offset = separatorIndex + 1;
        }

        if (result.children.length === 0) {
            throw new AdblockSyntaxError(
                'Empty agent list',
                baseOffset,
                baseOffset + raw.length,
            );
        }

        return result;
    }

    /**
     * Converts an adblock agent AST to a string.
     *
     * @param ast Agent rule AST
     * @returns Raw string
     */
    public static generate(ast: AgentCommentRule): string {
        let result = OPEN_SQUARE_BRACKET;

        result += ast.children
            .map(AgentParser.generate)
            .join(SEMICOLON + SPACE);

        result += CLOSE_SQUARE_BRACKET;

        return result;
    }

    /**
     * Serializes an adblock agent list node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    // TODO: add support for raws, if ever needed
    public static serialize(node: AgentCommentRule, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.AgentRuleNode);

        const count = node.children.length;
        if (count) {
            buffer.writeUint8(AgentRuleSerializationMap.Children);

            // note: we store the count, because re-construction of the array is faster if we know the length
            // 8 bits is more than enough here
            if (count > UINT8_MAX) {
                throw new Error(`Too many children: ${count}, the limit is ${UINT8_MAX}`);
            }
            buffer.writeUint8(count);

            for (let i = 0; i < count; i += 1) {
                AgentParser.serialize(node.children[i], buffer);
            }
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(AgentRuleSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(AgentRuleSerializationMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }

    /**
     * Deserializes an agent list node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<AgentCommentRule>): void {
        buffer.assertUint8(BinaryTypeMap.AgentRuleNode);

        node.type = CommentRuleType.AgentCommentRule;
        node.syntax = AdblockSyntax.Common;
        node.category = RuleCategory.Comment;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case AgentRuleSerializationMap.Children:
                    node.children = new Array(buffer.readUint8());

                    // read children
                    for (let i = 0; i < node.children.length; i += 1) {
                        AgentParser.deserialize(buffer, node.children[i] = {} as Agent);
                    }
                    break;

                case AgentRuleSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case AgentRuleSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
