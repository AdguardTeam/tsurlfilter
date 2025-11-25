/**
 * @file HTML filtering rule converter
 */

import { sprintf } from 'sprintf-js';

import {
    CosmeticRuleSeparator,
    CosmeticRuleType,
    type HtmlFilteringRule,
    type HtmlFilteringRuleSelector,
    RuleCategory,
} from '../../nodes';
import { AdblockSyntax } from '../../utils/adblockers';
import { RuleConversionError } from '../../errors/rule-conversion-error';
import { RuleConverterBase } from '../base-interfaces/rule-converter-base';
import { RegExpUtils } from '../../utils/regexp';
import { QuoteUtils } from '../../utils/quotes';
import { type NodeConversionResult, createNodeConversionResult } from '../base-interfaces/conversion-result';
import { cloneDomainListNode } from '../../ast-utils/clone';

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
const PseudoClasses = {
    Contains: 'contains',
    HasText: 'has-text',
    MinTextLength: 'min-text-length',
} as const;

/**
 * Supported special attribute selectors from AdGuard.
 */
const AttributeSelectors = {
    MaxLength: 'max-length',
    MinLength: 'min-length',
    TagContent: 'tag-content',
    Wildcard: 'wildcard',
} as const;

/**
 * Set of {@link PseudoClasses}.
 */
const SUPPORTED_UBO_PSEUDO_CLASSES = new Set<string>([
    PseudoClasses.Contains,
    PseudoClasses.HasText,
    PseudoClasses.MinTextLength,
]);

/**
 * Set of {@link AttributeSelectors}.
 */
const SUPPORTED_ADG_ATTRIBUTE_SELECTORS = new Set<string>([
    AttributeSelectors.MaxLength,
    AttributeSelectors.MinLength,
    AttributeSelectors.TagContent,
    AttributeSelectors.Wildcard,
]);

/**
 * Error messages used in HTML filtering rule conversion.
 */
export const ERROR_MESSAGES = {
    ABP_NOT_SUPPORTED: 'Invalid rule, ABP does not support HTML filtering rules',
    INVALID_RULE: 'Invalid HTML filtering rule: %s',
    EMPTY_SELECTORS: 'Rule must contain at least one selector',
    ONLY_ONE_SELECTOR_ALLOWED: 'AdGuard HTML filtering rules support only one selector per rule, got %d selectors',
    PSEUDO_CLASSES_NOT_SUPPORTED: 'AdGuard HTML filtering rules do not support pseudo classes',
    ATTR_NOT_SUPPORTED: 'Attribute selector \'%s\' is not supported',
    ATTR_VALUE_FLAGS_NOT_SUPPORTED: 'Attribute selector value with flags is not supported',
    ATTR_VALUE_REQUIRED: 'Attribute selector \'%s\' requires a value',
    ATTR_VALUE_INT: 'The value of attribute selector \'%s\' must be an integer, got \'%s\'',
    ATTR_VALUE_POSITIVE: 'The value of attribute selector \'%s\' must be a positive integer, got \'%s\'',
    PSEUDO_CLASS_NOT_SUPPORTED: 'Pseudo class \'%s\' is not supported',
    PSEUDO_CLASS_INT: 'The content of pseudo class \'%s\' must be an integer, got \'%s\'',
    PSEUDO_CLASS_POSITIVE: 'The content of pseudo class \'%s\' must be a positive integer, got \'%s\'',
    PSEUDO_CLASS_REGEX_NOT_SUPPORTED: 'Regular expressions are not supported in the pseudo class content \'%s\'',
} as const;

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
     * @returns An object which follows the {@link NodeConversionResult} interface. Its `result` property contains
     * the array of converted rule nodes, and its `isConverted` flag indicates whether the original rule was converted.
     * If the rule was not converted, the result array will contain the original node with the same object reference
     * @throws If the rule is invalid or cannot be converted
     */
    public static convertToAdg(rule: HtmlFilteringRule): NodeConversionResult<HtmlFilteringRule> {
        // Ignore AdGuard rules
        if (rule.syntax === AdblockSyntax.Adg) {
            return createNodeConversionResult([rule], false);
        }

        if (rule.syntax === AdblockSyntax.Abp) {
            throw new RuleConversionError(ERROR_MESSAGES.ABP_NOT_SUPPORTED);
        }

        if (rule.body.selectors.length === 0) {
            throw new RuleConversionError(
                sprintf(
                    ERROR_MESSAGES.INVALID_RULE,
                    ERROR_MESSAGES.EMPTY_SELECTORS,
                ),
            );
        }

        const convertedSelectors: HtmlFilteringRuleSelector[] = [];
        for (const { tagName, attributes, pseudoClasses } of rule.body.selectors) {
            const adgSelector: HtmlFilteringRuleSelector = {
                type: 'HtmlFilteringRuleSelector',
                attributes: [],
                pseudoClasses: [],
            };

            // Add tag name if present
            if (tagName) {
                adgSelector.tagName = {
                    type: 'Value',
                    value: tagName.value,
                };
            }

            let minLength: number | undefined;
            let maxLength: number | undefined;
            let tagContent: string | undefined;

            // Convert attributes
            for (const { name, value, flags } of attributes) {
                // throw if flags are present, as AdGuard doesn't support them
                if (flags) {
                    throw new RuleConversionError(ERROR_MESSAGES.ATTR_VALUE_FLAGS_NOT_SUPPORTED);
                }

                // If it's not a special attribute, copy as is
                if (!SUPPORTED_ADG_ATTRIBUTE_SELECTORS.has(name.value)) {
                    adgSelector.attributes.push({
                        type: 'HtmlFilteringRuleSelectorAttribute',
                        name: {
                            type: 'Value',
                            value: name.value,
                        },
                        value: value ? {
                            type: 'Value',
                            value: QuoteUtils.unescapeDoubleQuotes(value.value),
                        } : undefined,
                    });
                    continue;
                }

                // Handle special attributes.
                // This shouldn't happen at first place, but if it happens to contain
                // ADG only special attributes in uBO rule, we need to handle them
                // to avoid attribute duplication. But if convertible pseudo classes
                // are present, they will take precedence over special attributes here.
                if (!value) {
                    throw new RuleConversionError(
                        sprintf(
                            ERROR_MESSAGES.ATTR_VALUE_REQUIRED,
                            name.value,
                        ),
                    );
                }

                let parsedValue: string | number = value.value;
                if (
                    name.value === AttributeSelectors.MinLength
                    || name.value === AttributeSelectors.MaxLength
                ) {
                    parsedValue = HtmlRuleConverter.parseLengthValue(
                        name.value,
                        value.value,
                        ERROR_MESSAGES.ATTR_VALUE_INT,
                        ERROR_MESSAGES.ATTR_VALUE_POSITIVE,
                    );
                } else {
                    parsedValue = QuoteUtils.unescapeDoubleQuotes(value.value);
                }

                if (name.value === AttributeSelectors.MinLength) {
                    // [min-length] alternative in uBO is :min-text-length()
                    minLength = parsedValue as number;
                } else if (name.value === AttributeSelectors.MaxLength) {
                    // [max-length] has no alternative in uBO, so we can just copy it
                    maxLength = parsedValue as number;
                } else if (name.value === AttributeSelectors.TagContent) {
                    // [tag-content] alternative in uBO is :has-text() or :contains()
                    tagContent = parsedValue as string;
                } else {
                    // Other special attributes can be copied as is
                    // because they don't have equivalents in uBO
                    adgSelector.attributes.push({
                        type: 'HtmlFilteringRuleSelectorAttribute',
                        name: {
                            type: 'Value',
                            value: name.value,
                        },
                        value: {
                            type: 'Value',
                            value: String(parsedValue),
                        },
                    });
                }
            }

            // Convert pseudo classes
            for (const { name, content } of pseudoClasses) {
                if (!SUPPORTED_UBO_PSEUDO_CLASSES.has(name.value)) {
                    throw new RuleConversionError(
                        sprintf(
                            ERROR_MESSAGES.PSEUDO_CLASS_NOT_SUPPORTED,
                            name.value,
                        ),
                    );
                }

                if (name.value === PseudoClasses.MinTextLength) {
                    const parsedLength = HtmlRuleConverter.parseLengthValue(
                        name.value,
                        content.value,
                        ERROR_MESSAGES.PSEUDO_CLASS_INT,
                        ERROR_MESSAGES.PSEUDO_CLASS_POSITIVE,
                    );
                    minLength = parsedLength;
                } else if (
                    name.value === PseudoClasses.HasText
                    || name.value === PseudoClasses.Contains
                ) {
                    if (RegExpUtils.isRegexPattern(content.value)) {
                        throw new RuleConversionError(
                            sprintf(
                                ERROR_MESSAGES.PSEUDO_CLASS_REGEX_NOT_SUPPORTED,
                                name.value,
                            ),
                        );
                    }
                    tagContent = QuoteUtils.unescapeDoubleQuotes(content.value);
                }
            }

            if (tagContent !== undefined) {
                adgSelector.attributes.push({
                    type: 'HtmlFilteringRuleSelectorAttribute',
                    name: {
                        type: 'Value',
                        value: AttributeSelectors.TagContent,
                    },
                    value: {
                        type: 'Value',
                        value: tagContent,
                    },
                });
            }

            if (minLength !== undefined) {
                adgSelector.attributes.push({
                    type: 'HtmlFilteringRuleSelectorAttribute',
                    name: {
                        type: 'Value',
                        value: AttributeSelectors.MinLength,
                    },
                    value: {
                        type: 'Value',
                        value: String(minLength),
                    },
                });
            }

            if (maxLength === undefined) {
                maxLength = ADG_HTML_CONVERSION_MAX_LENGTH;
            }

            adgSelector.attributes.push({
                type: 'HtmlFilteringRuleSelectorAttribute',
                name: {
                    type: 'Value',
                    value: AttributeSelectors.MaxLength,
                },
                value: {
                    type: 'Value',
                    value: String(maxLength),
                },
            });

            convertedSelectors.push(adgSelector);
        }

        return createNodeConversionResult(
            // Since AdGuard HTML filtering rules do not support multiple selectors, we need to split each selector
            // into a separate rule node.
            convertedSelectors.map((selector) => ({
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
                    selectors: [selector],
                },
            })),
            true,
        );
    }

    /**
     * Converts a HTML rule to uBlock Origin syntax, if possible.
     *
     * @note AdGuard rules are often more specific than uBlock Origin rules, so some information
     * may be lost in conversion. AdGuard's `[max-length]` and `[tag-content]` attributes will be converted to
     * uBlock's `:min-text-length()` and `:has-text()` pseudo-classes when possible.
     *
     * @param rule Rule node to convert
     * @returns An object which follows the {@link NodeConversionResult} interface. Its `result` property contains
     * the array of converted rule nodes, and its `isConverted` flag indicates whether the original rule was converted.
     * If the rule was not converted, the result array will contain the original node with the same object reference
     * @throws Error if the rule is invalid or cannot be converted
     */
    public static convertToUbo(rule: HtmlFilteringRule): NodeConversionResult<HtmlFilteringRule> {
        // Ignore uBlock Origin rules
        if (rule.syntax === AdblockSyntax.Ubo) {
            return createNodeConversionResult([rule], false);
        }

        if (rule.syntax === AdblockSyntax.Abp) {
            throw new RuleConversionError(ERROR_MESSAGES.ABP_NOT_SUPPORTED);
        }

        if (rule.body.selectors.length !== 1) {
            throw new RuleConversionError(
                sprintf(
                    ERROR_MESSAGES.INVALID_RULE,
                    sprintf(
                        ERROR_MESSAGES.ONLY_ONE_SELECTOR_ALLOWED,
                        rule.body.selectors.length,
                    ),
                ),
            );
        }

        const [adgSelector] = rule.body.selectors;

        if (adgSelector.pseudoClasses.length > 0) {
            throw new RuleConversionError(
                sprintf(
                    ERROR_MESSAGES.INVALID_RULE,
                    ERROR_MESSAGES.PSEUDO_CLASSES_NOT_SUPPORTED,
                ),
            );
        }

        const uboSelector: HtmlFilteringRuleSelector = {
            type: 'HtmlFilteringRuleSelector',
            attributes: [],
            pseudoClasses: [],
        };

        // Convert tag name if present
        if (adgSelector.tagName) {
            uboSelector.tagName = {
                type: 'Value',
                value: adgSelector.tagName.value,
            };
        }

        // Convert attributes
        for (const { name, value, flags } of adgSelector.attributes) {
            if (flags) {
                throw new RuleConversionError(
                    sprintf(
                        ERROR_MESSAGES.INVALID_RULE,
                        ERROR_MESSAGES.ATTR_VALUE_FLAGS_NOT_SUPPORTED,
                    ),
                );
            }

            // If it's not a special attribute, copy as is
            if (!SUPPORTED_ADG_ATTRIBUTE_SELECTORS.has(name.value)) {
                uboSelector.attributes.push({
                    type: 'HtmlFilteringRuleSelectorAttribute',
                    name: {
                        type: 'Value',
                        value: name.value,
                    },
                    value: value ? {
                        type: 'Value',
                        value: value.value,
                    } : undefined,
                });
                continue;
            }

            // Handle special attributes
            if (!value) {
                throw new RuleConversionError(
                    sprintf(
                        ERROR_MESSAGES.ATTR_VALUE_REQUIRED,
                        name.value,
                    ),
                );
            }

            let parsedValue: string | number = value.value;
            if (
                name.value === AttributeSelectors.MinLength
                || name.value === AttributeSelectors.MaxLength
            ) {
                parsedValue = HtmlRuleConverter.parseLengthValue(
                    name.value,
                    value.value,
                    ERROR_MESSAGES.ATTR_VALUE_INT,
                    ERROR_MESSAGES.ATTR_VALUE_POSITIVE,
                );
            }

            if (name.value === AttributeSelectors.MinLength) {
                // Convert to :min-text-length() pseudo class
                uboSelector.pseudoClasses.push({
                    type: 'HtmlFilteringRuleSelectorPseudoClass',
                    name: {
                        type: 'Value',
                        value: PseudoClasses.MinTextLength,
                    },
                    content: {
                        type: 'Value',
                        value: String(parsedValue),
                    },
                });
            } else if (name.value === AttributeSelectors.TagContent) {
                // Convert to :has-text() pseudo class
                uboSelector.pseudoClasses.push({
                    type: 'HtmlFilteringRuleSelectorPseudoClass',
                    name: {
                        type: 'Value',
                        value: PseudoClasses.HasText,
                    },
                    content: {
                        type: 'Value',
                        value: parsedValue as string,
                    },
                });
            }
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
                        ? CosmeticRuleSeparator.ElementHidingException
                        : CosmeticRuleSeparator.ElementHiding,
                },

                body: {
                    type: 'HtmlFilteringRuleBody',
                    selectors: [uboSelector],
                },
            }],
            true,
        );
    }

    /**
     * Parses special attribute / pseudo class length value.
     *
     * @param name Name of the attribute or pseudo-class.
     * @param value Value to parse.
     * @param notIntErrorMessage Error message when the value is not an integer.
     * @param notPositiveErrorMessage Error message when the value is not positive.
     *
     * @returns Parsed length value.
     *
     * @throws If the value is not a valid number or not positive.
     */
    private static parseLengthValue(
        name: string,
        value: string,
        notIntErrorMessage: string,
        notPositiveErrorMessage: string,
    ): number {
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

        return parsed;
    }
}
