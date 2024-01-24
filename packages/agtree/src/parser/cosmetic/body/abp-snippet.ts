/**
 * @file uBlock scriptlet injection body parser
 */

import { SEMICOLON, SPACE } from '../../../utils/constants';
import { StringUtils } from '../../../utils/string';
import { AdblockSyntaxError } from '../../../errors/adblock-syntax-error';
import { ParameterListParser } from '../../misc/parameter-list';
import { type ScriptletInjectionRuleBody } from '../../common';
import { defaultParserOptions } from '../../options';
import { ParserBase } from '../../interface';

/**
 * `AbpSnippetInjectionBodyParser` is responsible for parsing the body of an Adblock Plus-style snippet rule.
 *
 * Please note that the parser will parse any scriptlet rule if it is syntactically correct.
 * For example, it will parse this:
 * ```adblock
 * example.com#$#snippet0 arg0
 * ```
 *
 * but it didn't check if the scriptlet `snippet0` actually supported by any adblocker.
 *
 * @see {@link https://help.eyeo.com/adblockplus/snippet-filters-tutorial}
 */
export class AbpSnippetInjectionBodyParser extends ParserBase {
    /**
     * Error messages used by the parser.
     */
    public static readonly ERROR_MESSAGES = {
        EMPTY_SCRIPTLET_CALL: 'Empty ABP snippet call',
    };

    /**
     * Parses the body of an Adblock Plus-style snippet rule.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @returns Node of the parsed scriptlet call body
     * @throws If the body is syntactically incorrect
     * @example
     * ```
     * #$#snippet0 arg0
     * ```
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): ScriptletInjectionRuleBody {
        const result: ScriptletInjectionRuleBody = {
            type: 'ScriptletInjectionRuleBody',
            children: [],
        };

        if (options.isLocIncluded) {
            result.start = baseOffset;
            result.end = baseOffset + raw.length;
        }

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
                raw.slice(scriptletCallStart, scriptletCallEnd),
                options,
                baseOffset + scriptletCallStart,
                SPACE,
            );

            // Parse the scriptlet call
            result.children.push(params);

            // Skip the semicolon
            offset = semicolonIndex + 1;
        }

        if (result.children.length === 0) {
            throw new AdblockSyntaxError(
                this.ERROR_MESSAGES.EMPTY_SCRIPTLET_CALL,
                baseOffset,
                baseOffset + raw.length,
            );
        }

        return result;
    }

    /**
     * Generates a string representation of the Adblock Plus-style snippet call body.
     *
     * @param node Scriptlet injection rule body
     * @returns String representation of the rule body
     */
    public static generate(node: ScriptletInjectionRuleBody): string {
        const result: string[] = [];

        if (node.children.length === 0) {
            throw new Error(this.ERROR_MESSAGES.EMPTY_SCRIPTLET_CALL);
        }

        for (const scriptletCall of node.children) {
            if (scriptletCall.children.length === 0) {
                throw new Error(this.ERROR_MESSAGES.EMPTY_SCRIPTLET_CALL);
            }

            result.push(ParameterListParser.generate(scriptletCall, SPACE));
        }

        return result.join(SEMICOLON + SPACE);
    }
}
