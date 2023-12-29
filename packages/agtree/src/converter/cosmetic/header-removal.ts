/**
 * @file Converter for request header removal rules
 */

import { TokenType, getFormattedTokenName } from '@adguard/css-tokenizer';
import { sprintf } from 'sprintf-js';

import { RuleConversionError } from '../../errors/rule-conversion-error';
import { CosmeticRuleType, RuleCategory, type AnyRule } from '../../parser/common';
import { RuleConverterBase } from '../base-interfaces/rule-converter-base';
import { createModifierListNode, createModifierNode } from '../../ast-utils/modifiers';
import { EMPTY, UBO_HTML_MASK } from '../../utils/constants';
import { ADBLOCK_URL_SEPARATOR, ADBLOCK_URL_START } from '../../utils/regexp';
import { createNetworkRuleNode } from '../../ast-utils/network-rules';
import { AdblockSyntax } from '../../utils/adblockers';
import { type NodeConversionResult, createNodeConversionResult } from '../base-interfaces/conversion-result';
import { CssTokenStream } from '../../parser/css/css-token-stream';

const UBO_RESPONSEHEADER_FN = 'responseheader';
const ADG_REMOVEHEADER_MODIFIER = 'removeheader';

export const ERROR_MESSAGES = {
    EMPTY_PARAMETER: `Empty parameter for '${UBO_RESPONSEHEADER_FN}' function`,
    EXPECTED_END_OF_RULE: "Expected end of rule, but got '%s'",
    MULTIPLE_DOMAINS_NOT_SUPPORTED: 'Multiple domains are not supported yet',
};

/**
 * Converter for request header removal rules
 *
 * @todo Implement `convertToUbo` (ABP currently doesn't support header removal rules)
 */
export class HeaderRemovalRuleConverter extends RuleConverterBase {
    /**
     * Converts a header removal rule to AdGuard syntax, if possible.
     *
     * @param rule Rule node to convert
     * @returns An object which follows the {@link NodeConversionResult} interface. Its `result` property contains
     * the array of converted rule nodes, and its `isConverted` flag indicates whether the original rule was converted.
     * If the rule was not converted, the result array will contain the original node with the same object reference
     * @throws If the rule is invalid or cannot be converted
     * @example
     * If the input rule is:
     * ```adblock
     * example.com##^responseheader(header-name)
     * ```
     * The output will be:
     * ```adblock
     * ||example.com^$removeheader=header-name
     * ```
     */
    public static convertToAdg(rule: AnyRule): NodeConversionResult<AnyRule> {
        // TODO: Add support for ABP syntax once it starts supporting header removal rules
        // Leave the rule as is if it's not a header removal rule
        if (rule.category !== RuleCategory.Cosmetic || rule.type !== CosmeticRuleType.HtmlFilteringRule) {
            return createNodeConversionResult([rule], false);
        }

        const stream = new CssTokenStream(rule.body.value);
        let token;

        // Skip leading whitespace
        stream.skipWhitespace();

        // Next token should be the `^` followed by a `responseheader` function
        token = stream.get();

        if (!token || token.type !== TokenType.Delim || rule.body.value[token.start] !== UBO_HTML_MASK) {
            return createNodeConversionResult([rule], false);
        }

        stream.advance();
        token = stream.get();

        if (!token) {
            return createNodeConversionResult([rule], false);
        }

        const functionName = rule.body.value.slice(token.start, token.end - 1);

        if (functionName !== UBO_RESPONSEHEADER_FN) {
            return createNodeConversionResult([rule], false);
        }

        // Parse the parameter
        const paramStart = token.end;
        stream.skipUntilBalanced();
        const paramEnd = stream.getOrFail().end;
        const param = rule.body.value.slice(paramStart, paramEnd - 1).trim();

        // Do not allow empty parameter
        if (param.length === 0) {
            throw new RuleConversionError(ERROR_MESSAGES.EMPTY_PARAMETER);
        }

        stream.expect(TokenType.CloseParenthesis);
        stream.advance();

        // Skip trailing whitespace after the function call
        stream.skipWhitespace();

        // Expect the end of the rule - so nothing should be left in the stream
        if (!stream.isEof()) {
            token = stream.getOrFail();
            throw new RuleConversionError(
                sprintf(ERROR_MESSAGES.EXPECTED_END_OF_RULE, getFormattedTokenName(token.type)),
            );
        }

        // Prepare network rule pattern
        const pattern: string[] = [];

        if (rule.domains.children.length === 1) {
            // If the rule has only one domain, we can use a simple network rule pattern:
            // ||single-domain-from-the-rule^
            pattern.push(ADBLOCK_URL_START, rule.domains.children[0].value, ADBLOCK_URL_SEPARATOR);
        } else if (rule.domains.children.length > 1) {
            // TODO: Add support for multiple domains, for example:
            // example.com,example.org,example.net##^responseheader(header-name)
            // We should consider allowing $domain with $removeheader modifier,
            // for example:
            // $removeheader=header-name,domain=example.com|example.org|example.net
            throw new RuleConversionError(ERROR_MESSAGES.MULTIPLE_DOMAINS_NOT_SUPPORTED);
        }

        // Prepare network rule modifiers
        const modifiers = createModifierListNode();

        modifiers.children.push(createModifierNode(ADG_REMOVEHEADER_MODIFIER, param));

        // Construct the network rule
        return createNodeConversionResult(
            [
                createNetworkRuleNode(
                    pattern.join(EMPTY),
                    modifiers,
                    // Copy the exception flag
                    rule.exception,
                    AdblockSyntax.Adg,
                ),
            ],
            true,
        );
    }
}
