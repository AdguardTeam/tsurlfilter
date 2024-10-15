/* eslint-disable no-param-reassign */
/**
 * Pre-processor directives
 *
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#pre-processor-directives}
 * @see {@link https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#pre-parsing-directives}
 */

import { AdblockSyntax } from '../../utils/adblockers';
import {
    CLOSE_PARENTHESIS,
    COMMA,
    EMPTY,
    HASHMARK,
    IF,
    INCLUDE,
    NULL,
    OPEN_PARENTHESIS,
    PREPROCESSOR_MARKER,
    PREPROCESSOR_MARKER_LEN,
    PREPROCESSOR_SEPARATOR,
    SAFARI_CB_AFFINITY,
    SPACE,
} from '../../utils/constants';
import { StringUtils } from '../../utils/string';
import type {
    AnyExpressionNode,
    ParameterList,
    PreProcessorCommentRule,
    Value,
} from '../../nodes';
import {
    BinaryTypeMap,
    CommentRuleType,
    RuleCategory,
    getSyntaxSerializationMap,
    getSyntaxDeserializationMap,
} from '../../nodes';
import { LogicalExpressionParser } from '../misc/logical-expression';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { ParameterListParser } from '../misc/parameter-list';
import { defaultParserOptions } from '../options';
import { ParserBase } from '../interface';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
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
const enum PreProcessorRuleSerializationMap {
    Name = 1,
    Params,
    Syntax,
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
 * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#preprocessor-directives}
 * @see {@link https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#pre-parsing-directives}
 */
const FREQUENT_DIRECTIVES_SERIALIZATION_MAP = new Map<string, number>([
    ['if', 0],
    ['else', 1],
    ['endif', 2],
    ['include', 3],
    ['safari_cb_affinity', 4],
]);

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
// FIXME
const FREQUENT_DIRECTIVES_DESERIALIZATION_MAP = new Map<number, string>(
    Array.from(FREQUENT_DIRECTIVES_SERIALIZATION_MAP).map(([key, value]) => [value, key]),
);

/**
 * Value map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const FREQUENT_PARAMS_SERIALIZATION_MAP = new Map<string, number>([
    // safari_cb_affinity parameters
    ['general', 0],
    ['privacy', 1],
    ['social', 2],
    ['security', 3],
    ['other', 4],
    ['custom', 5],
    ['all', 6],
]);

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
// FIXME
const FREQUENT_PARAMS_DESERIALIZATION_MAP = new Map<number, string>(
    Array.from(FREQUENT_PARAMS_SERIALIZATION_MAP).map(([key, value]) => [value, key]),
);

/**
 * `PreProcessorParser` is responsible for parsing preprocessor rules.
 * Pre-processor comments are special comments that are used to control the behavior of the filter list processor.
 * Please note that this parser only handles general syntax for now, and does not validate the parameters at
 * the parsing stage.
 *
 * @example
 * If your rule is
 * ```adblock
 * !#if (adguard)
 * ```
 * then the directive's name is `if` and its value is `(adguard)`, but the parameter list
 * is not parsed / validated further.
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#pre-processor-directives}
 * @see {@link https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#pre-parsing-directives}
 */
export class PreProcessorCommentRuleParser extends ParserBase {
    /**
     * Determines whether the rule is a pre-processor rule.
     *
     * @param raw Raw rule
     * @returns `true` if the rule is a pre-processor rule, `false` otherwise
     */
    public static isPreProcessorRule(raw: string): boolean {
        const trimmed = raw.trim();

        // Avoid this case: !##... (commonly used in AdGuard filters)
        return trimmed.startsWith(PREPROCESSOR_MARKER) && trimmed[PREPROCESSOR_MARKER_LEN] !== HASHMARK;
    }

    /**
     * Parses a raw rule as a pre-processor comment.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @returns
     * Pre-processor comment AST or null (if the raw rule cannot be parsed as a pre-processor comment)
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): PreProcessorCommentRule | null {
        // Ignore non-pre-processor rules
        if (!PreProcessorCommentRuleParser.isPreProcessorRule(raw)) {
            return null;
        }

        let offset = 0;

        // Ignore whitespace characters before the rule (if any)
        offset = StringUtils.skipWS(raw, offset);

        // Ignore the pre-processor marker
        offset += PREPROCESSOR_MARKER_LEN;

        // Ignore whitespace characters after the pre-processor marker (if any)
        // Note: this is incorrect according to the spec, but we do it for tolerance
        offset = StringUtils.skipWS(raw, offset);

        // Directive name should start at this offset, so we save this offset now
        const nameStart = offset;

        // Consume directive name, so parse the sequence until the first
        // whitespace / opening parenthesis / end of string
        while (offset < raw.length) {
            const ch = raw[offset];

            if (ch === PREPROCESSOR_SEPARATOR || ch === OPEN_PARENTHESIS) {
                break;
            }

            offset += 1;
        }

        // Save name end offset
        const nameEnd = offset;

        // Create name node
        const name = ValueParser.parse(raw.slice(nameStart, nameEnd), options, baseOffset + nameStart);

        // Ignore whitespace characters after the directive name (if any)
        // Note: this may incorrect according to the spec, but we do it for tolerance
        offset = StringUtils.skipWS(raw, offset);

        // If the directive name is "safari_cb_affinity", then we have a special case
        if (name.value === SAFARI_CB_AFFINITY) {
            // Throw error if there are spaces after the directive name
            if (offset > nameEnd) {
                throw new AdblockSyntaxError(
                    `Unexpected whitespace after "${SAFARI_CB_AFFINITY}" directive name`,
                    baseOffset + nameEnd,
                    baseOffset + offset,
                );
            }

            // safari_cb_affinity directive optionally accepts a parameter list
            // So at this point we should check if there are parameters or not
            // (cb_affinity directive followed by an opening parenthesis or if we
            // skip the whitespace we reach the end of the string)
            if (StringUtils.skipWS(raw, offset) !== raw.length) {
                if (raw[offset] !== OPEN_PARENTHESIS) {
                    throw new AdblockSyntaxError(
                        `Unexpected character '${raw[offset]}' after '${SAFARI_CB_AFFINITY}' directive name`,
                        baseOffset + offset,
                        baseOffset + offset + 1,
                    );
                }

                // If we have parameters, then we should parse them
                // Note: we don't validate the parameters at this stage

                // Ignore opening parenthesis
                offset += 1;

                // Save parameter list start offset
                const parameterListStart = offset;

                // Check for closing parenthesis
                const closingParenthesesIndex = StringUtils.skipWSBack(raw);

                if (closingParenthesesIndex === -1 || raw[closingParenthesesIndex] !== CLOSE_PARENTHESIS) {
                    throw new AdblockSyntaxError(
                        `Missing closing parenthesis for '${SAFARI_CB_AFFINITY}' directive`,
                        baseOffset + offset,
                        baseOffset + raw.length,
                    );
                }

                // Save parameter list end offset
                const parameterListEnd = closingParenthesesIndex;

                // Parse parameters between the opening and closing parentheses
                const result: PreProcessorCommentRule = {
                    type: CommentRuleType.PreProcessorCommentRule,
                    category: RuleCategory.Comment,
                    syntax: AdblockSyntax.Adg,
                    name,
                    // comma separated list of parameters
                    params: ParameterListParser.parse(
                        raw.slice(parameterListStart, parameterListEnd),
                        options,
                        baseOffset + parameterListStart,
                        COMMA,
                    ),
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

        // If we reached the end of the string, then we have a directive without parameters
        // (e.g. "!#safari_cb_affinity" or "!#endif")
        // No need to continue parsing in this case.
        if (offset === raw.length) {
            // Throw error if the directive name is "if" or "include", because these directives
            // should have parameters
            if (name.value === IF || name.value === INCLUDE) {
                throw new AdblockSyntaxError(
                    `Directive "${name.value}" requires parameters`,
                    baseOffset,
                    baseOffset + raw.length,
                );
            }

            const result: PreProcessorCommentRule = {
                type: CommentRuleType.PreProcessorCommentRule,
                category: RuleCategory.Comment,
                syntax: AdblockSyntax.Common,
                name,
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

        // Get start and end offsets of the directive parameters
        const paramsStart = offset;
        const paramsEnd = StringUtils.skipWSBack(raw) + 1;

        // Prepare parameters node
        let params: Value | AnyExpressionNode;

        // Parse parameters. Handle "if" and "safari_cb_affinity" directives
        // separately.
        if (name.value === IF) {
            params = LogicalExpressionParser.parse(
                raw.slice(paramsStart, paramsEnd),
                options,
                baseOffset + paramsStart,
            );
        } else {
            params = ValueParser.parse(raw.slice(paramsStart, paramsEnd), options, baseOffset + paramsStart);
        }

        const result: PreProcessorCommentRule = {
            type: CommentRuleType.PreProcessorCommentRule,
            category: RuleCategory.Comment,
            syntax: AdblockSyntax.Common,
            name,
            params,
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
     * Converts a pre-processor comment node to a string.
     *
     * @param node Pre-processor comment node
     * @returns Raw string
     */
    public static generate(node: PreProcessorCommentRule): string {
        let result = EMPTY;

        result += PREPROCESSOR_MARKER;
        result += node.name.value;

        if (node.params) {
            // Space is not allowed after "safari_cb_affinity" directive, so we need to handle it separately.
            if (node.name.value !== SAFARI_CB_AFFINITY) {
                result += SPACE;
            }

            if (node.params.type === 'Value') {
                result += ValueParser.generate(node.params);
            } else if (node.params.type === 'ParameterList') {
                result += OPEN_PARENTHESIS;
                result += ParameterListParser.generate(node.params);
                result += CLOSE_PARENTHESIS;
            } else {
                result += LogicalExpressionParser.generate(node.params);
            }
        }

        return result;
    }

    /**
     * Serializes a pre-processor comment node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    // TODO: add support for raws, if ever needed
    public static serialize(node: PreProcessorCommentRule, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.PreProcessorCommentRuleNode);

        buffer.writeUint8(PreProcessorRuleSerializationMap.Name);
        ValueParser.serialize(node.name, buffer, FREQUENT_DIRECTIVES_SERIALIZATION_MAP);

        buffer.writeUint8(PreProcessorRuleSerializationMap.Syntax);
        buffer.writeUint8(getSyntaxSerializationMap().get(node.syntax) ?? 0);

        if (!isUndefined(node.params)) {
            buffer.writeUint8(PreProcessorRuleSerializationMap.Params);

            if (node.params.type === 'Value') {
                ValueParser.serialize(node.params, buffer);
            } else if (node.params.type === 'ParameterList') {
                ParameterListParser.serialize(node.params, buffer, FREQUENT_PARAMS_SERIALIZATION_MAP, true);
            } else {
                LogicalExpressionParser.serialize(node.params, buffer);
            }
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(PreProcessorRuleSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(PreProcessorRuleSerializationMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }

    /**
     * Deserializes a pre-processor comment node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<PreProcessorCommentRule>): void {
        buffer.assertUint8(BinaryTypeMap.PreProcessorCommentRuleNode);

        node.type = CommentRuleType.PreProcessorCommentRule;
        node.category = RuleCategory.Comment;
        node.syntax = AdblockSyntax.Common;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case PreProcessorRuleSerializationMap.Name:
                    ValueParser.deserialize(buffer, node.name = {} as Value, FREQUENT_DIRECTIVES_DESERIALIZATION_MAP);
                    break;

                case PreProcessorRuleSerializationMap.Syntax:
                    node.syntax = getSyntaxDeserializationMap().get(buffer.readUint8()) ?? AdblockSyntax.Common;
                    break;

                case PreProcessorRuleSerializationMap.Params:
                    switch (buffer.peekUint8()) {
                        case BinaryTypeMap.ValueNode:
                            ValueParser.deserialize(buffer, node.params = {} as Value);
                            break;

                        case BinaryTypeMap.ParameterListNode:
                            // eslint-disable-next-line max-len
                            ParameterListParser.deserialize(buffer, node.params = {} as ParameterList, FREQUENT_PARAMS_DESERIALIZATION_MAP);
                            break;

                        case BinaryTypeMap.ExpressionOperatorNode:
                        case BinaryTypeMap.ExpressionParenthesisNode:
                        case BinaryTypeMap.ExpressionVariableNode:
                            LogicalExpressionParser.deserialize(buffer, node.params = {} as AnyExpressionNode);
                            break;

                        default:
                            throw new Error(`Invalid binary type: ${prop}`);
                    }
                    break;

                case PreProcessorRuleSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case PreProcessorRuleSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
