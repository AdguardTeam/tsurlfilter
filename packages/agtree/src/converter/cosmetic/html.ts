/**
 * @file HTML filtering rule converter
 */

import { sprintf } from 'sprintf-js';

import {
    CosmeticRuleSeparator,
    CosmeticRuleType,
    type HtmlFilteringRule,
    type HtmlFilteringRuleBodyParsed,
    type HtmlFilteringRuleSelector,
    type HtmlFilteringRuleSelectorAttribute,
    type HtmlFilteringRuleSelectorList,
    type HtmlFilteringRuleSelectorPart,
    type HtmlFilteringRuleSelectorPseudoClass,
    RuleCategory,
} from '../../nodes';
import { AdblockSyntax } from '../../utils/adblockers';
import { RuleConversionError } from '../../errors/rule-conversion-error';
import { RuleConverterBase } from '../base-interfaces/rule-converter-base';
import { type NodeConversionResult, createNodeConversionResult } from '../base-interfaces/conversion-result';
import { cloneDomainListNode } from '../../ast-utils/clone';
import { EQUALS } from '../../utils/constants';
import { QuoteUtils } from '../../utils';
import { UboHtmlFilteringBodyParser } from '../../parser/cosmetic/html-filtering-body/ubo-html-filtering-body-parser';
import { AdgHtmlFilteringBodyParser } from '../../parser/cosmetic/html-filtering-body/adg-html-filtering-body-parser';

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

    EMPTY_SELECTOR_LISTS: 'HTML filtering rule must contain at least one selector list',
    EMPTY_SELECTORS: 'HTML filtering rule must contain at least one selector in selector list',
    EMPTY_PARTS: 'HTML filtering rule must contain at least one part in selector',

    FIRST_SELECTOR_WITH_COMBINATOR: 'First selector cannot start with a combinator',
    MISSING_COMBINATOR: 'Missing combinator between selectors',
    SPECIALS_ONLY_SELECTOR: 'Selector cannot contain only special attribute selectors or pseudo classes',

    ATTRIBUTE_OPERATOR_WITHOUT_VALUE: 'Attribute selector operator specified without a value',
    ATTRIBUTE_FLAG_WITHOUT_VALUE: 'Attribute selector flag specified without a value',
    ATTRIBUTE_VALUE_WITHOUT_OPERATOR: 'Attribute selector value specified without an operator',
    SPECIAL_ATTRIBUTE_OPERATOR_INVALID: 'Special attribute selector \'%s\' has invalid operator \'%s\'',
    SPECIAL_ATTRIBUTE_FLAG_NOT_SUPPORTED: 'Special attribute selector \'%s\' does not support flags',
    SPECIAL_ATTRIBUTE_VALUE_REQUIRED: 'Special attribute selector \'%s\' requires a value',
    SPECIAL_ATTRIBUTE_VALUE_INT: 'Value of special attribute selector \'%s\' must be an integer, got \'%s\'',
    SPECIAL_ATTRIBUTE_VALUE_POSITIVE: 'Value of special attribute selector \'%s\' must be a positive integer, got \'%s\'',
    SPECIAL_ATTRIBUTE_NOT_SUPPORTED: 'Special attribute selector \'%s\' is not supported in conversion',

    PSEUDO_CLASS_ARGUMENT_WITHOUT_FLAG: 'Non-function pseudo class cannot have an argument',
    SPECIAL_PSEUDO_CLASS_ARGUMENT_REQUIRED: 'Special pseudo class \'%s\' requires an argument',
    SPECIAL_PSEUDO_CLASS_ARGUMENT_INT: 'Argument of special pseudo class \'%s\' must be an integer, got \'%s\'',
    SPECIAL_PSEUDO_CLASS_ARGUMENT_POSITIVE: 'Argument of special pseudo class \'%s\' must be a positive integer, got \'%s\'',
    SPECIAL_PSEUDO_CLASS_NOT_SUPPORTED: 'Special pseudo class \'%s\' is not supported in conversion',
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

        // Handle case when body is raw value string.
        // If so, parse it first as we need to work with AST nodes.
        let selectorLists: HtmlFilteringRuleSelectorList[];
        if (rule.body.type === 'Value') {
            const parsedBody = UboHtmlFilteringBodyParser.parse(rule.body.value, {
                isLocIncluded: false,
                parseHtmlFilteringRules: true,
            }) as HtmlFilteringRuleBodyParsed;
            selectorLists = parsedBody.children;
        } else {
            selectorLists = rule.body.children;
        }

        // Selector lists must not be empty
        HtmlRuleConverter.assertNotEmpty(selectorLists, ERROR_MESSAGES.EMPTY_SELECTOR_LISTS);

        // Convert each selector list
        const convertedSelectorLists: HtmlFilteringRuleSelectorList[] = [];
        for (const { children: selectors } of selectorLists) {
            // Selectors must not be empty
            HtmlRuleConverter.assertNotEmpty(selectors, ERROR_MESSAGES.EMPTY_SELECTORS);

            // Convert each selector
            const convertedSelectors: HtmlFilteringRuleSelector[] = [];
            for (let selectorIndex = 0; selectorIndex < selectors.length; selectorIndex += 1) {
                const selector = selectors[selectorIndex];

                // Validate selector
                HtmlRuleConverter.assertValidSelector(selectorIndex, selector);

                const { children: parts, combinator } = selector;

                const convertedAttributes = new Map<AdgAttributeSelectors, string>();
                const convertedPseudoClasses = new Map<AdgPseudoClasses, string>();

                /**
                 * Keep track of present special pseudo-classes to lower ambiguity
                 * of AdGuard-specific attributes, since they are deprecated and soon will be removed.
                 * - If `:min-text-length()` is present, `[min-length]` attribute is ignored.
                 * - If `:has-text()` / `:contains()` is present, `[tag-content]` attribute is ignored.
                 */
                const presentPseudoClasses = new Set<AdgPseudoClasses | UboPseudoClasses>();

                /**
                 * Keep track of the number of special parts found in the selector.
                 * If selector contains only special parts, it means it didn't have
                 * any real selector parts, so we can throw an error in this case.
                 */
                let specialParts = 0;

                // Convert each part
                const convertedParts: HtmlFilteringRuleSelectorPart[] = [];
                for (const part of parts) {
                    if (part.type === 'HtmlFilteringRuleSelectorAttribute') {
                        // Validate attribute
                        HtmlRuleConverter.assertValidAttribute(part);

                        /**
                         * Handle AdGuard-specific attribute selectors.
                         * Please, note that AdGuard-specific attribute selectors
                         * shouldn't be specified in uBlock rules in the first place,
                         * but we still handle them here for completeness and de-duplication.
                         */
                        if (HtmlRuleConverter.isSpecialAdgAttribute(part)) {
                            specialParts += 1;

                            // Validate special attribute
                            HtmlRuleConverter.assertValidSpecialAttribute(part);

                            const name = part.name.value;

                            // Note, it's safe to assert that value node is not null,
                            // because it's validated inside `assertValidSpecialAttribute`
                            const { value } = part.value!;

                            /**
                             * Record found special attribute selectors in case
                             * if there are same functional special pseudo classes
                             * in the same selector:
                             * - `[min-length]` attribute and `:min-text-length()` pseudo class
                             * - `[tag-content]` attribute and `:has-text()` / `:contains()` pseudo class
                             * - `max-length` is special case, because there's no corresponding pseudo class,
                             *   but if it's not specified we set it to the default conversion value.
                             */
                            if (name === AdgAttributeSelectors.MinLength || name === AdgAttributeSelectors.MaxLength) {
                                // Validate numeric value
                                HtmlRuleConverter.assertValidLengthValue(
                                    name,
                                    value,
                                    ERROR_MESSAGES.SPECIAL_ATTRIBUTE_VALUE_INT,
                                    ERROR_MESSAGES.SPECIAL_ATTRIBUTE_VALUE_POSITIVE,
                                );

                                if (name === AdgAttributeSelectors.MinLength) {
                                    if (!presentPseudoClasses.has(UboPseudoClasses.MinTextLength)) {
                                        convertedAttributes.set(AdgAttributeSelectors.MinLength, value);
                                    }
                                } else {
                                    convertedAttributes.set(AdgAttributeSelectors.MaxLength, value);
                                }
                                continue;
                            } else if (name === AdgAttributeSelectors.TagContent) {
                                if (
                                    !presentPseudoClasses.has(UboPseudoClasses.HasText)
                                    && !presentPseudoClasses.has(AdgPseudoClasses.Contains)
                                ) {
                                    convertedPseudoClasses.set(AdgPseudoClasses.Contains, value);
                                }
                                continue;
                            }
                        }
                    } else if (part.type === 'HtmlFilteringRuleSelectorPseudoClass') {
                        // Validate pseudo class
                        HtmlRuleConverter.assertValidPseudoClass(part);

                        /**
                         * Handle uBlock-specific pseudo classes:
                         * - `:has-text()` -> `:contains()`
                         * - `:min-text-length()` -> `[min-length]`
                         *
                         * Also handle AdGuard-specific pseudo class selectors.
                         * Please, note that AdGuard-specific pseudo class selectors
                         * shouldn't be specified in uBlock rules in the first place,
                         * but we still handle them here for completeness and de-duplication.
                         */
                        if (
                            HtmlRuleConverter.isSpecialUboPseudoClass(part)
                            || HtmlRuleConverter.isSpecialAdgPseudoClass(part)
                        ) {
                            specialParts += 1;

                            // Validate special pseudo class
                            HtmlRuleConverter.assertValidSpecialPseudoClass(part);

                            const name = part.name.value;

                            // Note, it's safe to assert that argument node is not null,
                            // because it's validated inside `assertValidSpecialPseudoClass`
                            let argument = part.argument!.value;

                            if (name === UboPseudoClasses.MinTextLength) {
                                // Unescape and remove quotes from argument only
                                // if it's needs to be converted into attribute value
                                argument = QuoteUtils.removeQuotesAndUnescape(argument);

                                HtmlRuleConverter.assertValidLengthValue(
                                    name,
                                    argument,
                                    ERROR_MESSAGES.SPECIAL_PSEUDO_CLASS_ARGUMENT_INT,
                                    ERROR_MESSAGES.SPECIAL_PSEUDO_CLASS_ARGUMENT_POSITIVE,
                                );

                                presentPseudoClasses.add(name);
                                convertedAttributes.set(AdgAttributeSelectors.MinLength, argument);
                                continue;
                            } else if (
                                name === UboPseudoClasses.HasText
                                || name === AdgPseudoClasses.Contains
                            ) {
                                presentPseudoClasses.add(name);
                                convertedPseudoClasses.set(AdgPseudoClasses.Contains, argument);
                                continue;
                            }

                            // Throw an error if the uBlock-specific pseudo class cannot be converted.
                            if (HtmlRuleConverter.isSpecialUboPseudoClass(part)) {
                                throw new RuleConversionError(sprintf(
                                    ERROR_MESSAGES.SPECIAL_PSEUDO_CLASS_NOT_SUPPORTED,
                                    name,
                                ));
                            }
                        }
                    }

                    convertedParts.push(
                        HtmlRuleConverter.cloneHtmlFilteringRuleSelectorPart(part),
                    );
                }

                // Throw an error if selector contains only special parts
                if (specialParts === parts.length) {
                    throw new RuleConversionError(ERROR_MESSAGES.SPECIALS_ONLY_SELECTOR);
                }

                // Add converted special attributes
                for (const [name, value] of convertedAttributes) {
                    convertedParts.push(
                        HtmlRuleConverter.getAttributeNode(
                            name,
                            value,
                        ),
                    );
                }

                // If `[max-length]` was not specified, set it to the conversion default
                if (!convertedAttributes.has(AdgAttributeSelectors.MaxLength)) {
                    convertedParts.push(
                        HtmlRuleConverter.getAttributeNode(
                            AdgAttributeSelectors.MaxLength,
                            String(ADG_HTML_CONVERSION_MAX_LENGTH),
                        ),
                    );
                }

                // Add converted special pseudo-classes
                for (const [name, argument] of convertedPseudoClasses) {
                    convertedParts.push(
                        HtmlRuleConverter.getPseudoClassNode(
                            name,
                            argument,
                        ),
                    );
                }

                convertedSelectors.push({
                    type: 'HtmlFilteringRuleSelector',
                    children: convertedParts,
                    combinator,
                });
            }

            convertedSelectorLists.push({
                type: 'HtmlFilteringRuleSelectorList',
                children: convertedSelectors,
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
                    children: convertedSelectorLists,
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

        // Handle case when body is raw value string.
        // If so, parse it first as we need to work with AST nodes.
        let selectorLists: HtmlFilteringRuleSelectorList[];
        if (rule.body.type === 'Value') {
            const parsedBody = AdgHtmlFilteringBodyParser.parse(rule.body.value, {
                isLocIncluded: false,
                parseHtmlFilteringRules: true,
            }) as HtmlFilteringRuleBodyParsed;
            selectorLists = parsedBody.children;
        } else {
            selectorLists = rule.body.children;
        }

        // Selector lists must not be empty
        HtmlRuleConverter.assertNotEmpty(selectorLists, ERROR_MESSAGES.EMPTY_SELECTOR_LISTS);

        // Convert each selector list
        const convertedSelectorLists: HtmlFilteringRuleSelectorList[] = [];
        for (const { children: selectors } of selectorLists) {
            // Selectors must not be empty
            HtmlRuleConverter.assertNotEmpty(selectors, ERROR_MESSAGES.EMPTY_SELECTORS);

            // Convert each selector
            const convertedSelectors: HtmlFilteringRuleSelector[] = [];
            for (let selectorIndex = 0; selectorIndex < selectors.length; selectorIndex += 1) {
                const selector = selectors[selectorIndex];

                // Validate selector
                HtmlRuleConverter.assertValidSelector(selectorIndex, selector);

                const { children: parts, combinator } = selector;

                const convertedPseudoClasses = new Map<UboPseudoClasses, string>();

                /**
                 * Keep track of present special pseudo-classes to lower ambiguity
                 * of AdGuard-specific attributes, since they are deprecated and soon will be removed.
                 * - If `:min-text-length()` is present, `[min-length]` attribute is ignored.
                 * - If `:has-text()` / `:contains()` is present, `[tag-content]` attribute is ignored.
                 */
                const presentPseudoClasses = new Set<AdgPseudoClasses | UboPseudoClasses>();

                /**
                 * Keep track of the number of special parts found in the selector.
                 * If selector contains only special parts, it means it didn't have
                 * any real selector parts, so we can throw an error in this case.
                 */
                let specialParts = 0;

                // Convert each part
                const convertedParts: HtmlFilteringRuleSelectorPart[] = [];
                for (const part of parts) {
                    if (part.type === 'HtmlFilteringRuleSelectorPseudoClass') {
                        // Validate pseudo class
                        HtmlRuleConverter.assertValidPseudoClass(part);

                        /**
                         * Handle uBlock-specific pseudo class selectors.
                         * Please, note that uBlock-specific pseudo class selectors
                         * shouldn't be specified in AdGuard rules in the first place,
                         * but we still handle them here for completeness and de-duplication.
                         */
                        if (
                            HtmlRuleConverter.isSpecialUboPseudoClass(part)
                            || HtmlRuleConverter.isSpecialAdgPseudoClass(part)
                        ) {
                            specialParts += 1;

                            // Validate special pseudo class
                            HtmlRuleConverter.assertValidSpecialPseudoClass(part);

                            const name = part.name.value;

                            // Note, it's safe to assert that argument node is not null,
                            // because it's validated inside `assertValidSpecialPseudoClass`
                            const argument = part.argument!.value;

                            /**
                             * Record found special pseudo class selectors in case
                             * if there are same functional special attribute
                             * in the same selector:
                             * - `:min-text-length()` pseudo class and `[min-length]` attribute
                             * - `:has-text()` / `:contains()` pseudo class and `[tag-content]` attribute
                             */
                            if (name === UboPseudoClasses.MinTextLength) {
                                HtmlRuleConverter.assertValidLengthValue(
                                    name,
                                    // Unescape and remove quotes from argument to validate it correctly
                                    QuoteUtils.removeQuotesAndUnescape(argument),
                                    ERROR_MESSAGES.SPECIAL_PSEUDO_CLASS_ARGUMENT_INT,
                                    ERROR_MESSAGES.SPECIAL_PSEUDO_CLASS_ARGUMENT_POSITIVE,
                                );

                                presentPseudoClasses.add(name);
                                convertedPseudoClasses.set(UboPseudoClasses.MinTextLength, argument);
                                continue;
                            } else if (
                                name === UboPseudoClasses.HasText
                                || name === AdgPseudoClasses.Contains
                            ) {
                                presentPseudoClasses.add(name);
                                convertedPseudoClasses.set(UboPseudoClasses.HasText, argument);
                                continue;
                            }

                            // Throw an error if the AdGuard-specific pseudo class cannot be converted
                            if (HtmlRuleConverter.isSpecialAdgPseudoClass(part)) {
                                throw new RuleConversionError(sprintf(
                                    ERROR_MESSAGES.SPECIAL_PSEUDO_CLASS_NOT_SUPPORTED,
                                    name,
                                ));
                            }
                        }
                    } else if (part.type === 'HtmlFilteringRuleSelectorAttribute') {
                        // Validate attribute
                        HtmlRuleConverter.assertValidAttribute(part);

                        /**
                         * Handle AdGuard-specific attributes:
                         * - `[tag-content]` -> `:has-text()`
                         * - `[min-length]` -> `:min-text-length()`
                         * - `[max-length]` is special case, we just ignore it during conversion
                         */
                        if (HtmlRuleConverter.isSpecialAdgAttribute(part)) {
                            specialParts += 1;

                            // Validate special attribute
                            HtmlRuleConverter.assertValidSpecialAttribute(part);

                            const name = part.name.value;

                            // Note, it's safe to assert that argument node is not null,
                            // because it's validated inside `assertValidSpecialAttribute`
                            const { value } = part.value!;

                            if (
                                name === AdgAttributeSelectors.MinLength
                                || name === AdgAttributeSelectors.MaxLength
                            ) {
                                HtmlRuleConverter.assertValidLengthValue(
                                    name,
                                    value,
                                    ERROR_MESSAGES.SPECIAL_ATTRIBUTE_VALUE_INT,
                                    ERROR_MESSAGES.SPECIAL_ATTRIBUTE_VALUE_POSITIVE,
                                );

                                if (
                                    name === AdgAttributeSelectors.MinLength
                                    && !presentPseudoClasses.has(UboPseudoClasses.MinTextLength)
                                ) {
                                    convertedPseudoClasses.set(UboPseudoClasses.MinTextLength, value);
                                }

                                continue;
                            } else if (name === AdgAttributeSelectors.TagContent) {
                                if (
                                    !presentPseudoClasses.has(UboPseudoClasses.HasText)
                                    && !presentPseudoClasses.has(AdgPseudoClasses.Contains)
                                ) {
                                    convertedPseudoClasses.set(UboPseudoClasses.HasText, value);
                                }

                                continue;
                            }

                            // Throw an error if the attribute cannot be converted.
                            throw new RuleConversionError(sprintf(
                                ERROR_MESSAGES.SPECIAL_ATTRIBUTE_NOT_SUPPORTED,
                                name,
                            ));
                        }
                    }

                    convertedParts.push(
                        HtmlRuleConverter.cloneHtmlFilteringRuleSelectorPart(part),
                    );
                }

                // Throw an error if selector contains only special parts
                if (specialParts === parts.length) {
                    throw new RuleConversionError(ERROR_MESSAGES.SPECIALS_ONLY_SELECTOR);
                }

                // Add converted special pseudo-classes
                for (const [name, argument] of convertedPseudoClasses) {
                    convertedParts.push(
                        HtmlRuleConverter.getPseudoClassNode(
                            name,
                            argument,
                        ),
                    );
                }

                convertedSelectors.push({
                    type: 'HtmlFilteringRuleSelector',
                    children: convertedParts,
                    combinator,
                });
            }

            convertedSelectorLists.push({
                type: 'HtmlFilteringRuleSelectorList',
                children: convertedSelectors,
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
                    children: convertedSelectorLists,
                },
            }],
            true,
        );
    }

    /**
     * Checks whether the given selector attribute is a special AdGuard attribute selector.
     *
     * @param attribute Selector attribute to check.
     *
     * @returns True if the attribute is a special AdGuard attribute selector, false otherwise.
     */
    private static isSpecialAdgAttribute(
        attribute: HtmlFilteringRuleSelectorAttribute,
    ): boolean {
        return SUPPORTED_ADG_ATTRIBUTE_SELECTORS.has(attribute.name.value);
    }

    /**
     * Checks whether the given selector pseudo class is a special AdGuard pseudo class.
     *
     * @param pseudoClass Selector pseudo class to check.
     *
     * @returns True if the pseudo class is a special AdGuard pseudo class, false otherwise.
     */
    private static isSpecialAdgPseudoClass(
        pseudoClass: HtmlFilteringRuleSelectorPseudoClass,
    ): boolean {
        return SUPPORTED_ADG_PSEUDO_CLASSES.has(pseudoClass.name.value);
    }

    /**
     * Checks whether the given selector pseudo class is a special uBlock pseudo class.
     *
     * @param pseudoClass Selector pseudo class to check.
     *
     * @returns True if the pseudo class is a special uBlock pseudo class, false otherwise.
     */
    private static isSpecialUboPseudoClass(
        pseudoClass: HtmlFilteringRuleSelectorPseudoClass,
    ): boolean {
        return SUPPORTED_UBO_PSEUDO_CLASSES.has(pseudoClass.name.value);
    }

    /**
     * Constructs an HTML filtering rule selector attribute node.
     *
     * @param name Name of the attribute.
     * @param value Value of the attribute.
     *
     * @returns Constructed attribute node.
     */
    private static getAttributeNode(
        name: string,
        value: string,
    ): HtmlFilteringRuleSelectorPart {
        return {
            type: 'HtmlFilteringRuleSelectorAttribute',
            name: {
                type: 'Value',
                value: name,
            },
            operator: {
                type: 'Value',
                value: EQUALS,
            },
            value: {
                type: 'Value',
                value,
            },
        };
    }

    /**
     * Constructs an HTML filtering rule selector pseudo class node.
     *
     * @param name Name of the pseudo class.
     * @param argument Argument of the pseudo class.
     *
     * @returns Constructed pseudo class node.
     */
    private static getPseudoClassNode(
        name: string,
        argument: string,
    ): HtmlFilteringRuleSelectorPart {
        return {
            type: 'HtmlFilteringRuleSelectorPseudoClass',
            name: {
                type: 'Value',
                value: name,
            },
            isFunction: true,
            argument: {
                type: 'Value',
                value: argument,
            },
        };
    }

    /**
     * Clones a HTML filtering rule selector part node.
     *
     * @param node Node to clone.
     *
     * @returns Cloned node.
     *
     * @throws Error if the node type is unknown.
     */
    private static cloneHtmlFilteringRuleSelectorPart(
        node: HtmlFilteringRuleSelectorPart,
    ): HtmlFilteringRuleSelectorPart {
        const { type } = node;
        switch (type) {
            case 'Value':
                return {
                    type: 'Value',
                    value: node.value,
                };

            case 'HtmlFilteringRuleSelectorAttribute':
                return {
                    type: 'HtmlFilteringRuleSelectorAttribute',
                    name: {
                        type: 'Value',
                        value: node.name.value,
                    },
                    operator: node.operator ? {
                        type: 'Value',
                        value: node.operator.value,
                    } : undefined,
                    value: node.value ? {
                        type: 'Value',
                        value: node.value.value,
                    } : undefined,
                    flag: node.flag ? {
                        type: 'Value',
                        value: node.flag.value,
                    } : undefined,
                };

            case 'HtmlFilteringRuleSelectorPseudoClass':
                return {
                    type: 'HtmlFilteringRuleSelectorPseudoClass',
                    name: {
                        type: 'Value',
                        value: node.name.value,
                    },
                    isFunction: node.isFunction,
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
     * Asserts that the given selector is valid.
     *
     * @param index Index of the selector in the selector list.
     * @param selector Selector to check.
     *
     * @throws If the selector is empty or has invalid combinator usage.
     */
    private static assertValidSelector(
        index: number,
        selector: HtmlFilteringRuleSelector,
    ): void {
        HtmlRuleConverter.assertNotEmpty(selector.children, ERROR_MESSAGES.EMPTY_PARTS);

        // Throw if first selector has a combinator
        if (index === 0 && selector.combinator) {
            throw new RuleConversionError(sprintf(
                ERROR_MESSAGES.INVALID_RULE,
                ERROR_MESSAGES.FIRST_SELECTOR_WITH_COMBINATOR,
            ));
        }

        // Throw if combinator is missing
        if (index > 0 && !selector.combinator) {
            throw new RuleConversionError(sprintf(
                ERROR_MESSAGES.INVALID_RULE,
                ERROR_MESSAGES.MISSING_COMBINATOR,
            ));
        }
    }

    /**
     * Asserts that the given selector attribute is a valid attribute.
     *
     * @param attribute Selector attribute to check.
     *
     * @throws If the part is not a valid attribute.
     */
    private static assertValidAttribute(
        attribute: HtmlFilteringRuleSelectorAttribute,
    ): void {
        // Throw an error if the operator is specified without a value
        if (attribute.operator && !attribute.value) {
            throw new RuleConversionError(sprintf(
                ERROR_MESSAGES.INVALID_RULE,
                ERROR_MESSAGES.ATTRIBUTE_OPERATOR_WITHOUT_VALUE,
            ));
        }

        // Throw an error if the flag is specified without a value
        if (attribute.flag && !attribute.value) {
            throw new RuleConversionError(sprintf(
                ERROR_MESSAGES.INVALID_RULE,
                ERROR_MESSAGES.ATTRIBUTE_FLAG_WITHOUT_VALUE,
            ));
        }

        // Throw an error if the value is specified without an operator
        if (attribute.value && !attribute.operator) {
            throw new RuleConversionError(sprintf(
                ERROR_MESSAGES.INVALID_RULE,
                ERROR_MESSAGES.ATTRIBUTE_VALUE_WITHOUT_OPERATOR,
            ));
        }
    }

    /**
     * Asserts that the given selector pseudo class is a valid pseudo class.
     *
     * @param pseudoClass Selector pseudo class to check.
     *
     * @throws If the part is not a valid pseudo class.
     */
    private static assertValidPseudoClass(
        pseudoClass: HtmlFilteringRuleSelectorPseudoClass,
    ): void {
        // Throw an error if isFunction is false but argument is provided
        if (pseudoClass.argument && !pseudoClass.isFunction) {
            throw new RuleConversionError(sprintf(
                ERROR_MESSAGES.INVALID_RULE,
                ERROR_MESSAGES.PSEUDO_CLASS_ARGUMENT_WITHOUT_FLAG,
            ));
        }
    }

    /**
     * Asserts that the given selector attribute is a valid special attribute.
     *
     * @param attribute Selector attribute to check.
     *
     * @throws If the part is not a valid special attribute.
     */
    private static assertValidSpecialAttribute(
        attribute: HtmlFilteringRuleSelectorAttribute,
    ): void {
        // Throw an error if value is missing
        if (!attribute.value) {
            throw new RuleConversionError(sprintf(
                ERROR_MESSAGES.SPECIAL_ATTRIBUTE_VALUE_REQUIRED,
                attribute.name.value,
            ));
        }

        // Throw an error if operator is not '='
        // Here we can safely assert that operator is not null,
        // because it's validated inside `convertSelectorLists`
        if (attribute.operator!.value !== EQUALS) {
            throw new RuleConversionError(sprintf(
                ERROR_MESSAGES.SPECIAL_ATTRIBUTE_OPERATOR_INVALID,
                attribute.name.value,
                attribute.operator!.value,
            ));
        }

        // Throw an error if flag is specified
        if (attribute.flag) {
            throw new RuleConversionError(sprintf(
                ERROR_MESSAGES.SPECIAL_ATTRIBUTE_FLAG_NOT_SUPPORTED,
                attribute.name.value,
            ));
        }
    }

    /**
     * Asserts that the given selector pseudo class is a valid special pseudo class.
     *
     * @param pseudoClass Selector pseudo class to check.
     *
     * @throws If the part is not a valid special pseudo class.
     */
    private static assertValidSpecialPseudoClass(
        pseudoClass: HtmlFilteringRuleSelectorPseudoClass,
    ): void {
        // Throw an error if argument is missing
        if (!pseudoClass.argument) {
            throw new RuleConversionError(sprintf(
                ERROR_MESSAGES.SPECIAL_PSEUDO_CLASS_ARGUMENT_REQUIRED,
                pseudoClass.name.value,
            ));
        }
    }

    /**
     * Asserts that the given special attribute / pseudo class length value is valid.
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
