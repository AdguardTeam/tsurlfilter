/**
 * @file HTML filtering rule converter
 */

import { type SelectorPlain } from '@adguard/ecss-tree';
import cloneDeep from 'clone-deep';

import {
    CosmeticRuleSeparator,
    CosmeticRuleType,
    type HtmlFilteringRule,
    RuleCategory,
} from '../../parser/common';
import { AdblockSyntax } from '../../utils/adblockers';
import { CssTree } from '../../utils/csstree';
import { CssTreeNodeType } from '../../utils/csstree-constants';
import { RuleConversionError } from '../../errors/rule-conversion-error';
import { RuleConverterBase } from '../base-interfaces/rule-converter-base';
import { RegExpUtils } from '../../utils/regexp';

/**
 * From the AdGuard docs:
 * Specifies the maximum length for content of HTML element. If this parameter is
 * set and the content length exceeds the value, a rule does not apply to the element.
 * If this parameter is not specified, the max-length is considered to be 8192 (8 KB).
 * When converting from other formats, we set the max-length to 262144 (256 KB).
 *
 * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#html-filtering-rules}
 */
const ADGUARD_HTML_DEFAULT_MAX_LENGTH = 8192;
const ADGUARD_HTML_CONVERSION_MAX_LENGTH = ADGUARD_HTML_DEFAULT_MAX_LENGTH * 32;

const NOT_SPECIFIED = -1;

const CONTAINS = 'contains';
const HAS_TEXT = 'has-text';
const MAX_LENGTH = 'max-length';
const MIN_LENGTH = 'min-length';
const MIN_TEXT_LENGTH = 'min-text-length';
const TAG_CONTENT = 'tag-content';
const WILDCARD = 'wildcard';

/**
 * HTML filtering rule converter class
 *
 * @todo Implement `convertToUbo` (ABP currently doesn't support HTML filtering rules)
 */
export class HtmlRuleConverter extends RuleConverterBase {
    /**
     * Converts a HTML rule to AdGuard syntax, if possible. Also can be used to convert
     * AdGuard rules to AdGuard syntax to validate them.
     *
     * _Note:_ uBlock Origin supports multiple selectors within a single rule, but AdGuard doesn't,
     * so the following rule
     * ```
     * example.com##^div[attr1="value1"][attr2="value2"], script:has-text(value)
     * ```
     * will be converted to multiple AdGuard rules:
     * ```
     * example.com$$div[attr1="value1"][attr2="value2"][max-length="262144"]
     * example.com$$script[tag-content="value"][max-length="262144"]
     * ```
     *
     * @param rule Rule node to convert
     * @returns Array of converted rule nodes
     * @throws If the rule is invalid or cannot be converted
     */
    public static convertToAdg(rule: HtmlFilteringRule): HtmlFilteringRule[] {
        // Clone the provided AST node to avoid side effects
        const ruleNode = cloneDeep(rule);

        // Prepare the conversion result
        const conversionResult: HtmlFilteringRule[] = [];

        // Iterate over selector list
        for (const selector of ruleNode.body.body.children) {
            // Check selector, just in case
            if (selector.type !== CssTreeNodeType.Selector) {
                throw new RuleConversionError(`Expected selector, got '${selector.type}'`);
            }

            // At least one child is required, and first child may be a tag selector
            if (selector.children.length === 0) {
                throw new RuleConversionError('Invalid selector, no children are present');
            }

            // Prepare bounds
            let minLength = NOT_SPECIFIED;
            let maxLength = NOT_SPECIFIED;

            // Prepare the converted selector
            const convertedSelector: SelectorPlain = {
                type: CssTreeNodeType.Selector,
                children: [],
            };

            for (let i = 0; i < selector.children.length; i += 1) {
                // Current node within the current selector
                const node = selector.children[i];

                switch (node.type) {
                    case CssTreeNodeType.TypeSelector:
                        // First child in the selector may be a tag selector
                        if (i !== 0) {
                            throw new RuleConversionError('Tag selector should be the first child, if present');
                        }

                        // Simply store the tag selector
                        convertedSelector.children.push(cloneDeep(node));
                        break;

                    case CssTreeNodeType.AttributeSelector:
                        // Check if the attribute selector is a special AdGuard attribute
                        switch (node.name.name) {
                            case MIN_LENGTH:
                                minLength = CssTree.parseAttributeSelectorValueAsNumber(node);
                                break;

                            case MAX_LENGTH:
                                maxLength = CssTree.parseAttributeSelectorValueAsNumber(node);
                                break;

                            case TAG_CONTENT:
                            case WILDCARD:
                                CssTree.assertAttributeSelectorHasStringValue(node);
                                convertedSelector.children.push(cloneDeep(node));
                                break;

                            default:
                                convertedSelector.children.push(cloneDeep(node));
                        }

                        break;

                    case CssTreeNodeType.PseudoClassSelector:
                        CssTree.assertPseudoClassHasAnyArgument(node);

                        // eslint-disable-next-line no-case-declarations
                        const arg = node.children[0];

                        if (
                            arg.type !== CssTreeNodeType.String
                            && arg.type !== CssTreeNodeType.Raw
                            && arg.type !== CssTreeNodeType.Number
                        ) {
                            throw new RuleConversionError(
                                `Unsupported argument type '${arg.type}' for pseudo class '${node.name}'`,
                            );
                        }

                        // Process the pseudo class based on its name
                        switch (node.name) {
                            case HAS_TEXT:
                            case CONTAINS:
                                // Check if the argument is a RegExp
                                if (RegExpUtils.isRegexPattern(arg.value)) {
                                    // TODO: Add some support for RegExp patterns later
                                    // Need to find a way to convert some RegExp patterns to glob patterns
                                    throw new RuleConversionError('Conversion of RegExp patterns is not yet supported');
                                }

                                convertedSelector.children.push(
                                    CssTree.createAttributeSelectorNode(
                                        TAG_CONTENT,
                                        arg.value,
                                    ),
                                );

                                break;

                            // https://github.com/gorhill/uBlock/wiki/Procedural-cosmetic-filters#subjectmin-text-lengthn
                            case MIN_TEXT_LENGTH:
                                minLength = CssTree.parsePseudoClassArgumentAsNumber(node);
                                break;

                            default:
                                throw new RuleConversionError(`Unsupported pseudo class '${node.name}'`);
                        }

                        break;

                    default:
                        throw new RuleConversionError(`Unsupported node type '${node.type}'`);
                }
            }

            if (minLength !== NOT_SPECIFIED) {
                convertedSelector.children.push(
                    CssTree.createAttributeSelectorNode(
                        MIN_LENGTH,
                        String(minLength),
                    ),
                );
            }

            convertedSelector.children.push(
                CssTree.createAttributeSelectorNode(
                    MAX_LENGTH,
                    String(
                        maxLength === NOT_SPECIFIED
                            ? ADGUARD_HTML_CONVERSION_MAX_LENGTH
                            : maxLength,
                    ),
                ),
            );

            // Create the converted rule
            conversionResult.push({
                category: RuleCategory.Cosmetic,
                type: CosmeticRuleType.HtmlFilteringRule,
                syntax: AdblockSyntax.Adg,

                // Convert the separator based on the exception status
                separator: {
                    type: 'Value',
                    value: ruleNode.exception
                        ? CosmeticRuleSeparator.AdgHtmlFilteringException
                        : CosmeticRuleSeparator.AdgHtmlFiltering,
                },

                // Create the body based on the converted selector
                body: {
                    type: 'HtmlFilteringRuleBody',
                    body: {
                        type: CssTreeNodeType.SelectorList,
                        children: [{
                            type: CssTreeNodeType.Selector,
                            children: [convertedSelector],
                        }],
                    },
                },
                exception: ruleNode.exception,
                domains: ruleNode.domains,
            });
        }

        return conversionResult;
    }
}
