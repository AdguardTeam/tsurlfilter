/**
 * @file Converter for request header removal rules
 */

import { RuleConversionError } from '../../errors/rule-conversion-error';
import { CosmeticRuleType, RuleCategory, type AnyRule } from '../../parser/common';
import { CssTreeNodeType } from '../../utils/csstree-constants';
import { RuleConverterBase } from '../base-interfaces/rule-converter-base';
import { createModifierListNode, createModifierNode } from '../../ast-utils/modifiers';
import { CssTree } from '../../utils/csstree';
import { EMPTY } from '../../utils/constants';
import { ADBLOCK_URL_SEPARATOR, ADBLOCK_URL_START } from '../../utils/regexp';
import { createNetworkRuleNode } from '../../ast-utils/network-rules';
import { AdblockSyntax } from '../../utils/adblockers';
import { type NodeConversionResult, createNodeConversionResult } from '../base-interfaces/conversion-result';

export const UBO_RESPONSEHEADER_MARKER = 'responseheader';
const ADG_REMOVEHEADER_MODIFIER = 'removeheader';

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
        if (
            rule.category !== RuleCategory.Cosmetic
            || rule.type !== CosmeticRuleType.HtmlFilteringRule
            || rule.body.body.type !== CssTreeNodeType.Function
            || rule.body.body.name !== UBO_RESPONSEHEADER_MARKER
        ) {
            return createNodeConversionResult([rule], false);
        }

        // Prepare network rule pattern
        const pattern: string[] = [];

        if (rule.domains.children.length === 1) {
            // If the rule has only one domain, we can use a simple network rule pattern:
            // ||single-domain-from-the-rule^
            pattern.push(
                ADBLOCK_URL_START,
                rule.domains.children[0].value,
                ADBLOCK_URL_SEPARATOR,
            );
        } else if (rule.domains.children.length > 1) {
            // TODO: Add support for multiple domains, for example:
            // example.com,example.org,example.net##^responseheader(header-name)
            // We should consider allowing $domain with $removeheader modifier,
            // for example:
            // $removeheader=header-name,domain=example.com|example.org|example.net
            throw new RuleConversionError('Multiple domains are not supported yet');
        }

        // Prepare network rule modifiers
        const modifiers = createModifierListNode();

        modifiers.children.push(
            createModifierNode(
                ADG_REMOVEHEADER_MODIFIER,
                CssTree.generateFunctionPlainValue(rule.body.body),
            ),
        );

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
