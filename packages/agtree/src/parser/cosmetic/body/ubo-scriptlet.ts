/**
 * @file uBlock scriptlet injection body parser
 */

import {
    CLOSE_PARENTHESIS,
    COMMA,
    EMPTY,
    ESCAPE_CHARACTER,
    OPEN_PARENTHESIS,
    SPACE,
    UBO_SCRIPTLET_MASK,
} from '../../../utils/constants';
import { locRange, shiftLoc } from '../../../utils/location';
import { StringUtils } from '../../../utils/string';
import { AdblockSyntaxError } from '../../../errors/adblock-syntax-error';
import { ParameterListParser } from '../../misc/parameter-list';
import { type ScriptletInjectionRuleBody } from '../../common';
import { getParserOptions, type ParserOptions } from '../../options';

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
export class UboScriptletInjectionBodyParser {
    /**
     * Error messages used by the parser.
     */
    public static readonly ERROR_MESSAGES = {
        NO_SCRIPTLET_MASK: `Invalid uBO scriptlet call, no scriptlet call mask '${UBO_SCRIPTLET_MASK}' found`,
        NO_OPENING_PARENTHESIS: `Invalid uBO scriptlet call, no opening parentheses '${OPEN_PARENTHESIS}' found`,
        NO_CLOSING_PARENTHESIS: `Invalid uBO scriptlet call, no closing parentheses '${CLOSE_PARENTHESIS}' found`,
        NO_SCRIPTLET_NAME: 'Invalid uBO scriptlet call, no scriptlet name specified',
        WHITESPACE_AFTER_MASK: 'Invalid uBO scriptlet call, whitespace is not allowed after the scriptlet call mask',
        NO_MULTIPLE_SCRIPTLET_CALLS: 'uBO syntaxes does not support multiple scriptlet calls within one single rule',
    };

    /**
     * Parses the body of a uBlock-style scriptlet rule.
     *
     * @param raw Raw scriptlet call body
     * @param options Parser options. See {@link ParserOptions}.
     * @returns Node of the parsed scriptlet call body
     * @throws If the body is syntactically incorrect
     * @example
     * ```
     * ##+js(scriptlet0, arg0)
     * ```
     */
    public static parse(raw: string, options: Partial<ParserOptions> = {}): ScriptletInjectionRuleBody {
        const { baseLoc, isLocIncluded } = getParserOptions(options);
        let offset = 0;

        // Skip leading spaces
        offset = StringUtils.skipWS(raw, offset);

        // Scriptlet call should start with "+js"
        if (!raw.startsWith(UBO_SCRIPTLET_MASK, offset)) {
            throw new AdblockSyntaxError(
                this.ERROR_MESSAGES.NO_SCRIPTLET_MASK,
                locRange(baseLoc, offset, raw.length),
            );
        }

        offset += UBO_SCRIPTLET_MASK.length;

        // Whitespace is not allowed after the mask
        if (raw[offset] === SPACE) {
            throw new AdblockSyntaxError(
                this.ERROR_MESSAGES.WHITESPACE_AFTER_MASK,
                locRange(baseLoc, offset, raw.length),
            );
        }

        // Parameter list should be wrapped in parentheses
        if (raw[offset] !== OPEN_PARENTHESIS) {
            throw new AdblockSyntaxError(
                this.ERROR_MESSAGES.NO_OPENING_PARENTHESIS,
                locRange(baseLoc, offset, raw.length),
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
                locRange(baseLoc, offset, raw.length),
            );
        }

        // Parse parameter list
        const params = ParameterListParser.parse(
            raw.substring(openingParenthesesIndex + 1, closingParenthesesIndex),
            {
                isLocIncluded,
                baseLoc: shiftLoc(baseLoc, openingParenthesesIndex + 1),
                separator: COMMA,
            },
        );

        // Allow empty scriptlet call: +js()
        // but not allow parameters without scriptlet: +js(, arg0, arg1)
        if (params.children.length > 0 && params.children[0].value.trim() === EMPTY) {
            throw new AdblockSyntaxError(
                this.ERROR_MESSAGES.NO_SCRIPTLET_NAME,
                locRange(baseLoc, offset, raw.length),
            );
        }

        const result: ScriptletInjectionRuleBody = {
            type: 'ScriptletInjectionRuleBody',
            children: [
                params,
            ],
        };

        if (isLocIncluded) {
            result.loc = locRange(baseLoc, 0, raw.length);
        }

        return result;
    }

    /**
     * Generates a string representation of the uBlock scriptlet call body.
     *
     * @param node Scriptlet injection rule body
     * @returns String representation of the rule body
     */
    public static generate(node: ScriptletInjectionRuleBody): string {
        const result: string[] = [];

        if (node.children.length > 1) {
            throw new Error(this.ERROR_MESSAGES.NO_MULTIPLE_SCRIPTLET_CALLS);
        }

        result.push(UBO_SCRIPTLET_MASK);
        result.push(OPEN_PARENTHESIS);

        if (node.children.length > 0) {
            result.push(ParameterListParser.generate(node.children[0]));
        }

        result.push(CLOSE_PARENTHESIS);

        return result.join(EMPTY);
    }
}
