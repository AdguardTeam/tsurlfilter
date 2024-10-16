/**
 * @file uBlock scriptlet injection body parser
 */

import {
    CLOSE_PARENTHESIS,
    COMMA,
    ESCAPE_CHARACTER,
    OPEN_PARENTHESIS,
    SPACE,
    UBO_SCRIPTLET_MASK,
    UBO_SCRIPTLET_MASK_LEGACY,
} from '../../../utils/constants';
import { StringUtils } from '../../../utils/string';
import { AdblockSyntaxError } from '../../../errors/adblock-syntax-error';
import { type ScriptletInjectionRuleBody } from '../../../nodes';
import { defaultParserOptions } from '../../options';
import { BaseParser } from '../../base-parser';
import { UboParameterListParser } from '../../misc/ubo-parameter-list-parser';

/**
 * `UboScriptletInjectionBodyParser` is responsible for parsing the body of a uBlock-style scriptlet rule.
 *
 * Please note that the parser will parse any scriptlet rule if it is syntactically correct.
 * For example, it will parse this:
 * ```adblock
 * example.com##+js(scriptlet0, arg0)
 * ```
 *
 * but it didn't check if the scriptlet `scriptlet0` actually supported by any adblocker.
 *
 * @see {@link https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#scriptlet-injection}
 */
export class UboScriptletInjectionBodyParser extends BaseParser {
    /**
     * Error messages used by the parser.
     */
    public static readonly ERROR_MESSAGES = {
        NO_SCRIPTLET_MASK: `Invalid uBO scriptlet call, no scriptlet call mask '${UBO_SCRIPTLET_MASK}' found`,
        NO_OPENING_PARENTHESIS: `Invalid uBO scriptlet call, no opening parentheses '${OPEN_PARENTHESIS}' found`,
        NO_CLOSING_PARENTHESIS: `Invalid uBO scriptlet call, no closing parentheses '${CLOSE_PARENTHESIS}' found`,
        NO_SCRIPTLET_NAME: 'Invalid uBO scriptlet call, no scriptlet name specified',
        WHITESPACE_AFTER_MASK: 'Invalid uBO scriptlet call, whitespace is not allowed after the scriptlet call mask',
    };

    /**
     * Parses the body of a uBlock-style scriptlet rule.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @returns Node of the parsed scriptlet call body
     * @throws If the body is syntactically incorrect
     * @example
     * ```
     * ##+js(scriptlet0, arg0)
     * ```
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): ScriptletInjectionRuleBody {
        let offset = 0;

        // Skip leading spaces
        offset = StringUtils.skipWS(raw, offset);

        let scriptletMaskLength = 0;

        if (raw.startsWith(UBO_SCRIPTLET_MASK, offset)) {
            scriptletMaskLength = UBO_SCRIPTLET_MASK.length;
        } else if (raw.startsWith(UBO_SCRIPTLET_MASK_LEGACY, offset)) {
            scriptletMaskLength = UBO_SCRIPTLET_MASK_LEGACY.length;
        }

        // Scriptlet call should start with "+js"
        if (!scriptletMaskLength) {
            throw new AdblockSyntaxError(
                this.ERROR_MESSAGES.NO_SCRIPTLET_MASK,
                baseOffset + offset,
                baseOffset + raw.length,
            );
        }

        offset += scriptletMaskLength;

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

        const result: ScriptletInjectionRuleBody = {
            type: 'ScriptletInjectionRuleBody',
            children: [],
        };

        if (options.isLocIncluded) {
            result.start = baseOffset;
            result.end = baseOffset + raw.length;
        }

        // Special case: empty scriptlet call, like +js(), +js( ), etc.
        if (StringUtils.skipWS(raw, openingParenthesesIndex + 1) === closingParenthesesIndex) {
            return result;
        }

        // Parse parameter list
        const params = UboParameterListParser.parse(
            raw.slice(openingParenthesesIndex + 1, closingParenthesesIndex),
            options,
            baseOffset + openingParenthesesIndex + 1,
            COMMA,
        );

        // Do not allow parameters without scriptlet: +js(, arg0, arg1)
        if (params.children.length > 0 && params.children[0] === null) {
            throw new AdblockSyntaxError(
                this.ERROR_MESSAGES.NO_SCRIPTLET_NAME,
                baseOffset + offset,
                baseOffset + raw.length,
            );
        }

        result.children.push(params);

        return result;
    }
}
