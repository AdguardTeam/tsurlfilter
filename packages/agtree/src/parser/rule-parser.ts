/* eslint-disable no-param-reassign */
import { AdblockSyntax } from '../utils/adblockers';
import { NULL } from '../utils/constants';
import { CommentRuleParser } from './comment';
import { CosmeticRuleParser } from './cosmetic';
import { NetworkRuleParser } from './network';
import {
    type AnyRule,
    type InvalidRule,
    RuleCategory,
    type EmptyRule,
    BinaryTypeMap,
    type InvalidRuleError,
    type AnyCommentRule,
    type AnyCosmeticRule,
    type NetworkRule,
    type HostRule,
} from '../nodes';
import { AdblockSyntaxError } from '../errors/adblock-syntax-error';
import { defaultParserOptions } from './options';
import { BaseParser } from './interface';
import { type InputByteBuffer } from '../utils/input-byte-buffer';
import { HostRuleParser } from './network/host';
import { BINARY_SCHEMA_VERSION } from '../utils/binary-schema-version';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const enum EmptyRuleSerializationMap {
    Start = 1,
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
const enum InvalidRuleErrorNodeSerializationMap {
    Name = 1,
    Message,
    Start,
    End,
}

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the binary schema version.!
 *
 * @note Only 256 values can be represented this way.
 */
const enum InvalidRuleSerializationMap {
    Error = 1,
    Start,
    End,
}

/**
 * `RuleParser` is responsible for parsing the rules.
 *
 * It automatically determines the category and syntax of the rule, so you can pass any kind of rule to it.
 */
export class RuleParser extends BaseParser {
    /**
     * Helper method to parse host rules if the `parseHostRules` option is enabled, otherwise it will
     * parse network rules.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @returns Host rule or network rule node.
     */
    private static parseHostOrNetworkRule(
        raw: string,
        options: typeof defaultParserOptions,
        baseOffset: number,
    ): HostRule | NetworkRule {
        if (options.parseHostRules) {
            try {
                return HostRuleParser.parse(raw, options, baseOffset);
            } catch (error: unknown) {
                // Ignore the error, and fall back to network rule parser
            }
        }

        return NetworkRuleParser.parse(raw, options, baseOffset);
    }

    /**
     * Parse an adblock rule. You can pass any kind of rule to this method, since it will automatically determine
     * the category and syntax. If the rule is syntactically invalid, then an error will be thrown. If the
     * syntax / compatibility cannot be determined clearly, then the value of the `syntax` property will be
     * `Common`.
     *
     * For example, let's have this network rule:
     * ```adblock
     * ||example.org^$important
     * ```
     * The `syntax` property will be `Common`, since the rule is syntactically correct in every adblockers, but we
     * cannot determine at parsing level whether `important` is an existing option or not, nor if it exists, then
     * which adblocker supports it. This is why the `syntax` property is simply `Common` at this point.
     * The concrete COMPATIBILITY of the rule will be determined later, in a different, higher-level layer, called
     * "Compatibility table".
     *
     * But we can determinate the concrete syntax of this rule:
     * ```adblock
     * example.org#%#//scriptlet("scriptlet0", "arg0")
     * ```
     * since it is clearly an AdGuard-specific rule and no other adblockers uses this syntax natively. However, we also
     * cannot determine the COMPATIBILITY of this rule, as it is not clear at this point whether the `scriptlet0`
     * scriptlet is supported by AdGuard or not. This is also the task of the "Compatibility table". Here, we simply
     * mark the rule with the `AdGuard` syntax in this case.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @returns Adblock rule node
     * @throws If the input matches a pattern but syntactically invalid
     * @example
     * Take a look at the following example:
     * ```js
     * // Parse a network rule
     * const ast1 = RuleParser.parse("||example.org^$important");
     *
     * // Parse another network rule
     * const ast2 = RuleParser.parse("/ads.js^$important,third-party,domain=example.org|~example.com");
     *
     * // Parse a cosmetic rule
     * const ast2 = RuleParser.parse("example.org##.banner");
     *
     * // Parse another cosmetic rule
     * const ast3 = RuleParser.parse("example.org#?#.banner:-abp-has(.ad)");
     *
     * // Parse a comment rule
     * const ast4 = RuleParser.parse("! Comment");
     *
     * // Parse an empty rule
     * const ast5 = RuleParser.parse("");
     *
     * // Parse a comment rule (with metadata)
     * const ast6 = RuleParser.parse("! Title: Example");
     *
     * // Parse a pre-processor rule
     * const ast7 = RuleParser.parse("!#if (adguard)");
     * ```
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): AnyRule {
        try {
            // Empty lines / rules (handle it just for convenience)
            if (raw.trim().length === 0) {
                const result: EmptyRule = {
                    type: 'EmptyRule',
                    category: RuleCategory.Empty,
                    syntax: AdblockSyntax.Common,
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

            // Try to parse the rule with all sub-parsers. If a rule doesn't match
            // the pattern of a parser, then it will return `null`. For example, a
            // network rule will not match the pattern of a comment rule, since it
            // doesn't start with comment marker. But if the rule matches the
            // pattern of a parser, then it will return the AST of the rule, or
            // throw an error if the rule is syntactically invalid.
            if (options.ignoreComments) {
                if (CommentRuleParser.isCommentRule(raw)) {
                    const result: EmptyRule = {
                        type: 'EmptyRule',
                        category: RuleCategory.Empty,
                        syntax: AdblockSyntax.Common,
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

                return CosmeticRuleParser.parse(raw, options, baseOffset)
                    || RuleParser.parseHostOrNetworkRule(raw, options, baseOffset);
            }

            return CommentRuleParser.parse(raw, options, baseOffset)
                || CosmeticRuleParser.parse(raw, options, baseOffset)
                || RuleParser.parseHostOrNetworkRule(raw, options, baseOffset);
        } catch (error: unknown) {
            // If tolerant mode is disabled or the error is not known, then simply
            // re-throw the error
            if (!options.tolerant || !(error instanceof Error)) {
                throw error;
            }

            const errorNode: InvalidRuleError = {
                type: 'InvalidRuleError',
                name: error.name,
                message: error.message,
            };

            // If the error is an AdblockSyntaxError, then we can add the
            // location of the error to the result
            if (error instanceof AdblockSyntaxError) {
                errorNode.start = error.start;
                errorNode.end = error.end;
            }

            // Otherwise, return an invalid rule (tolerant mode)
            const result: InvalidRule = {
                type: 'InvalidRule',
                category: RuleCategory.Invalid,
                syntax: AdblockSyntax.Common,
                raw,
                error: errorNode,
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

    /**
     * Deserializes an empty rule node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserializeEmptyRule(buffer: InputByteBuffer, node: EmptyRule): void {
        buffer.assertUint8(BinaryTypeMap.EmptyRule);

        node.type = 'EmptyRule';
        node.category = RuleCategory.Empty;
        node.syntax = AdblockSyntax.Common;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case EmptyRuleSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case EmptyRuleSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}.`);
            }
            prop = buffer.readUint8();
        }
    }

    /**
     * Deserializes an invalid rule error node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserializeInvalidRuleErrorNode(buffer: InputByteBuffer, node: Partial<InvalidRuleError>): void {
        buffer.assertUint8(BinaryTypeMap.InvalidRuleErrorNode);

        node.type = 'InvalidRuleError';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case InvalidRuleErrorNodeSerializationMap.Name:
                    node.name = buffer.readString();
                    break;

                case InvalidRuleErrorNodeSerializationMap.Message:
                    node.message = buffer.readString();
                    break;

                case InvalidRuleErrorNodeSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case InvalidRuleErrorNodeSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}.`);
            }
            prop = buffer.readUint8();
        }
    }

    /**
     * Deserializes an invalid rule node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserializeInvalidRule(buffer: InputByteBuffer, node: InvalidRule): void {
        buffer.assertUint8(BinaryTypeMap.InvalidRule);

        node.type = 'InvalidRule';
        node.category = RuleCategory.Invalid;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case InvalidRuleSerializationMap.Error:
                    RuleParser.deserializeInvalidRuleErrorNode(buffer, node.error = {} as InvalidRuleError);
                    break;

                case InvalidRuleSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case InvalidRuleSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}.`);
            }

            prop = buffer.readUint8();
        }
    }

    /**
     * Deserializes a rule node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<AnyRule>): void {
        // lookup instead of storing +1 byte
        const type = buffer.peekUint8();
        switch (type) {
            case BinaryTypeMap.AgentRuleNode:
            case BinaryTypeMap.HintRuleNode:
            case BinaryTypeMap.PreProcessorCommentRuleNode:
            case BinaryTypeMap.MetadataCommentRuleNode:
            case BinaryTypeMap.ConfigCommentRuleNode:
            case BinaryTypeMap.CommentRuleNode:
                CommentRuleParser.deserialize(buffer, node as AnyCommentRule);
                break;

            case BinaryTypeMap.ElementHidingRule:
            case BinaryTypeMap.CssInjectionRule:
            case BinaryTypeMap.ScriptletInjectionRule:
            case BinaryTypeMap.HtmlFilteringRule:
            case BinaryTypeMap.JsInjectionRule:
                CosmeticRuleParser.deserialize(buffer, node as AnyCosmeticRule);
                break;

            case BinaryTypeMap.NetworkRuleNode:
                NetworkRuleParser.deserialize(buffer, node as NetworkRule);
                break;

            case BinaryTypeMap.HostRuleNode:
                HostRuleParser.deserialize(buffer, node as HostRule);
                break;

            case BinaryTypeMap.EmptyRule:
                RuleParser.deserializeEmptyRule(buffer, node as EmptyRule);
                break;

            case BinaryTypeMap.InvalidRule:
                RuleParser.deserializeInvalidRule(buffer, node as InvalidRule);
                break;

            default:
                throw new Error('Unknown rule category');
        }
    }
}
