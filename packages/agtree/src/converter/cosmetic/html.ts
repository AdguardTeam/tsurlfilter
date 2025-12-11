/**
 * @file HTML filtering rule converter
 */

import { sprintf } from 'sprintf-js';

import {
    CosmeticRuleSeparator,
    CosmeticRuleType,
    type Value,
    type HtmlFilteringRule,
    type HtmlFilteringRuleBody,
    type CssSimpleSelector,
    type CssComplexSelectorItem,
    type CssComplexSelector,
    type CssCompoundSelector,
    RuleCategory,
} from '../../nodes';
import { AdblockSyntax } from '../../utils/adblockers';
import { RuleConversionError } from '../../errors/rule-conversion-error';
import { RuleConverterBase } from '../base-interfaces/rule-converter-base';
import { type NodeConversionResult, createNodeConversionResult } from '../base-interfaces/conversion-result';
import { cloneDomainListNode } from '../../ast-utils/clone';
import { EMPTY, EQUALS } from '../../utils/constants';
import { QuoteUtils } from '../../utils';
import { AdgHtmlFilteringBodyParser } from '../../parser/cosmetic/html-filtering-body/adg-html-filtering-body-parser';
import { UboHtmlFilteringBodyParser } from '../../parser/cosmetic/html-filtering-body/ubo-html-filtering-body-parser';
import {
    AdgHtmlFilteringBodyGenerator,
} from '../../generator/cosmetic/html-filtering-body/adg-html-filtering-body-generator';
import {
    UboHtmlFilteringBodyGenerator,
} from '../../generator/cosmetic/html-filtering-body/ubo-html-filtering-body-generator';

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
const UboPseudoClasses = {
    HasText: 'has-text',
    MinTextLength: 'min-text-length',
} as const;

/**
 * Supported special attribute selectors from AdGuard.
 */
const AdgAttributeSelectors = {
    MaxLength: 'max-length',
    MinLength: 'min-length',
    TagContent: 'tag-content',
    Wildcard: 'wildcard',
} as const;

/**
 * Supported special pseudo-classes from AdGuard.
 */
const AdgPseudoClasses = {
    Contains: 'contains',
} as const;

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
 * Callback type for handling special attribute selectors during selector list conversion.
 *
 * @param name Name of the special attribute selector.
 * @param value Value of the special attribute selector.
 *
 * @returns `true` if the special attribute should be added to the current compound selector, `false` otherwise.
 */
type OnSpecialAttributeSelectorCallback = (name: string, value: string) => boolean;

/**
 * Callback type for handling special pseudo-class selectors during selector list conversion.
 *
 * @param name Name of the special pseudo-class selector.
 * @param argument Argument of the special pseudo-class selector.
 *
 * @returns `true` if the special pseudo-class should be added to the current compound selector, `false` otherwise.
 */
type OnSpecialPseudoClassSelectorCallback = (name: string, argument: string) => boolean;

/**
 * Union type of HTML filtering rule body parsers:
 * - AdGuard HTML filtering body parser - {@link AdgHtmlFilteringBodyParser}
 * - uBlock HTML filtering body parser - {@link UboHtmlFilteringBodyParser}
 */
type HtmlFilteringRuleParser =
    | typeof AdgHtmlFilteringBodyParser
    | typeof UboHtmlFilteringBodyParser;

/**
 * Union type of HTML filtering rule body generators:
 * - AdGuard HTML filtering body generator - {@link AdgHtmlFilteringBodyGenerator}
 * - uBlock HTML filtering body generator - {@link UboHtmlFilteringBodyGenerator}
 */
type HtmlFilteringRuleGenerator =
    | typeof AdgHtmlFilteringBodyGenerator
    | typeof UboHtmlFilteringBodyGenerator;

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

        /**
         * Keep track of present special pseudo-class selectors to lower ambiguity
         * of AdGuard-specific attribute selectors, since they are deprecated and soon will be removed.
         * - If `:min-text-length()` is present, `[min-length]` attribute selector is ignored.
         * - If `:has-text()` / `:contains()` is present, `[tag-content]` attribute selector is ignored.
         *
         * This maps/sets are reused for each compound selector during conversion.
         */
        const convertedAttributeSelectors = new Map<string, string>();
        const convertedPseudoClassSelectors = new Map<string, string>();
        const presentPseudoClassSelectors = new Set<string>();

        // Convert body
        const convertedBody = HtmlRuleConverter.convertBody(
            rule.body,
            UboHtmlFilteringBodyParser,
            AdgHtmlFilteringBodyGenerator,

            /**
             * Handle AdGuard-specific attribute selectors:
             * Record found special attribute selectors in case
             * if there are same functional special pseudo-class selectors
             * in the same compound selector:
             * - `[min-length]` attribute selector and `:min-text-length()` pseudo-class selector
             * - `[tag-content]` attribute selector and `:has-text()` / `:contains()` pseudo-class selector
             * - `max-length` is special case, because there's no corresponding pseudo-class selector,
             *   but if it's not specified we set it to the default conversion value.
             *
             * @param name Name of the special AdGuard attribute selector.
             * @param value Value of the special AdGuard attribute selector.
             *
             * @returns `true` if the special attribute should be added
             * to the current compound selector, `false` otherwise.
             */
            (name, value) => {
                switch (name) {
                    case AdgAttributeSelectors.MinLength:
                    case AdgAttributeSelectors.MaxLength: {
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
                        return false;
                    }

                    case AdgAttributeSelectors.TagContent: {
                        if (
                            !presentPseudoClassSelectors.has(UboPseudoClasses.HasText)
                            && !presentPseudoClassSelectors.has(AdgPseudoClasses.Contains)
                        ) {
                            convertedPseudoClassSelectors.set(AdgPseudoClasses.Contains, value);
                        }
                        return false;
                    }

                    default: {
                        return true;
                    }
                }
            },

            /**
             * Handle uBlock-specific pseudo-class selectors:
             * - `:has-text()` -> `:contains()`
             * - `:min-text-length()` -> `[min-length]`
             *
             * Also handle AdGuard-specific pseudo-class selectors.
             * Please, note that AdGuard-specific pseudo-class selectors
             * shouldn't be specified in uBlock rules in the first place,
             * but we still handle them here for completeness and de-duplication.
             *
             * @param name Name of the special pseudo-class selector.
             * @param argument Argument of the special pseudo-class selector.
             *
             * @returns `true` if the special pseudo-class should be added
             * to the current compound selector, `false` otherwise.
             */
            (name, argument) => {
                switch (name) {
                    case UboPseudoClasses.MinTextLength: {
                        // Unescape and remove quotes from argument only
                        // if it's needs to be converted into attribute selector value
                        const argumentUnquotedAndUnescaped = QuoteUtils.removeQuotesAndUnescape(argument);

                        HtmlRuleConverter.assertValidLengthValue(
                            name,
                            argumentUnquotedAndUnescaped,
                            ERROR_MESSAGES.SPECIAL_PSEUDO_CLASS_SELECTOR_ARGUMENT_INT,
                            ERROR_MESSAGES.SPECIAL_PSEUDO_CLASS_SELECTOR_ARGUMENT_POSITIVE,
                        );

                        presentPseudoClassSelectors.add(name);
                        convertedAttributeSelectors.set(AdgAttributeSelectors.MinLength, argumentUnquotedAndUnescaped);
                        return false;
                    }

                    case UboPseudoClasses.HasText:
                    case AdgPseudoClasses.Contains: {
                        presentPseudoClassSelectors.add(name);
                        convertedPseudoClassSelectors.set(AdgPseudoClasses.Contains, argument);
                        return false;
                    }

                    default: {
                        // Throw an error if the uBlock-specific pseudo-class selector cannot be converted
                        if (SUPPORTED_UBO_PSEUDO_CLASSES.has(name)) {
                            throw new RuleConversionError(sprintf(
                                ERROR_MESSAGES.SPECIAL_PSEUDO_CLASS_SELECTOR_NOT_SUPPORTED,
                                name,
                            ));
                        }

                        return true;
                    }
                }
            },

            /**
             * Finalize handling of special selectors in the converted compound selector:
             * - Add converted special attribute selectors
             * - If `[max-length]` was not specified, set it to the conversion default
             * - Add converted special pseudo-class selectors
             * - Clear converted special selectors for the next compound selector
             *
             * @param convertedCompoundSelector Converted compound selector node.
             */
            (convertedCompoundSelector) => {
                // Add converted special attribute selectors
                for (const [name, value] of convertedAttributeSelectors) {
                    convertedCompoundSelector.children.push({
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
                    });
                }

                // If `[max-length]` was not specified, set it to the conversion default
                if (!convertedAttributeSelectors.has(AdgAttributeSelectors.MaxLength)) {
                    convertedCompoundSelector.children.push({
                        type: 'CssAttributeSelector',
                        name: {
                            type: 'Value',
                            value: AdgAttributeSelectors.MaxLength,
                        },
                        value: {
                            type: 'CssAttributeSelectorValue',
                            value: {
                                type: 'Value',
                                value: String(ADG_HTML_CONVERSION_MAX_LENGTH),
                            },
                            operator: {
                                type: 'Value',
                                value: EQUALS,
                            },
                        },
                    });
                }

                // Add converted special pseudo-class selectors
                for (const [name, argument] of convertedPseudoClassSelectors) {
                    convertedCompoundSelector.children.push({
                        type: 'CssPseudoClassSelector',
                        name: {
                            type: 'Value',
                            value: name,
                        },
                        argument: {
                            type: 'Value',
                            value: argument,
                        },
                    });
                }

                // Clear converted special selectors for the next compound selector
                convertedAttributeSelectors.clear();
                convertedPseudoClassSelectors.clear();
                presentPseudoClassSelectors.clear();
            },
        );

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

                body: convertedBody,
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

        /**
         * Keep track of present special pseudo-class selectors to lower ambiguity
         * of AdGuard-specific attribute selectors, since they are deprecated and soon will be removed.
         * - If `:min-text-length()` is present, `[min-length]` attribute selector is ignored.
         * - If `:has-text()` / `:contains()` is present, `[tag-content]` attribute selector is ignored.
         *
         * This maps/sets are reused for each compound selector during conversion.
         */
        const convertedPseudoClassSelectors = new Map<string, string>();
        const presentPseudoClassSelectors = new Set<string>();

        // Convert body
        const convertedBody = HtmlRuleConverter.convertBody(
            rule.body,
            AdgHtmlFilteringBodyParser,
            UboHtmlFilteringBodyGenerator,

            /**
             * Handle AdGuard-specific attribute selectors:
             * - `[tag-content]` -> `:has-text()`
             * - `[min-length]` -> `:min-text-length()`
             * - `[max-length]` is special case, we just ignore it during conversion
             *
             * @param name Name of the special AdGuard attribute selector.
             * @param value Value of the special AdGuard attribute selector.
             *
             * @returns `true` if the special attribute should be added
             * to the current compound selector, `false` otherwise.
             */
            (name, value) => {
                switch (name) {
                    case AdgAttributeSelectors.MinLength:
                    case AdgAttributeSelectors.MaxLength: {
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

                        return false;
                    }

                    case AdgAttributeSelectors.TagContent: {
                        if (
                            !presentPseudoClassSelectors.has(UboPseudoClasses.HasText)
                            && !presentPseudoClassSelectors.has(AdgPseudoClasses.Contains)
                        ) {
                            convertedPseudoClassSelectors.set(UboPseudoClasses.HasText, value);
                        }

                        return false;
                    }

                    default: {
                        // Throw an error if the attribute selector cannot be converted
                        throw new RuleConversionError(sprintf(
                            ERROR_MESSAGES.SPECIAL_ATTRIBUTE_SELECTOR_NOT_SUPPORTED,
                            name,
                        ));
                    }
                }
            },

            /**
             * Handle uBlock-specific pseudo-class selectors:
             * Record found special pseudo-class selectors in case
             * if there are same functional special attribute selectors
             * in the same compound selector:
             * - `:min-text-length()` pseudo-class selector and `[min-length]` attribute selector
             * - `:has-text()` / `:contains()` pseudo-class selector and `[tag-content]` attribute selector
             *
             * @param name Name of the special pseudo-class selector.
             * @param argument Argument of the special pseudo-class selector.
             *
             * @returns `true` if the special pseudo-class should be added
             * to the current compound selector, `false` otherwise.
             */
            (name, argument) => {
                switch (name) {
                    case UboPseudoClasses.MinTextLength: {
                        HtmlRuleConverter.assertValidLengthValue(
                            name,
                            // Unescape and remove quotes from argument to validate it correctly
                            QuoteUtils.removeQuotesAndUnescape(argument),
                            ERROR_MESSAGES.SPECIAL_PSEUDO_CLASS_SELECTOR_ARGUMENT_INT,
                            ERROR_MESSAGES.SPECIAL_PSEUDO_CLASS_SELECTOR_ARGUMENT_POSITIVE,
                        );

                        presentPseudoClassSelectors.add(name);
                        convertedPseudoClassSelectors.set(UboPseudoClasses.MinTextLength, argument);
                        return false;
                    }

                    case UboPseudoClasses.HasText:
                    case AdgPseudoClasses.Contains: {
                        presentPseudoClassSelectors.add(name);
                        convertedPseudoClassSelectors.set(UboPseudoClasses.HasText, argument);
                        return false;
                    }

                    default: {
                        // Throw an error if the AdGuard-specific pseudo-class selector cannot be converted
                        if (SUPPORTED_ADG_PSEUDO_CLASSES.has(name)) {
                            throw new RuleConversionError(sprintf(
                                ERROR_MESSAGES.SPECIAL_PSEUDO_CLASS_SELECTOR_NOT_SUPPORTED,
                                name,
                            ));
                        }

                        return true;
                    }
                }
            },

            /**
             * Finalize handling of special pseudo-classes in the converted compound selector:
             * - Add converted special pseudo-class selectors
             * - Clear converted special pseudo-classes for the next compound selector
             *
             * @param convertedCompoundSelector Converted compound selector node.
             */
            (convertedCompoundSelector) => {
                // Add converted special pseudo-classes
                for (const [name, argument] of convertedPseudoClassSelectors) {
                    convertedCompoundSelector.children.push({
                        type: 'CssPseudoClassSelector',
                        name: {
                            type: 'Value',
                            value: name,
                        },
                        argument: {
                            type: 'Value',
                            value: argument,
                        },
                    });
                }

                // Clear converted special pseudo-classes for the next compound selector
                convertedPseudoClassSelectors.clear();
                presentPseudoClassSelectors.clear();
            },
        );

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

                body: convertedBody,
            }],
            true,
        );
    }

    /**
     * Converts a HTML filtering rule body by handling special simple selectors via callbacks.
     * Special simple selectors are skipped in the converted selector list and should be handled from callee.
     *
     * @param body HTML filtering rule body to convert.
     * @param parser HTML filtering rule body parser used for parsing raw value bodies.
     * @param generator HTML filtering rule body generator used for generating raw value bodies.
     * @param onSpecialAttributeSelector Callback invoked when a special attribute selector is found.
     * @param onSpecialPseudoClassSelector Callback invoked when a special pseudo-class selector is found.
     * @param onCompoundSelectorFinish Callback invoked when a compound selector conversion is finished,
     * useful for finalizing handling of special simple selectors previously found in the compound selector.
     *
     * @returns Converted selector list without special simple selectors.
     */
    private static convertBody(
        body: Value | HtmlFilteringRuleBody,
        parser: HtmlFilteringRuleParser,
        generator: HtmlFilteringRuleGenerator,
        onSpecialAttributeSelector: OnSpecialAttributeSelectorCallback,
        onSpecialPseudoClassSelector: OnSpecialPseudoClassSelectorCallback,
        onCompoundSelectorFinish: (convertedCompoundSelector: CssCompoundSelector) => void,
    ): Value | HtmlFilteringRuleBody {
        // Handle case when body is raw value string.
        // If so, parse it first as we need to work with AST nodes.
        let processedBody: HtmlFilteringRuleBody;
        if (body.type === 'Value') {
            processedBody = parser.parse(body.value, {
                isLocIncluded: false,
                parseHtmlFilteringRules: true,
            }) as HtmlFilteringRuleBody;
        } else {
            processedBody = body;
        }

        const { children: complexSelectors } = processedBody.selectorList;

        // Selector list node must not be empty
        HtmlRuleConverter.assertNotEmpty(complexSelectors, ERROR_MESSAGES.EMPTY_SELECTOR_LIST);

        // Convert each complex selector
        const convertedComplexSelectors: CssComplexSelector[] = [];
        for (let i = 0; i < complexSelectors.length; i += 1) {
            const { children: complexSelectorItems } = complexSelectors[i];

            // Complex selector node must not be empty
            HtmlRuleConverter.assertNotEmpty(complexSelectorItems, ERROR_MESSAGES.EMPTY_COMPLEX_SELECTOR);

            // Convert each complex selector item
            const convertedComplexSelectorItems: CssComplexSelectorItem[] = [];
            for (let j = 0; j < complexSelectorItems.length; j += 1) {
                const complexSelectorItem = complexSelectorItems[j];
                const { selector: compoundSelector, combinator } = complexSelectorItem;
                const { children: simpleSelectors } = compoundSelector;

                // Compound selector node must not be empty
                HtmlRuleConverter.assertNotEmpty(simpleSelectors, ERROR_MESSAGES.EMPTY_COMPOUND_SELECTOR);

                // Throw if this is the first complex selector item and it has a combinator
                if (j === 0 && complexSelectorItem.combinator) {
                    throw new RuleConversionError(sprintf(
                        ERROR_MESSAGES.INVALID_RULE,
                        ERROR_MESSAGES.FIRST_COMPLEX_SELECTOR_ITEM_WITH_COMBINATOR,
                    ));
                }

                // Throw if combinator is missing between complex selector items
                if (j > 0 && !complexSelectorItem.combinator) {
                    throw new RuleConversionError(sprintf(
                        ERROR_MESSAGES.INVALID_RULE,
                        ERROR_MESSAGES.MISSING_COMBINATOR_BETWEEN_COMPLEX_SELECTOR_ITEMS,
                    ));
                }

                /**
                 * Keep track of the number of special simple selectors found in the compound selector.
                 * If compound selector contains only special simple selectors, it means it didn't have
                 * any real simple selector, so we can throw an error in this case.
                 */
                let specialSimpleSelectors = 0;

                // Convert each simple selector
                const convertedSimpleSelectors: CssSimpleSelector[] = [];
                for (let k = 0; k < simpleSelectors.length; k += 1) {
                    const simpleSelector = simpleSelectors[k];

                    if (
                        simpleSelector.type === 'CssAttributeSelector'
                        && SUPPORTED_ADG_ATTRIBUTE_SELECTORS.has(simpleSelector.name.value)
                    ) {
                        specialSimpleSelectors += 1;

                        // Throw an error if value is missing
                        if (!simpleSelector.value || simpleSelector.value.value.value === EMPTY) {
                            throw new RuleConversionError(sprintf(
                                ERROR_MESSAGES.SPECIAL_ATTRIBUTE_SELECTOR_VALUE_REQUIRED,
                                simpleSelector.name.value,
                            ));
                        }

                        // Throw an error if operator is not '='
                        if (simpleSelector.value.operator.value !== EQUALS) {
                            throw new RuleConversionError(sprintf(
                                ERROR_MESSAGES.SPECIAL_ATTRIBUTE_SELECTOR_OPERATOR_INVALID,
                                simpleSelector.name.value,
                                simpleSelector.value.operator.value,
                            ));
                        }

                        // Throw an error if flag is specified
                        if (simpleSelector.value.isCaseSensitive !== undefined) {
                            throw new RuleConversionError(sprintf(
                                ERROR_MESSAGES.SPECIAL_ATTRIBUTE_SELECTOR_FLAG_NOT_SUPPORTED,
                                simpleSelector.name.value,
                            ));
                        }

                        const name = simpleSelector.name.value;

                        const { value } = simpleSelector.value.value;

                        // Invoke callback and skip if it returns false
                        const shouldAdd = onSpecialAttributeSelector(name, value);
                        if (!shouldAdd) {
                            continue;
                        }
                    } else if (
                        simpleSelector.type === 'CssPseudoClassSelector'
                        && (
                            SUPPORTED_UBO_PSEUDO_CLASSES.has(simpleSelector.name.value)
                            || SUPPORTED_ADG_PSEUDO_CLASSES.has(simpleSelector.name.value)
                        )
                    ) {
                        specialSimpleSelectors += 1;

                        // Throw an error if argument is missing
                        if (!simpleSelector.argument || simpleSelector.argument.value === EMPTY) {
                            throw new RuleConversionError(sprintf(
                                ERROR_MESSAGES.SPECIAL_PSEUDO_CLASS_SELECTOR_ARGUMENT_REQUIRED,
                                simpleSelector.name.value,
                            ));
                        }

                        const name = simpleSelector.name.value;
                        const argument = simpleSelector.argument.value;

                        // Invoke callback and skip if it returns false
                        const shouldAdd = onSpecialPseudoClassSelector(name, argument);
                        if (!shouldAdd) {
                            continue;
                        }
                    }

                    // clone simple selector
                    const { type } = simpleSelector;
                    switch (type) {
                        case 'Value':
                            convertedSimpleSelectors.push({
                                type: 'Value',
                                value: simpleSelector.value,
                            });
                            break;

                        case 'CssAttributeSelector':
                            convertedSimpleSelectors.push({
                                type: 'CssAttributeSelector',
                                name: {
                                    type: 'Value',
                                    value: simpleSelector.name.value,
                                },
                                value: simpleSelector.value ? {
                                    type: 'CssAttributeSelectorValue',
                                    operator: {
                                        type: 'Value',
                                        value: simpleSelector.value.operator.value,
                                    },
                                    value: {
                                        type: 'Value',
                                        value: simpleSelector.value.value.value,
                                    },
                                    isCaseSensitive: simpleSelector.value.isCaseSensitive,
                                } : undefined,
                            });
                            break;

                        case 'CssPseudoClassSelector':
                            convertedSimpleSelectors.push({
                                type: 'CssPseudoClassSelector',
                                name: {
                                    type: 'Value',
                                    value: simpleSelector.name.value,
                                },
                                argument: simpleSelector.argument ? {
                                    type: 'Value',
                                    value: simpleSelector.argument.value,
                                } : undefined,
                            });
                            break;

                        default:
                            throw new Error(`Unknown HtmlFilteringRuleSelectorPart type: ${type}`);
                    }
                }

                // Throw an error if compound selector contains only special simple selectors
                if (specialSimpleSelectors === simpleSelectors.length) {
                    throw new RuleConversionError(ERROR_MESSAGES.SPECIALS_ONLY_SELECTOR);
                }

                // Construct converted compound selector node
                const convertedCompoundSelector: CssCompoundSelector = {
                    type: 'CssCompoundSelector',
                    children: convertedSimpleSelectors,
                };

                // Invoke compound selector finished callback
                onCompoundSelectorFinish(convertedCompoundSelector);

                convertedComplexSelectorItems.push({
                    type: 'CssComplexSelectorItem',
                    selector: convertedCompoundSelector,
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

        let convertedBody: Value | HtmlFilteringRuleBody = {
            type: 'HtmlFilteringRuleBody',
            selectorList: {
                type: 'CssSelectorList',
                children: convertedComplexSelectors,
            },
        };

        // Convert back to Value if the original body was Value
        if (body.type === 'Value') {
            convertedBody = {
                type: 'Value',
                value: generator.generate(convertedBody),
            };
        }

        return convertedBody;
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
