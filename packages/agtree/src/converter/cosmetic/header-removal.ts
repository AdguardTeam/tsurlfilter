/**
 * @file Converter for request header removal rules
 */

import cloneDeep from 'clone-deep';
import { type FunctionNode, fromPlainObject } from '@adguard/ecss-tree';

import { RuleConversionError } from '../../errors/rule-conversion-error';
import {
    CosmeticRuleType,
    RuleCategory,
    type AnyRule,
    type NetworkRule,
} from '../../parser/common';
import { CssTreeNodeType } from '../../utils/csstree-constants';
import { RuleConverterBase } from '../base-interfaces/rule-converter-base';
import { createModifierListNode, createModifierNode } from '../../ast-utils/modifiers';
import { CssTree } from '../../utils/csstree';
import { EMPTY } from '../../utils/constants';
import { ADBLOCK_URL_SEPARATOR, ADBLOCK_URL_START } from '../../utils/regexp';
import { createNetworkRuleNode } from '../../ast-utils/network-rules';
import { AdblockSyntax } from '../../utils/adblockers';

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
     * @returns Array of converted rule nodes
     * @throws If the rule is invalid or cannot be converted
     */
    public static convertToAdg(rule: AnyRule): NetworkRule[] {
        // Clone the provided AST node to avoid side effects
        const ruleNode = cloneDeep(rule);

        // TODO: Add support for ABP syntax once it starts supporting header removal rules
        // Check the input rule
        if (
            ruleNode.category !== RuleCategory.Cosmetic
            || ruleNode.type !== CosmeticRuleType.HtmlFilteringRule
            || ruleNode.body.body.type !== CssTreeNodeType.Function
            || ruleNode.body.body.name !== UBO_RESPONSEHEADER_MARKER
        ) {
            throw new RuleConversionError('Not a response header rule');
        }

        // Prepare network rule pattern
        let pattern = EMPTY;

        if (ruleNode.domains.children.length === 1) {
            // If the rule has only one domain, we can use a simple network rule pattern:
            // ||single-domain-from-the-rule^
            pattern = [
                ADBLOCK_URL_START,
                ruleNode.domains.children[0].value,
                ADBLOCK_URL_SEPARATOR,
            ].join(EMPTY);
        } else if (ruleNode.domains.children.length > 1) {
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
                CssTree.generateFunctionValue(
                    fromPlainObject(ruleNode.body.body) as FunctionNode,
                ),
            ),
        );

        // Construct the network rule
        return [
            createNetworkRuleNode(
                pattern,
                modifiers,
                // Copy the exception flag
                ruleNode.exception,
                AdblockSyntax.Adg,
            ),
        ];
    }
}
