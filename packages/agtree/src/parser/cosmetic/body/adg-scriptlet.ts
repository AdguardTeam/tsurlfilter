/**
 * @file AdGuard scriptlet injection body parser
 */

import { sprintf } from 'sprintf-js';

import {
    ADG_SCRIPTLET_MASK,
    CLOSE_PARENTHESIS,
    COMMA,
    DOUBLE_QUOTE,
    EMPTY,
    ESCAPE_CHARACTER,
    OPEN_PARENTHESIS,
    SINGLE_QUOTE,
    SPACE,
} from '../../../utils/constants';
import { StringUtils } from '../../../utils/string';
import { AdblockSyntaxError } from '../../../errors/adblock-syntax-error';
import { ParameterListParser } from '../../misc/parameter-list';
import { defaultParserOptions } from '../../options';
import { ParserBase } from '../../interface';
import { type OutputByteBuffer } from '../../../utils/output-byte-buffer';
import { deserializeScriptletBody, serializeScriptletBody } from './scriptlet-serialization-helper';
import { type InputByteBuffer } from '../../../utils/input-byte-buffer';
import { BINARY_SCHEMA_VERSION } from '../../../utils/binary-schema-version';
import { ValueParser } from '../../misc/value';
import { type ParameterList, type ScriptletInjectionRuleBody } from '../../common';
import { isNull } from '../../../utils/type-guards';

type SingleOrDoubleQuote = typeof SINGLE_QUOTE | typeof DOUBLE_QUOTE;

/**
 * `AdgScriptletInjectionBodyParser` is responsible for parsing the body of an AdGuard-style scriptlet rule.
 *
 * Please note that the parser will parse any scriptlet rule if it is syntactically correct.
 * For example, it will parse this:
 * ```adblock
 * example.com#%#//scriptlet('scriptlet0', 'arg0')
 * ```
 *
 * but it didn't check if the scriptlet `scriptlet0` actually supported by any adblocker.
 *
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#scriptlets}
 */
export class AdgScriptletInjectionBodyParser extends ParserBase {
    /**
     * Error messages used by the parser.
     */
    public static readonly ERROR_MESSAGES = {
        NO_SCRIPTLET_MASK: `Invalid ADG scriptlet call, no scriptlet call mask '${ADG_SCRIPTLET_MASK}' found`,
        NO_OPENING_PARENTHESIS: `Invalid ADG scriptlet call, no opening parentheses '${OPEN_PARENTHESIS}' found`,
        NO_CLOSING_PARENTHESIS: `Invalid ADG scriptlet call, no closing parentheses '${CLOSE_PARENTHESIS}' found`,
        WHITESPACE_AFTER_MASK: 'Invalid ADG scriptlet call, whitespace is not allowed after the scriptlet call mask',
        NO_MULTIPLE_SCRIPTLET_CALLS: 'ADG syntaxes does not support multiple scriptlet calls within one single rule',
        NO_INCONSISTENT_QUOTES: 'Invalid ADG scriptlet call, inconsistent quotes',
        NO_UNCLOSED_PARAMETER: 'Invalid ADG scriptlet call, unclosed parameter',
        EXPECTED_QUOTE: "Invalid ADG scriptlet call, expected quote, got '%s'",
        EXPECTED_COMMA: "Invalid ADG scriptlet call, expected comma, got '%s'",
    };

    /**
     * Value map for binary serialization. This helps to reduce the size of the serialized data,
     * as it allows us to use a single byte to represent frequently used values.
     *
     * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
     *
     * @note Only 256 values can be represented this way.
     */
    // TODO: Update this map with the actual values
    private static readonly FREQUENT_ARGS_SERIALIZATION_MAP = new Map<string, number>([
        ['abort-current-inline-script', 0],
        ['abort-on-property-read', 1],
        ['abort-on-property-write', 2],
        ['abort-on-stack-trace', 3],
        ['adjust-setInterval', 4],
        ['adjust-setTimeout', 5],
        ['close-window', 6],
        ['debug-current-inline-script', 7],
        ['debug-on-property-read', 8],
        ['debug-on-property-write', 9],
        ['dir-string', 10],
        ['disable-newtab-links', 11],
        ['evaldata-prune', 12],
        ['json-prune', 13],
        ['log', 14],
        ['log-addEventListener', 15],
        ['log-eval', 16],
        ['log-on-stack-trace', 17],
        ['m3u-prune', 18],
        ['noeval', 19],
        ['nowebrtc', 20],
        ['no-topics', 21],
        ['prevent-addEventListener', 22],
        ['prevent-adfly', 23],
        ['prevent-bab', 24],
        ['prevent-eval-if', 25],
        ['prevent-fab-3.2.0', 26],
        ['prevent-fetch', 27],
        ['prevent-xhr', 28],
        ['prevent-popads-net', 29],
        ['prevent-refresh', 30],
        ['prevent-requestAnimationFrame', 31],
        ['prevent-setInterval', 32],
        ['prevent-setTimeout', 33],
        ['prevent-window-open', 34],
        ['remove-attr', 35],
        ['remove-class', 36],
        ['remove-cookie', 37],
        ['remove-node-text', 38],
        ['set-attr', 39],
        ['set-constant', 40],
        ['set-cookie', 41],
        ['set-cookie-reload', 42],
        ['set-local-storage-item', 43],
        ['set-popads-dummy', 44],
        ['set-session-storage-item', 45],
        ['xml-prune', 46],
    ]);

    /**
     * Value map for binary deserialization. This helps to reduce the size of the serialized data,
     * as it allows us to use a single byte to represent frequently used values.
     */
    private static readonly FREQUENT_ARGS_DESERIALIZATION_MAP = new Map<number, string>(
        Array.from(this.FREQUENT_ARGS_SERIALIZATION_MAP).map(([key, value]) => [value, key]),
    );

    /**
     * Parses the body of an AdGuard-style scriptlet rule.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @returns Node of the parsed scriptlet call body
     * @throws If the body is syntactically incorrect
     * @example
     * ```
     * //scriptlet('scriptlet0', 'arg0')
     * ```
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): ScriptletInjectionRuleBody {
        let offset = 0;

        // Skip leading spaces
        offset = StringUtils.skipWS(raw, offset);

        // Scriptlet call should start with "//scriptlet"
        if (!raw.startsWith(ADG_SCRIPTLET_MASK, offset)) {
            throw new AdblockSyntaxError(
                this.ERROR_MESSAGES.NO_SCRIPTLET_MASK,
                baseOffset + offset,
                baseOffset + raw.length,
            );
        }

        offset += ADG_SCRIPTLET_MASK.length;

        // Whitespace is not allowed after the mask
        if (raw[offset] === SPACE) {
            throw new AdblockSyntaxError(
                this.ERROR_MESSAGES.WHITESPACE_AFTER_MASK,
                baseOffset + offset,
                baseOffset + raw.length,
            );
        }

        // Parameter list should be wrapped in parentheses
        if (raw[offset] !== OPEN_PARENTHESIS) {
            throw new AdblockSyntaxError(
                this.ERROR_MESSAGES.NO_OPENING_PARENTHESIS,
                baseOffset + offset,
                baseOffset + raw.length,
            );
        }

        // Save the offset of the opening parentheses
        const openingParenthesesIndex = offset;

        // Skip whitespace from the end
        const closingParenthesesIndex = StringUtils.skipWSBack(raw, raw.length - 1);

        // Closing parentheses should be present
        if (
            raw[closingParenthesesIndex] !== CLOSE_PARENTHESIS
            || raw[closingParenthesesIndex - 1] === ESCAPE_CHARACTER
        ) {
            throw new AdblockSyntaxError(
                this.ERROR_MESSAGES.NO_CLOSING_PARENTHESIS,
                baseOffset + offset,
                baseOffset + raw.length,
            );
        }

        // Skip space, if any
        offset = StringUtils.skipWS(raw, offset + 1);

        let detectedQuote: SingleOrDoubleQuote | null = null;

        const parameterList: ParameterList = {
            type: 'ParameterList',
            children: [],
        };

        if (options.isLocIncluded) {
            parameterList.start = baseOffset + openingParenthesesIndex + 1;
            parameterList.end = baseOffset + closingParenthesesIndex;
        }

        while (offset < closingParenthesesIndex) {
            // Skip whitespace
            offset = StringUtils.skipWS(raw, offset);

            // Expect comma if not first parameter
            if (parameterList.children.length > 0) {
                if (raw[offset] !== COMMA) {
                    throw new AdblockSyntaxError(
                        sprintf(AdgScriptletInjectionBodyParser.ERROR_MESSAGES.EXPECTED_COMMA, raw[offset]),
                        baseOffset + offset,
                        baseOffset + raw.length,
                    );
                }

                offset += 1;

                // Skip whitespace
                offset = StringUtils.skipWS(raw, offset);
            }

            // Next character should be a quote
            if (raw[offset] === SINGLE_QUOTE || raw[offset] === DOUBLE_QUOTE) {
                if (isNull(detectedQuote)) {
                    detectedQuote = raw[offset] as SingleOrDoubleQuote;
                } else if (detectedQuote !== raw[offset]) {
                    throw new AdblockSyntaxError(
                        AdgScriptletInjectionBodyParser.ERROR_MESSAGES.NO_INCONSISTENT_QUOTES,
                        baseOffset + offset,
                        baseOffset + raw.length,
                    );
                }

                // Find next unescaped same quote
                const closingQuoteIndex = StringUtils.findNextUnescapedCharacter(raw, detectedQuote, offset + 1);

                if (closingQuoteIndex === -1) {
                    throw new AdblockSyntaxError(
                        AdgScriptletInjectionBodyParser.ERROR_MESSAGES.NO_UNCLOSED_PARAMETER,
                        baseOffset + offset,
                        baseOffset + raw.length,
                    );
                }

                // Save the parameter
                const parameter = ValueParser.parse(
                    raw.slice(offset, closingQuoteIndex + 1),
                    options,
                    baseOffset + offset,
                );

                parameterList.children.push(parameter);

                // Move after the closing quote
                offset = StringUtils.skipWS(raw, closingQuoteIndex + 1);
            } else {
                throw new AdblockSyntaxError(
                    sprintf(AdgScriptletInjectionBodyParser.ERROR_MESSAGES.EXPECTED_QUOTE, raw[offset]),
                    baseOffset + offset,
                    baseOffset + raw.length,
                );
            }
        }

        const result: ScriptletInjectionRuleBody = {
            type: 'ScriptletInjectionRuleBody',
            children: [
                parameterList,
            ],
        };

        if (options.isLocIncluded) {
            result.start = baseOffset;
            result.end = baseOffset + raw.length;
        }

        return result;
    }

    /**
     * Generates a string representation of the AdGuard scriptlet call body.
     *
     * @param node Scriptlet injection rule body
     * @returns String representation of the rule body
     */
    public static generate(node: ScriptletInjectionRuleBody): string {
        const result: string[] = [];

        if (node.children.length > 1) {
            throw new Error(this.ERROR_MESSAGES.NO_MULTIPLE_SCRIPTLET_CALLS);
        }

        result.push(ADG_SCRIPTLET_MASK);
        result.push(OPEN_PARENTHESIS);

        if (node.children.length > 0) {
            result.push(ParameterListParser.generate(node.children[0]));
        }

        result.push(CLOSE_PARENTHESIS);

        return result.join(EMPTY);
    }

    /**
     * Serializes a scriptlet call body node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: ScriptletInjectionRuleBody, buffer: OutputByteBuffer): void {
        serializeScriptletBody(node, buffer, this.FREQUENT_ARGS_SERIALIZATION_MAP);
    }

    /**
     * Deserializes a scriptlet call body node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<ScriptletInjectionRuleBody>): void {
        deserializeScriptletBody(buffer, node, this.FREQUENT_ARGS_DESERIALIZATION_MAP);
    }
}
