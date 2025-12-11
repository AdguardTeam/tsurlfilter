/**
 * @file HTML filtering rule converter
 */

import { sprintf } from 'sprintf-js';

import {
    CosmeticRuleSeparator,
    CosmeticRuleType,
    type HtmlFilteringRule,
    type CssAttributeSelector,
    type CssPseudoClassSelector,
    type CssSimpleSelector,
    type CssComplexSelectorItem,
    type CssComplexSelector,
    RuleCategory,
} from '../../nodes';
import { AdblockSyntax } from '../../utils/adblockers';
import { RuleConversionError } from '../../errors/rule-conversion-error';
import { RuleConverterBase } from '../base-interfaces/rule-converter-base';
import { type NodeConversionResult, createNodeConversionResult } from '../base-interfaces/conversion-result';
import { cloneDomainListNode } from '../../ast-utils/clone';
import { EMPTY, EQUALS } from '../../utils/constants';
import { QuoteUtils } from '../../utils';

/**
 * From the AdGuard docs:
 * Specifies the maximum length for content of HTML element. If this parameter is
 * set and the content length exceeds the value, a rule does not apply to the element.
 * If this parameter is not specified, the max-length is considered to be 8192 (8 KB).
 * When converting from other formats, we set the max-length to 262144 (256 KB).
 *
 * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#html-filtering-rules}
 */
const ADG_HTML_DEFAULT_MAX_LENGTH = 8192;
const ADG_HTML_CONVERSION_MAX_LENGTH = ADG_HTML_DEFAULT_MAX_LENGTH * 32;

/**
 * Supported special pseudo-classes from uBlock.
 */
enum UboPseudoClasses {
    HasText = 'has-text',
    MinTextLength = 'min-text-length',
}

/**
 * Supported special attribute selectors from AdGuard.
 */
enum AdgAttributeSelectors {
    MaxLength = 'max-length',
    MinLength = 'min-length',
    TagContent = 'tag-content',
    Wildcard = 'wildcard',
}

/**
 * Supported special pseudo-classes from AdGuard.
 */
enum AdgPseudoClasses {
    Contains = 'contains',
}

/**
 * Set of {@link UboPseudoClasses}.
 */
const SUPPORTED_UBO_PSEUDO_CLASSES = new Set<string>([
    UboPseudoClasses.HasText,
    UboPseudoClasses.MinTextLength,
]);

/**
 * Set of {@link AdgAttributeSelectors}.
 */
const SUPPORTED_ADG_ATTRIBUTE_SELECTORS = new Set<string>([
    AdgAttributeSelectors.MaxLength,
    AdgAttributeSelectors.MinLength,
    AdgAttributeSelectors.TagContent,
    AdgAttributeSelectors.Wildcard,
]);

/**
 * Set of {@link AdgPseudoClasses}.
 */
const SUPPORTED_ADG_PSEUDO_CLASSES = new Set<string>([
    AdgPseudoClasses.Contains,
]);

/**
 * Error messages used in HTML filtering rule conversion.
 */
/* eslint-disable max-len */
export const ERROR_MESSAGES = {
    ABP_NOT_SUPPORTED: 'Invalid rule, ABP does not support HTML filtering rules',
    INVALID_RULE: 'Invalid HTML filtering rule: %s',

    EMPTY_SELECTOR_LIST: 'Selector list of HTML filtering rule must not be empty',
    EMPTY_COMPLEX_SELECTOR: 'Complex selector of selector list must not be empty',
    EMPTY_COMPOUND_SELECTOR: 'Compound selector of complex selector item must not be empty',

    FIRST_COMPLEX_SELECTOR_ITEM_WITH_COMBINATOR: 'First complex selector item cannot start with a combinator',
    MISSING_COMBINATOR_BETWEEN_COMPLEX_SELECTOR_ITEMS: 'Missing combinator between complex selector items',
    SPECIALS_ONLY_SELECTOR: 'Compound selector cannot contain only special simple selectors',

    SPECIAL_ATTRIBUTE_SELECTOR_OPERATOR_INVALID: 'Special attribute selector \'%s\' has invalid operator \'%s\'',
    SPECIAL_ATTRIBUTE_SELECTOR_FLAG_NOT_SUPPORTED: 'Special attribute selector \'%s\' does not support flags',
    SPECIAL_ATTRIBUTE_SELECTOR_VALUE_REQUIRED: 'Special attribute selector \'%s\' requires a value',
    SPECIAL_ATTRIBUTE_SELECTOR_VALUE_INT: 'Value of special attribute selector \'%s\' must be an integer, got \'%s\'',
    SPECIAL_ATTRIBUTE_SELECTOR_VALUE_POSITIVE: 'Value of special attribute selector \'%s\' must be a positive integer, got \'%s\'',
    SPECIAL_ATTRIBUTE_SELECTOR_NOT_SUPPORTED: 'Special attribute selector \'%s\' is not supported in conversion',

    SPECIAL_PSEUDO_CLASS_SELECTOR_ARGUMENT_REQUIRED: 'Special pseudo-class selector \'%s\' requires an argument',
    SPECIAL_PSEUDO_CLASS_SELECTOR_ARGUMENT_INT: 'Argument of special pseudo-class selector \'%s\' must be an integer, got \'%s\'',
    SPECIAL_PSEUDO_CLASS_SELECTOR_ARGUMENT_POSITIVE: 'Argument of special pseudo-class selector \'%s\' must be a positive integer, got \'%s\'',
    SPECIAL_PSEUDO_CLASS_SELECTOR_NOT_SUPPORTED: 'Special pseudo-class selector \'%s\' is not supported in conversion',
} as const;
/* eslint-enable max-len */

/**
 * HTML filtering rule converter class
 *
 * @todo Implement `convertToUbo` (ABP currently doesn't support HTML filtering rules)
 */
export class HtmlRuleConverter extends RuleConverterBase {
    /**
     * Converts a HTML rule to AdGuard syntax, if possible.
     * Also can be used to convert AdGuard rules to AdGuard syntax to validate them.
     *
     * @param rule Rule node to convert.
     *
     * @returns An object which follows the {@link NodeConversionResult} interface. Its `result` property contains
     * the array of converted rule nodes, and its `isConverted` flag indicates whether the original rule was converted.
     * If the rule was not converted, the result array will contain the original node with the same object reference.
     *
     * @throws If the rule is invalid or cannot be converted.
     */
    public static convertToAdg(rule: HtmlFilteringRule): NodeConversionResult<HtmlFilteringRule> {
        // Ignore AdGuard rules
        if (rule.syntax === AdblockSyntax.Adg) {
            return createNodeConversionResult([rule], false);
        }

        if (rule.syntax === AdblockSyntax.Abp) {
            throw new RuleConversionError(ERROR_MESSAGES.ABP_NOT_SUPPORTED);
        }

        const { children: complexSelectors } = rule.body.selectorList;

        // Selector list node must not be empty
        HtmlRuleConverter.assertNotEmpty(complexSelectors, ERROR_MESSAGES.EMPTY_SELECTOR_LIST);

        // Convert each complex selector
        const convertedComplexSelectors: CssComplexSelector[] = [];
        for (const { children: complexSelectorItems } of complexSelectors) {
            // Complex selector node must not be empty
            HtmlRuleConverter.assertNotEmpty(complexSelectorItems, ERROR_MESSAGES.EMPTY_COMPLEX_SELECTOR);

            // Convert each complex selector item
            const convertedComplexSelectorItems: CssComplexSelectorItem[] = [];
            for (let i = 0; i < complexSelectorItems.length; i += 1) {
                const complexSelectorItem = complexSelectorItems[i];

                // Validate complex selector item
                HtmlRuleConverter.assertValidComplexSelectorItem(i, complexSelectorItem);

                const { selector: compoundSelector, combinator } = complexSelectorItem;
                const { children: simpleSelectors } = compoundSelector;

                const convertedAttributeSelectors = new Map<AdgAttributeSelectors, string>();
                const convertedPseudoClassSelectors = new Map<AdgPseudoClasses, string>();

                /**
                 * Keep track of present special pseudo-class selectors to lower ambiguity
                 * of AdGuard-specific attribute selectors, since they are deprecated and soon will be removed.
                 * - If `:min-text-length()` is present, `[min-length]` attribute selector is ignored.
                 * - If `:has-text()` / `:contains()` is present, `[tag-content]` attribute selector is ignored.
                 */
                const presentPseudoClassSelectors = new Set<AdgPseudoClasses | UboPseudoClasses>();

                /**
                 * Keep track of the number of special simple selectors found in the compound selector.
                 * If compound selector contains only special simple selectors, it means it didn't have
                 * any real simple selector, so we can throw an error in this case.
                 */
                let specialSimpleSelectors = 0;

                // Convert each simple selector
                const convertedSimpleSelectors: CssSimpleSelector[] = [];
                for (const simpleSelector of simpleSelectors) {
                    if (
                        simpleSelector.type === 'CssAttributeSelector'
                        && HtmlRuleConverter.isSpecialAdgAttributeSelector(simpleSelector)
                    ) {
                        /**
                         * Handle AdGuard-specific attribute selectors.
                         * Please, note that AdGuard-specific attribute selectors
                         * shouldn't be specified in uBlock rules in the first place,
                         * but we still handle them here for completeness and de-duplication.
                         */
                        specialSimpleSelectors += 1;

                        // Validate special attribute selector
                        HtmlRuleConverter.assertValidSpecialAttributeSelector(simpleSelector);

                        const name = simpleSelector.name.value;

                        // Note, it's safe to assert that value node is not null,
                        // because it's validated inside `assertValidSpecialAttributeSelector`
                        const { value } = simpleSelector.value!.value;

                        /**
                         * Record found special attribute selectors in case
                         * if there are same functional special pseudo-class selectors
                         * in the same compound selector:
                         * - `[min-length]` attribute selector and `:min-text-length()` pseudo-class selector
                         * - `[tag-content]` attribute selector and `:has-text()` / `:contains()` pseudo-class selector
                         * - `max-length` is special case, because there's no corresponding pseudo-class selector,
                         *   but if it's not specified we set it to the default conversion value.
                         */
                        if (name === AdgAttributeSelectors.MinLength || name === AdgAttributeSelectors.MaxLength) {
                            // Validate numeric value
                            HtmlRuleConverter.assertValidLengthValue(
                                name,
                                value,
                                ERROR_MESSAGES.SPECIAL_ATTRIBUTE_SELECTOR_VALUE_INT,
                                ERROR_MESSAGES.SPECIAL_ATTRIBUTE_SELECTOR_VALUE_POSITIVE,
                            );

                            if (name === AdgAttributeSelectors.MinLength) {
                                if (!presentPseudoClassSelectors.has(UboPseudoClasses.MinTextLength)) {
                                    convertedAttributeSelectors.set(AdgAttributeSelectors.MinLength, value);
                                }
                            } else {
                                convertedAttributeSelectors.set(AdgAttributeSelectors.MaxLength, value);
                            }
                            continue;
                        } else if (name === AdgAttributeSelectors.TagContent) {
                            if (
                                !presentPseudoClassSelectors.has(UboPseudoClasses.HasText)
                                && !presentPseudoClassSelectors.has(AdgPseudoClasses.Contains)
                            ) {
                                convertedPseudoClassSelectors.set(AdgPseudoClasses.Contains, value);
                            }
                            continue;
                        }
                    } else if (
                        simpleSelector.type === 'CssPseudoClassSelector'
                        && (
                            HtmlRuleConverter.isSpecialUboPseudoClassSelector(simpleSelector)
                            || HtmlRuleConverter.isSpecialAdgPseudoClassSelector(simpleSelector)
                        )
                    ) {
                        /**
                         * Handle uBlock-specific pseudo-class selectors:
                         * - `:has-text()` -> `:contains()`
                         * - `:min-text-length()` -> `[min-length]`
                         *
                         * Also handle AdGuard-specific pseudo-class selectors.
                         * Please, note that AdGuard-specific pseudo-class selectors
                         * shouldn't be specified in uBlock rules in the first place,
                         * but we still handle them here for completeness and de-duplication.
                         */
                        specialSimpleSelectors += 1;

                        // Validate special pseudo-class
                        HtmlRuleConverter.assertValidSpecialPseudoClassSelector(simpleSelector);

                        const name = simpleSelector.name.value;

                        // Note, it's safe to assert that argument node is not null,
                        // because it's validated inside `assertValidSpecialPseudoClassSelector`
                        let argument = simpleSelector.argument!.value;

                        if (name === UboPseudoClasses.MinTextLength) {
                            // Unescape and remove quotes from argument only
                            // if it's needs to be converted into attribute selector value
                            argument = QuoteUtils.removeQuotesAndUnescape(argument);

                            HtmlRuleConverter.assertValidLengthValue(
                                name,
                                argument,
                                ERROR_MESSAGES.SPECIAL_PSEUDO_CLASS_SELECTOR_ARGUMENT_INT,
                                ERROR_MESSAGES.SPECIAL_PSEUDO_CLASS_SELECTOR_ARGUMENT_POSITIVE,
                            );

                            presentPseudoClassSelectors.add(name);
                            convertedAttributeSelectors.set(AdgAttributeSelectors.MinLength, argument);
                            continue;
                        } else if (
                            name === UboPseudoClasses.HasText
                            || name === AdgPseudoClasses.Contains
                        ) {
                            presentPseudoClassSelectors.add(name);
                            convertedPseudoClassSelectors.set(AdgPseudoClasses.Contains, argument);
                            continue;
                        }

                        // Throw an error if the uBlock-specific pseudo-class selector cannot be converted
                        if (HtmlRuleConverter.isSpecialUboPseudoClassSelector(simpleSelector)) {
                            throw new RuleConversionError(sprintf(
                                ERROR_MESSAGES.SPECIAL_PSEUDO_CLASS_SELECTOR_NOT_SUPPORTED,
                                name,
                            ));
                        }
                    }

                    convertedSimpleSelectors.push(
                        HtmlRuleConverter.cloneCssSimpleSelector(simpleSelector),
                    );
                }

                // Throw an error if compound selector contains only special simple selectors
                if (specialSimpleSelectors === simpleSelectors.length) {
                    throw new RuleConversionError(ERROR_MESSAGES.SPECIALS_ONLY_SELECTOR);
                }

                // Add converted special attribute selectors
                for (const [name, value] of convertedAttributeSelectors) {
                    convertedSimpleSelectors.push(
                        HtmlRuleConverter.getCssAttributeSelectorNode(
                            name,
                            value,
                        ),
                    );
                }

                // If `[max-length]` was not specified, set it to the conversion default
                if (!convertedAttributeSelectors.has(AdgAttributeSelectors.MaxLength)) {
                    convertedSimpleSelectors.push(
                        HtmlRuleConverter.getCssAttributeSelectorNode(
                            AdgAttributeSelectors.MaxLength,
                            String(ADG_HTML_CONVERSION_MAX_LENGTH),
                        ),
                    );
                }

                // Add converted special pseudo-class selectors
                for (const [name, argument] of convertedPseudoClassSelectors) {
                    convertedSimpleSelectors.push(
                        HtmlRuleConverter.getPseudoClassSelectorNode(
                            name,
                            argument,
                        ),
                    );
                }

                convertedComplexSelectorItems.push({
                    type: 'CssComplexSelectorItem',
                    selector: {
                        type: 'CssCompoundSelector',
                        children: convertedSimpleSelectors,
                    },
                    combinator: combinator ? {
                        type: 'Value',
                        value: combinator.value,
                    } : undefined,
                });
            }

            convertedComplexSelectors.push({
                type: 'CssComplexSelector',
                children: convertedComplexSelectorItems,
            });
        }

        return createNodeConversionResult(
            [{
                category: RuleCategory.Cosmetic,
                type: CosmeticRuleType.HtmlFilteringRule,
                syntax: AdblockSyntax.Adg,

                exception: rule.exception,
                domains: cloneDomainListNode(rule.domains),

                // Convert the separator based on the exception status
                separator: {
                    type: 'Value',
                    value: rule.exception
                        ? CosmeticRuleSeparator.AdgHtmlFilteringException
                        : CosmeticRuleSeparator.AdgHtmlFiltering,
                },

                body: {
                    type: 'HtmlFilteringRuleBody',
                    selectorList: {
                        type: 'CssSelectorList',
                        children: convertedComplexSelectors,
                    },
                },
            }],
            true,
        );
    }

    /**
     * Converts a HTML rule to uBlock syntax, if possible.
     * Also can be used to convert uBlock rules to uBlock syntax to validate them.
     *
     * @param rule Rule node to convert.
     *
     * @returns An object which follows the {@link NodeConversionResult} interface. Its `result` property contains
     * the array of converted rule nodes, and its `isConverted` flag indicates whether the original rule was converted.
     * If the rule was not converted, the result array will contain the original node with the same object reference.
     *
     * @throws Error if the rule is invalid or cannot be converted.
     */
    public static convertToUbo(rule: HtmlFilteringRule): NodeConversionResult<HtmlFilteringRule> {
        // Ignore uBlock rules
        if (rule.syntax === AdblockSyntax.Ubo) {
            return createNodeConversionResult([rule], false);
        }

        if (rule.syntax === AdblockSyntax.Abp) {
            throw new RuleConversionError(ERROR_MESSAGES.ABP_NOT_SUPPORTED);
        }

        const { children: complexSelectors } = rule.body.selectorList;

        // Selector list node must not be empty
        HtmlRuleConverter.assertNotEmpty(complexSelectors, ERROR_MESSAGES.EMPTY_SELECTOR_LIST);

        // Convert each complex selector
        const convertedComplexSelectors: CssComplexSelector[] = [];
        for (const { children: complexSelectorItems } of complexSelectors) {
            // Complex selector node must not be empty
            HtmlRuleConverter.assertNotEmpty(complexSelectorItems, ERROR_MESSAGES.EMPTY_COMPLEX_SELECTOR);

            // Convert each complex selector item
            const convertedComplexSelectorItems: CssComplexSelectorItem[] = [];
            for (let i = 0; i < complexSelectorItems.length; i += 1) {
                const complexSelectorItem = complexSelectorItems[i];

                // Validate complex selector item
                HtmlRuleConverter.assertValidComplexSelectorItem(i, complexSelectorItem);

                const { selector: compoundSelector, combinator } = complexSelectorItem;
                const { children: simpleSelectors } = compoundSelector;

                const convertedPseudoClassSelectors = new Map<UboPseudoClasses, string>();

                /**
                 * Keep track of present special pseudo-class selectors to lower ambiguity
                 * of AdGuard-specific attribute selectors, since they are deprecated and soon will be removed.
                 * - If `:min-text-length()` is present, `[min-length]` attribute selector is ignored.
                 * - If `:has-text()` / `:contains()` is present, `[tag-content]` attribute selector is ignored.
                 */
                const presentPseudoClassSelectors = new Set<AdgPseudoClasses | UboPseudoClasses>();

                /**
                 * Keep track of the number of special simple selectors found in the compound selector.
                 * If compound selector contains only special simple selectors, it means it didn't have
                 * any real simple selector, so we can throw an error in this case.
                 */
                let specialSimpleSelectors = 0;

                // Convert each simple selector
                const convertedSimpleSelectors: CssSimpleSelector[] = [];
                for (const simpleSelector of simpleSelectors) {
                    if (
                        simpleSelector.type === 'CssPseudoClassSelector'
                        && (
                            HtmlRuleConverter.isSpecialUboPseudoClassSelector(simpleSelector)
                            || HtmlRuleConverter.isSpecialAdgPseudoClassSelector(simpleSelector)
                        )
                    ) {
                        /**
                         * Handle uBlock-specific pseudo-class selectors.
                         * Please, note that uBlock-specific pseudo-class selectors
                         * shouldn't be specified in AdGuard rules in the first place,
                         * but we still handle them here for completeness and de-duplication.
                         */
                        specialSimpleSelectors += 1;

                        // Validate special pseudo-class selector
                        HtmlRuleConverter.assertValidSpecialPseudoClassSelector(simpleSelector);

                        const name = simpleSelector.name.value;

                        // Note, it's safe to assert that argument node is not null,
                        // because it's validated inside `assertValidSpecialPseudoClassSelector`
                        const argument = simpleSelector.argument!.value;

                        /**
                         * Record found special pseudo-class selectors in case
                         * if there are same functional special attribute selectors
                         * in the same compound selector:
                         * - `:min-text-length()` pseudo-class selector and `[min-length]` attribute selector
                         * - `:has-text()` / `:contains()` pseudo-class selector and `[tag-content]` attribute selector
                         */
                        if (name === UboPseudoClasses.MinTextLength) {
                            HtmlRuleConverter.assertValidLengthValue(
                                name,
                                // Unescape and remove quotes from argument to validate it correctly
                                QuoteUtils.removeQuotesAndUnescape(argument),
                                ERROR_MESSAGES.SPECIAL_PSEUDO_CLASS_SELECTOR_ARGUMENT_INT,
                                ERROR_MESSAGES.SPECIAL_PSEUDO_CLASS_SELECTOR_ARGUMENT_POSITIVE,
                            );

                            presentPseudoClassSelectors.add(name);
                            convertedPseudoClassSelectors.set(UboPseudoClasses.MinTextLength, argument);
                            continue;
                        } else if (
                            name === UboPseudoClasses.HasText
                            || name === AdgPseudoClasses.Contains
                        ) {
                            presentPseudoClassSelectors.add(name);
                            convertedPseudoClassSelectors.set(UboPseudoClasses.HasText, argument);
                            continue;
                        }

                        // Throw an error if the AdGuard-specific pseudo-class selector cannot be converted
                        if (HtmlRuleConverter.isSpecialAdgPseudoClassSelector(simpleSelector)) {
                            throw new RuleConversionError(sprintf(
                                ERROR_MESSAGES.SPECIAL_PSEUDO_CLASS_SELECTOR_NOT_SUPPORTED,
                                name,
                            ));
                        }
                    } else if (
                        simpleSelector.type === 'CssAttributeSelector'
                        && HtmlRuleConverter.isSpecialAdgAttributeSelector(simpleSelector)
                    ) {
                        /**
                         * Handle AdGuard-specific attribute selectors:
                         * - `[tag-content]` -> `:has-text()`
                         * - `[min-length]` -> `:min-text-length()`
                         * - `[max-length]` is special case, we just ignore it during conversion
                         */
                        specialSimpleSelectors += 1;

                        // Validate special attribute selector
                        HtmlRuleConverter.assertValidSpecialAttributeSelector(simpleSelector);

                        const name = simpleSelector.name.value;

                        // Note, it's safe to assert that value node is not null,
                        // because it's validated inside `assertValidSpecialAttributeSelector`
                        const { value } = simpleSelector.value!.value;

                        if (
                            name === AdgAttributeSelectors.MinLength
                            || name === AdgAttributeSelectors.MaxLength
                        ) {
                            HtmlRuleConverter.assertValidLengthValue(
                                name,
                                value,
                                ERROR_MESSAGES.SPECIAL_ATTRIBUTE_SELECTOR_VALUE_INT,
                                ERROR_MESSAGES.SPECIAL_ATTRIBUTE_SELECTOR_VALUE_POSITIVE,
                            );

                            if (
                                name === AdgAttributeSelectors.MinLength
                                && !presentPseudoClassSelectors.has(UboPseudoClasses.MinTextLength)
                            ) {
                                convertedPseudoClassSelectors.set(UboPseudoClasses.MinTextLength, value);
                            }

                            continue;
                        } else if (name === AdgAttributeSelectors.TagContent) {
                            if (
                                !presentPseudoClassSelectors.has(UboPseudoClasses.HasText)
                                && !presentPseudoClassSelectors.has(AdgPseudoClasses.Contains)
                            ) {
                                convertedPseudoClassSelectors.set(UboPseudoClasses.HasText, value);
                            }

                            continue;
                        }

                        // Throw an error if the attribute selector cannot be converted
                        throw new RuleConversionError(sprintf(
                            ERROR_MESSAGES.SPECIAL_ATTRIBUTE_SELECTOR_NOT_SUPPORTED,
                            name,
                        ));
                    }

                    convertedSimpleSelectors.push(
                        HtmlRuleConverter.cloneCssSimpleSelector(simpleSelector),
                    );
                }

                // Throw an error if selector contains only special parts
                if (specialSimpleSelectors === simpleSelectors.length) {
                    throw new RuleConversionError(ERROR_MESSAGES.SPECIALS_ONLY_SELECTOR);
                }

                // Add converted special pseudo-classes
                for (const [name, argument] of convertedPseudoClassSelectors) {
                    convertedSimpleSelectors.push(
                        HtmlRuleConverter.getPseudoClassSelectorNode(
                            name,
                            argument,
                        ),
                    );
                }

                convertedComplexSelectorItems.push({
                    type: 'CssComplexSelectorItem',
                    selector: {
                        type: 'CssCompoundSelector',
                        children: convertedSimpleSelectors,
                    },
                    combinator: combinator ? {
                        type: 'Value',
                        value: combinator.value,
                    } : undefined,
                });
            }

            convertedComplexSelectors.push({
                type: 'CssComplexSelector',
                children: convertedComplexSelectorItems,
            });
        }

        return createNodeConversionResult(
            [{
                category: RuleCategory.Cosmetic,
                type: CosmeticRuleType.HtmlFilteringRule,
                syntax: AdblockSyntax.Ubo,

                exception: rule.exception,
                domains: cloneDomainListNode(rule.domains),

                separator: {
                    type: 'Value',
                    value: rule.exception
                        ? CosmeticRuleSeparator.UboHtmlFilteringException
                        : CosmeticRuleSeparator.UboHtmlFiltering,
                },

                body: {
                    type: 'HtmlFilteringRuleBody',
                    selectorList: {
                        type: 'CssSelectorList',
                        children: convertedComplexSelectors,
                    },
                },
            }],
            true,
        );
    }

    /**
     * Checks whether the given attribute selector is a special AdGuard attribute selector.
     *
     * @param attributeSelector Attribute selector to check.
     *
     * @returns True if the attribute selector is a special AdGuard attribute selector, false otherwise.
     */
    private static isSpecialAdgAttributeSelector(attributeSelector: CssAttributeSelector): boolean {
        return SUPPORTED_ADG_ATTRIBUTE_SELECTORS.has(attributeSelector.name.value);
    }

    /**
     * Checks whether the given pseudo-class selector is a special AdGuard pseudo-class selector.
     *
     * @param pseudoClassSelector Pseudo-class selector to check.
     *
     * @returns True if the pseudo-class selector is a special AdGuard pseudo-class selector, false otherwise.
     */
    private static isSpecialAdgPseudoClassSelector(pseudoClassSelector: CssPseudoClassSelector): boolean {
        return SUPPORTED_ADG_PSEUDO_CLASSES.has(pseudoClassSelector.name.value);
    }

    /**
     * Checks whether the given pseudo-class selector is a special uBlock pseudo-class selector.
     *
     * @param pseudoClassSelector Pseudo-class selector to check.
     *
     * @returns True if the pseudo-class selector is a special uBlock pseudo-class selector, false otherwise.
     */
    private static isSpecialUboPseudoClassSelector(pseudoClassSelector: CssPseudoClassSelector): boolean {
        return SUPPORTED_UBO_PSEUDO_CLASSES.has(pseudoClassSelector.name.value);
    }

    /**
     * Constructs a CSS attribute selector node.
     *
     * @param name Name of the attribute selector.
     * @param value Value of the attribute selector.
     *
     * @returns Constructed attribute selector node.
     */
    private static getCssAttributeSelectorNode(name: string, value: string): CssAttributeSelector {
        return {
            type: 'CssAttributeSelector',
            name: {
                type: 'Value',
                value: name,
            },
            value: {
                type: 'CssAttributeSelectorValue',
                value: {
                    type: 'Value',
                    value,
                },
                operator: {
                    type: 'Value',
                    value: EQUALS,
                },
            },
        };
    }

    /**
     * Constructs a CSS pseudo-class selector node.
     *
     * @param name Name of the pseudo-class selector.
     * @param argument Argument of the pseudo-class selector.
     *
     * @returns Constructed pseudo-class selector node.
     */
    private static getPseudoClassSelectorNode(name: string, argument: string): CssPseudoClassSelector {
        return {
            type: 'CssPseudoClassSelector',
            name: {
                type: 'Value',
                value: name,
            },
            argument: {
                type: 'Value',
                value: argument,
            },
        };
    }

    /**
     * Clones a CSS simple selector node.
     *
     * @param node Node to clone.
     *
     * @returns Cloned node.
     *
     * @throws Error if the node type is unknown.
     */
    private static cloneCssSimpleSelector(node: CssSimpleSelector): CssSimpleSelector {
        const { type } = node;
        switch (type) {
            case 'Value':
                return {
                    type: 'Value',
                    value: node.value,
                };

            case 'CssAttributeSelector':
                return {
                    type: 'CssAttributeSelector',
                    name: {
                        type: 'Value',
                        value: node.name.value,
                    },
                    value: node.value ? {
                        type: 'CssAttributeSelectorValue',
                        operator: {
                            type: 'Value',
                            value: node.value.operator.value,
                        },
                        value: {
                            type: 'Value',
                            value: node.value.value.value,
                        },
                        isCaseSensitive: node.value.isCaseSensitive,
                    } : undefined,
                };

            case 'CssPseudoClassSelector':
                return {
                    type: 'CssPseudoClassSelector',
                    name: {
                        type: 'Value',
                        value: node.name.value,
                    },
                    argument: node.argument ? {
                        type: 'Value',
                        value: node.argument.value,
                    } : undefined,
                };

            default:
                throw new Error(`Unknown HtmlFilteringRuleSelectorPart type: ${type}`);
        }
    }

    /**
     * Asserts that the given array is not empty.
     *
     * @param array Array to check.
     * @param errorMessage Error message to use if the array is empty.
     *
     * @throws If the array is empty.
     */
    private static assertNotEmpty<T extends object>(array: T[], errorMessage: string): void {
        if (array.length === 0) {
            throw new RuleConversionError(sprintf(
                ERROR_MESSAGES.INVALID_RULE,
                errorMessage,
            ));
        }
    }

    /**
     * Asserts that the given complex selector item is valid.
     *
     * @param index Index of the complex selector item in the complex selector.
     * @param complexSelectorItem Complex selector item to check.
     *
     * @throws If the compound selector inside of complex selector item is empty or has invalid combinator usage.
     */
    private static assertValidComplexSelectorItem(index: number, complexSelectorItem: CssComplexSelectorItem): void {
        HtmlRuleConverter.assertNotEmpty(
            complexSelectorItem.selector.children,
            ERROR_MESSAGES.EMPTY_COMPOUND_SELECTOR,
        );

        // Throw if this is the first complex selector item and it has a combinator
        if (index === 0 && complexSelectorItem.combinator) {
            throw new RuleConversionError(sprintf(
                ERROR_MESSAGES.INVALID_RULE,
                ERROR_MESSAGES.FIRST_COMPLEX_SELECTOR_ITEM_WITH_COMBINATOR,
            ));
        }

        // Throw if combinator is missing between complex selector items
        if (index > 0 && !complexSelectorItem.combinator) {
            throw new RuleConversionError(sprintf(
                ERROR_MESSAGES.INVALID_RULE,
                ERROR_MESSAGES.MISSING_COMBINATOR_BETWEEN_COMPLEX_SELECTOR_ITEMS,
            ));
        }
    }

    /**
     * Asserts that the given attribute selector is a valid special attribute selector.
     *
     * @param attributeSelector Attribute selector to check.
     *
     * @throws If attribute selector is not valid special attribute selector.
     */
    private static assertValidSpecialAttributeSelector(attributeSelector: CssAttributeSelector): void {
        // Throw an error if value is missing
        if (!attributeSelector.value) {
            throw new RuleConversionError(sprintf(
                ERROR_MESSAGES.SPECIAL_ATTRIBUTE_SELECTOR_VALUE_REQUIRED,
                attributeSelector.name.value,
            ));
        }

        // Throw an error if operator is not '='
        if (attributeSelector.value.operator.value !== EQUALS) {
            throw new RuleConversionError(sprintf(
                ERROR_MESSAGES.SPECIAL_ATTRIBUTE_SELECTOR_OPERATOR_INVALID,
                attributeSelector.name.value,
                attributeSelector.value.operator.value,
            ));
        }

        // Throw an error if flag is specified
        if (attributeSelector.value.isCaseSensitive !== undefined) {
            throw new RuleConversionError(sprintf(
                ERROR_MESSAGES.SPECIAL_ATTRIBUTE_SELECTOR_FLAG_NOT_SUPPORTED,
                attributeSelector.name.value,
            ));
        }
    }

    /**
     * Asserts that the given pseudo-class selector is a valid special pseudo-class selector.
     *
     * @param pseudoClassSelector Pseudo-class selector to check.
     *
     * @throws If pseudo-class selector is not valid special pseudo-class selector.
     */
    private static assertValidSpecialPseudoClassSelector(pseudoClassSelector: CssPseudoClassSelector): void {
        // Throw an error if argument is missing
        if (!pseudoClassSelector.argument || pseudoClassSelector.argument.value === EMPTY) {
            throw new RuleConversionError(sprintf(
                ERROR_MESSAGES.SPECIAL_PSEUDO_CLASS_SELECTOR_ARGUMENT_REQUIRED,
                pseudoClassSelector.name.value,
            ));
        }
    }

    /**
     * Asserts that the given special attribute / pseudo-class length value is valid.
     *
     * @param name Name of the attribute or pseudo-class.
     * @param value Value to parse.
     * @param notIntErrorMessage Error message when the value is not an integer.
     * @param notPositiveErrorMessage Error message when the value is not positive.
     *
     * @throws If the value is not a valid number or not positive.
     */
    private static assertValidLengthValue(
        name: string,
        value: string,
        notIntErrorMessage: string,
        notPositiveErrorMessage: string,
    ): void {
        const parsed = Number(value);

        if (Number.isNaN(parsed)) {
            throw new RuleConversionError(
                sprintf(
                    notIntErrorMessage,
                    name,
                    value,
                ),
            );
        }

        if (parsed < 0) {
            throw new RuleConversionError(
                sprintf(
                    notPositiveErrorMessage,
                    name,
                    value,
                ),
            );
        }
    }
}
