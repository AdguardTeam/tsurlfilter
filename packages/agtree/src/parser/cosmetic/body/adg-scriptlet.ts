/**
 * @file AdGuard scriptlet injection body parser
 */

import {
    ADG_SCRIPTLET_MASK,
    CLOSE_PARENTHESIS,
    COMMA,
    EMPTY,
    ESCAPE_CHARACTER,
    OPEN_PARENTHESIS,
    SPACE,
} from '../../../utils/constants';
import { StringUtils } from '../../../utils/string';
import { AdblockSyntaxError } from '../../../errors/adblock-syntax-error';
import { ParameterListParser } from '../../misc/parameter-list';
import { type ScriptletInjectionRuleBody } from '../../common';
import { defaultParserOptions } from '../../options';
import { ParserBase } from '../../interface';
import { type OutputByteBuffer } from '../../../utils/output-byte-buffer';
import { deserializeScriptletBody, serializeScriptletBody } from './scriptlet-serialization-helper';
import { type InputByteBuffer } from '../../../utils/input-byte-buffer';

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
        NO_SCRIPTLET_NAME: 'Invalid ADG scriptlet call, no scriptlet name specified',
        WHITESPACE_AFTER_MASK: 'Invalid ADG scriptlet call, whitespace is not allowed after the scriptlet call mask',
        NO_MULTIPLE_SCRIPTLET_CALLS: 'ADG syntaxes does not support multiple scriptlet calls within one single rule',
    };

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

        // Parse parameter list
        const params = ParameterListParser.parse(
            raw.slice(openingParenthesesIndex + 1, closingParenthesesIndex),
            options,
            baseOffset + openingParenthesesIndex + 1,
            COMMA,
        );

        // Allow empty scriptlet call: //scriptlet(),
        // but not allow parameters without scriptlet: //scriptlet(, arg0, arg1)
        if (params.children.length > 0 && params.children[0] === null) {
            throw new AdblockSyntaxError(
                this.ERROR_MESSAGES.NO_SCRIPTLET_NAME,
                baseOffset + offset,
                baseOffset + raw.length,
            );
        }

        const result: ScriptletInjectionRuleBody = {
            type: 'ScriptletInjectionRuleBody',
            children: [
                params,
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
        serializeScriptletBody(node, buffer);
    }

    /**
     * Deserializes a scriptlet call body node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<ScriptletInjectionRuleBody>): void {
        deserializeScriptletBody(buffer, node);
    }
}
