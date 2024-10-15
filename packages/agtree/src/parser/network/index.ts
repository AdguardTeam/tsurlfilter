/* eslint-disable no-param-reassign */
import { AdblockSyntax } from '../../utils/adblockers';
import { StringUtils } from '../../utils/string';
import { ModifierListParser } from '../misc/modifier-list';
import {
    ESCAPE_CHARACTER,
    NETWORK_RULE_EXCEPTION_MARKER,
    NETWORK_RULE_EXCEPTION_MARKER_LEN,
    NETWORK_RULE_SEPARATOR,
    NULL,
    REGEX_MARKER,
} from '../../utils/constants';
import {
    type ModifierList,
    type NetworkRule,
    RuleCategory,
    BinaryTypeMap,
    getSyntaxDeserializationMap,
    type Value,
    NetworkRuleType,
} from '../../nodes';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { defaultParserOptions } from '../options';
import { BaseParser } from '../interface';
import { ValueParser } from '../misc/value';
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
const enum NetworkRuleSerializationMap {
    Syntax = 1,
    Raws,
    Exception,
    Pattern,
    ModifierList,
    Start,
    End,
}

/**
 * `NetworkRuleParser` is responsible for parsing network rules.
 *
 * Please note that this will parse all syntactically correct network rules.
 * Modifier compatibility is not checked at the parser level.
 *
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#basic-rules}
 * @see {@link https://help.eyeo.com/adblockplus/how-to-write-filters#basic}
 */
export class NetworkRuleParser extends BaseParser {
    /**
     * Parses a network rule (also known as basic rule).
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @returns Network rule AST
     *
     * @throws If the rule is syntactically incorrect.
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): NetworkRule {
        let offset = 0;

        // Skip leading whitespace
        offset = StringUtils.skipWS(raw, offset);

        // Handle exception rules
        let exception = false;

        // Rule starts with exception marker, eg @@||example.com,
        // where @@ is the exception marker
        if (raw.startsWith(NETWORK_RULE_EXCEPTION_MARKER, offset)) {
            offset += NETWORK_RULE_EXCEPTION_MARKER_LEN;
            exception = true;
        }

        // Save the start of the pattern
        const patternStart = offset;

        // Find corresponding (last) separator ($) character (if any)
        const separatorIndex = NetworkRuleParser.findNetworkRuleSeparatorIndex(raw);

        // Save the end of the pattern
        const patternEnd = separatorIndex === -1
            ? StringUtils.skipWSBack(raw) + 1
            : StringUtils.skipWSBack(raw, separatorIndex - 1) + 1;

        // Parse pattern
        const pattern = ValueParser.parse(
            raw.slice(patternStart, patternEnd),
            options,
            baseOffset + patternStart,
        );

        // Parse modifiers (if any)
        let modifiers: ModifierList | undefined;

        // Find start and end index of the modifiers
        const modifiersStart = separatorIndex + 1;
        const modifiersEnd = StringUtils.skipWSBack(raw) + 1;

        if (separatorIndex !== -1) {
            modifiers = ModifierListParser.parse(
                raw.slice(modifiersStart, modifiersEnd),
                options,
                baseOffset + modifiersStart,
            );
        }

        // Throw error if there is no pattern and no modifiers
        if (pattern.value.length === 0 && (modifiers === undefined || modifiers.children.length === 0)) {
            throw new AdblockSyntaxError(
                'Network rule must have a pattern or modifiers',
                baseOffset,
                baseOffset + raw.length,
            );
        }

        const result: NetworkRule = {
            type: NetworkRuleType.NetworkRule,
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception,
            pattern,
            modifiers,
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
     * Finds the index of the separator character in a network rule.
     *
     * @param rule Network rule to check
     * @returns The index of the separator character, or -1 if there is no separator
     */
    private static findNetworkRuleSeparatorIndex(rule: string): number {
        // As we are looking for the last separator, we start from the end of the string
        for (let i = rule.length - 1; i >= 0; i -= 1) {
            // If we find a potential separator, we should check
            // - if it's not escaped
            // - if it's not followed by a regex marker, for example: `example.org^$removeparam=/regex$/`
            // eslint-disable-next-line max-len
            if (rule[i] === NETWORK_RULE_SEPARATOR && rule[i + 1] !== REGEX_MARKER && rule[i - 1] !== ESCAPE_CHARACTER) {
                return i;
            }
        }

        return -1;
    }

    /**
     * Deserializes a modifier node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<NetworkRule>): void {
        buffer.assertUint8(BinaryTypeMap.NetworkRuleNode);

        node.type = NetworkRuleType.NetworkRule;
        node.category = RuleCategory.Network;
        node.modifiers = undefined;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case NetworkRuleSerializationMap.Syntax:
                    node.syntax = getSyntaxDeserializationMap().get(buffer.readUint8()) ?? AdblockSyntax.Common;
                    break;

                case NetworkRuleSerializationMap.Exception:
                    node.exception = buffer.readUint8() === 1;
                    break;

                case NetworkRuleSerializationMap.Pattern:
                    ValueParser.deserialize(buffer, node.pattern = {} as Value);
                    break;

                case NetworkRuleSerializationMap.ModifierList:
                    ModifierListParser.deserialize(buffer, node.modifiers = {} as ModifierList);
                    break;

                case NetworkRuleSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case NetworkRuleSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}.`);
            }

            prop = buffer.readUint8();
        }
    }
}
