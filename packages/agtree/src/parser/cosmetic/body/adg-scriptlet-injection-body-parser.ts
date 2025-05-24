/**
 * @file AdGuard scriptlet injection body parser
 */

import { sprintf } from 'sprintf-js';

import {
    ADG_SCRIPTLET_MASK,
    CLOSE_PARENTHESIS,
    COMMA,
    DOUBLE_QUOTE,
    ESCAPE_CHARACTER,
    OPEN_PARENTHESIS,
    SINGLE_QUOTE,
    SPACE,
} from '../../../utils/constants.js';
import { StringUtils } from '../../../utils/string.js';
import { AdblockSyntaxError } from '../../../errors/adblock-syntax-error.js';
import { defaultParserOptions } from '../../options.js';
import { BaseParser } from '../../base-parser.js';
import { ValueParser } from '../../misc/value-parser.js';
import { type ParameterList, type ScriptletInjectionRuleBody } from '../../../nodes/index.js';
import { isNull } from '../../../utils/type-guards.js';

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
export class AdgScriptletInjectionBodyParser extends BaseParser {
    /**
     * Error messages used by the parser.
     */
    public static readonly ERROR_MESSAGES = {
        NO_SCRIPTLET_MASK: `Invalid ADG scriptlet call, no scriptlet call mask '${ADG_SCRIPTLET_MASK}' found`,
        NO_OPENING_PARENTHESIS: `Invalid ADG scriptlet call, no opening parentheses '${OPEN_PARENTHESIS}' found`,
        NO_CLOSING_PARENTHESIS: `Invalid ADG scriptlet call, no closing parentheses '${CLOSE_PARENTHESIS}' found`,
        WHITESPACE_AFTER_MASK: 'Invalid ADG scriptlet call, whitespace is not allowed after the scriptlet call mask',
        NO_INCONSISTENT_QUOTES: 'Invalid ADG scriptlet call, inconsistent quotes',
        NO_UNCLOSED_PARAMETER: 'Invalid ADG scriptlet call, unclosed parameter',
        EXPECTED_QUOTE: "Invalid ADG scriptlet call, expected quote, got '%s'",
        EXPECTED_COMMA: "Invalid ADG scriptlet call, expected comma, got '%s'",
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

        // Skip space, if any
        offset = StringUtils.skipWS(raw, offset + 1);

        const result: ScriptletInjectionRuleBody = {
            type: 'ScriptletInjectionRuleBody',
            children: [],
        };

        if (options.isLocIncluded) {
            result.start = baseOffset;
            result.end = baseOffset + raw.length;
        }

        // Special case: empty scriptlet call, like `//scriptlet()`, `//scriptlet( )` etc.
        if (StringUtils.skipWS(raw, openingParenthesesIndex + 1) === closingParenthesesIndex) {
            return result;
        }

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

                // Eat the comma
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

        result.children.push(parameterList);

        return result;
    }
}
