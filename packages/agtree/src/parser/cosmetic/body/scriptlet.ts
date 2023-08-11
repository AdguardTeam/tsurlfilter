/**
 * @file Scriptlet injection rule body parser
 */

import { AdblockSyntax } from '../../../utils/adblockers';
import {
    ADG_SCRIPTLET_MASK,
    CLOSE_PARENTHESIS,
    COMMA,
    EMPTY,
    OPEN_PARENTHESIS,
    SEMICOLON,
    SPACE,
    UBO_SCRIPTLET_MASK,
} from '../../../utils/constants';
import { locRange, shiftLoc } from '../../../utils/location';
import { StringUtils } from '../../../utils/string';
import { AdblockSyntaxError } from '../../../errors/adblock-syntax-error';
import { ParameterListParser } from '../../misc/parameter-list';
import { type ScriptletInjectionRuleBody, defaultLocation } from '../../common';

/**
 * `ScriptletBodyParser` is responsible for parsing the body of a scriptlet rule.
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
 * @see {@link https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#scriptlet-injection}
 * @see {@link https://help.eyeo.com/adblockplus/snippet-filters-tutorial}
 */
export class ScriptletInjectionBodyParser {
    /**
     * Parses a raw ADG/uBO scriptlet call body.
     *
     * @param raw Raw scriptlet call body
     * @param loc Location of the body
     * @returns Scriptlet rule body AST
     * @throws If the body is syntactically incorrect
     * @example
     * ```
     * //scriptlet('scriptlet0', 'arg0')
     * js(scriptlet0, arg0, arg1, arg2)
     * ```
     */
    public static parseAdgAndUboScriptletCall(raw: string, loc = defaultLocation): ScriptletInjectionRuleBody {
        let offset = 0;

        // Skip leading spaces
        offset = StringUtils.skipWS(raw, offset);

        // Scriptlet call should start with "js" or "//scriptlet"
        if (raw.startsWith(ADG_SCRIPTLET_MASK, offset)) {
            offset += ADG_SCRIPTLET_MASK.length;
        } else if (raw.startsWith(UBO_SCRIPTLET_MASK, offset)) {
            offset += UBO_SCRIPTLET_MASK.length;
        } else {
            throw new AdblockSyntaxError(
                // eslint-disable-next-line max-len
                `Invalid AdGuard/uBlock scriptlet call, no scriptlet call mask '${ADG_SCRIPTLET_MASK}' or '${UBO_SCRIPTLET_MASK}' found`,
                locRange(loc, offset, raw.length),
            );
        }

        // Whitespace is not allowed after the mask
        if (raw[offset] === SPACE) {
            throw new AdblockSyntaxError(
                'Invalid AdGuard/uBlock scriptlet call, whitespace is not allowed after the scriptlet call mask',
                locRange(loc, offset, offset + 1),
            );
        }

        // Parameter list should be wrapped in parentheses
        if (raw[offset] !== OPEN_PARENTHESIS) {
            throw new AdblockSyntaxError(
                // eslint-disable-next-line max-len
                `Invalid AdGuard/uBlock scriptlet call, no opening parentheses '${OPEN_PARENTHESIS}' found`,
                locRange(loc, offset, raw.length),
            );
        }

        // Save the offset of the opening parentheses
        const openingParenthesesIndex = offset;

        // Find closing parentheses
        // eslint-disable-next-line max-len
        const closingParenthesesIndex = StringUtils.findUnescapedNonStringNonRegexChar(raw, CLOSE_PARENTHESIS, openingParenthesesIndex + 1);

        // Closing parentheses should be present
        if (closingParenthesesIndex === -1) {
            throw new AdblockSyntaxError(
                // eslint-disable-next-line max-len
                `Invalid AdGuard/uBlock scriptlet call, no closing parentheses '${CLOSE_PARENTHESIS}' found`,
                locRange(loc, offset, raw.length),
            );
        }

        // Shouldn't have any characters after the closing parentheses
        if (StringUtils.skipWSBack(raw) !== closingParenthesesIndex) {
            throw new AdblockSyntaxError(
                // eslint-disable-next-line max-len
                `Invalid AdGuard/uBlock scriptlet call, unexpected characters after the closing parentheses '${CLOSE_PARENTHESIS}'`,
                locRange(loc, closingParenthesesIndex + 1, raw.length),
            );
        }

        // Parse parameter list
        const params = ParameterListParser.parse(
            raw.substring(openingParenthesesIndex + 1, closingParenthesesIndex),
            COMMA,
            shiftLoc(loc, openingParenthesesIndex + 1),
        );

        // Allow empty scritptlet call: js() or //scriptlet(), but not allow parameters
        // without scriptlet: js(, arg0, arg1) or //scriptlet(, arg0, arg1)
        if (params.children.length > 0 && params.children[0].value.trim() === EMPTY) {
            throw new AdblockSyntaxError(
                // eslint-disable-next-line max-len
                'Invalid AdGuard/uBlock scriptlet call, no scriptlet name specified',
                locRange(loc, offset, raw.length),
            );
        }

        return {
            type: 'ScriptletInjectionRuleBody',
            loc: locRange(loc, 0, raw.length),
            children: [
                params,
            ],
        };
    }

    /**
     * Parses a raw ABP scriptlet call body.
     *
     * @param raw Raw scriptlet call body
     * @param loc Body location
     * @returns Parsed scriptlet rule body
     * @throws If the body is syntactically incorrect
     * @example
     * ```
     * scriptlet0 arg0 arg1 arg2; scriptlet1 arg0 arg1 arg2
     * ```
     */
    public static parseAbpSnippetCall(raw: string, loc = defaultLocation): ScriptletInjectionRuleBody {
        const result: ScriptletInjectionRuleBody = {
            type: 'ScriptletInjectionRuleBody',
            loc: locRange(loc, 0, raw.length),
            children: [],
        };

        let offset = 0;

        // Skip leading spaces
        offset = StringUtils.skipWS(raw, offset);

        while (offset < raw.length) {
            offset = StringUtils.skipWS(raw, offset);

            const scriptletCallStart = offset;

            // Find the next semicolon or the end of the string
            let semicolonIndex = StringUtils.findUnescapedNonStringNonRegexChar(raw, SEMICOLON, offset);

            if (semicolonIndex === -1) {
                semicolonIndex = raw.length;
            }

            const scriptletCallEnd = Math.max(StringUtils.skipWSBack(raw, semicolonIndex - 1) + 1, scriptletCallStart);

            const params = ParameterListParser.parse(
                raw.substring(scriptletCallStart, scriptletCallEnd),
                SPACE,
                shiftLoc(loc, scriptletCallStart),
            );

            // Parse the scriptlet call
            result.children.push(params);

            // Skip the semicolon
            offset = semicolonIndex + 1;
        }

        if (result.children.length === 0) {
            throw new AdblockSyntaxError(
                // eslint-disable-next-line max-len
                'Invalid ABP snippet call, no scriptlets specified at all',
                locRange(loc, 0, raw.length),
            );
        }

        return result;
    }

    /**
     * Parses the specified scriptlet injection rule body into an AST.
     *
     * @param raw Raw rule body
     * @param syntax Preferred syntax to use. If not specified, the syntax will be
     * automatically detected, but it may lead to incorrect parsing results.
     * @param loc Rule body location
     * @returns Parsed rule body
     * @throws If the rule body is syntactically incorrect
     */
    public static parse(
        raw: string,
        syntax: AdblockSyntax | null = null,
        loc = defaultLocation,
    ): ScriptletInjectionRuleBody {
        const trimmed = raw.trim();

        if (
            (syntax === null && (
                trimmed.startsWith(ADG_SCRIPTLET_MASK)
                // We shouldn't parse ABP's json-prune as a uBlock scriptlet call
                || (trimmed.startsWith(UBO_SCRIPTLET_MASK) && !trimmed.startsWith('json'))
            ))
            || syntax === AdblockSyntax.Adg
            || syntax === AdblockSyntax.Ubo
        ) {
            return ScriptletInjectionBodyParser.parseAdgAndUboScriptletCall(trimmed, loc);
        }

        return ScriptletInjectionBodyParser.parseAbpSnippetCall(trimmed, loc);
    }

    /**
     * Generates a string representation of the rule body for the specified syntax.
     *
     * @param ast Scriptlet injection rule body
     * @param syntax Syntax to use
     * @returns String representation of the rule body
     * @throws If the rule body is not supported by the specified syntax
     * @throws If the AST is invalid
     */
    public static generate(ast: ScriptletInjectionRuleBody, syntax: AdblockSyntax): string {
        let result = EMPTY;

        if (ast.children.length === 0) {
            throw new Error('Invalid AST, no scriptlet calls specified');
        }

        // AdGuard and uBlock doesn't support multiple scriptlet calls in one rule
        if (syntax === AdblockSyntax.Adg || syntax === AdblockSyntax.Ubo) {
            if (ast.children.length > 1) {
                throw new Error('AdGuard and uBlock syntaxes don\'t support multiple scriptlet calls in one rule');
            }

            const scriptletCall = ast.children[0];

            if (scriptletCall.children.length === 0) {
                throw new Error('Scriptlet name is not specified');
            }

            if (syntax === AdblockSyntax.Adg) {
                result += ADG_SCRIPTLET_MASK;
            } else {
                result += UBO_SCRIPTLET_MASK;
            }

            result += OPEN_PARENTHESIS;
            result += ParameterListParser.generate(scriptletCall);
            result += CLOSE_PARENTHESIS;
        } else {
            // First generate a string representation of all scriptlet calls, then join them with semicolons
            const scriptletCalls: string[] = [];

            for (const scriptletCall of ast.children) {
                if (scriptletCall.children.length === 0) {
                    throw new Error('Scriptlet name is not specified');
                }

                scriptletCalls.push(ParameterListParser.generate(scriptletCall, SPACE));
            }

            result += scriptletCalls.join(SEMICOLON + SPACE);
        }

        return result;
    }
}
