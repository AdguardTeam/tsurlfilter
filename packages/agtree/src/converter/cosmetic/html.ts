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
    type CssPseudoClassSelector,
    RuleCategory,
} from '../../nodes';
import { AdblockSyntax } from '../../utils/adblockers';
import { RuleConversionError } from '../../errors/rule-conversion-error';
import { RuleConverterBase } from '../base-interfaces/rule-converter-base';
import { type NodeConversionResult, createNodeConversionResult } from '../base-interfaces/conversion-result';
import { cloneDomainListNode } from '../../ast-utils/clone';
import { EMPTY, EQUALS } from '../../utils/constants';
import { RegExpUtils } from '../../utils/regexp';
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
 *
 * Note: If new pseudo-classes are added here, ensure to update
 * the set and logic in the converter methods accordingly.
 */
const UboPseudoClasses = {
    HasText: 'has-text',
    MinTextLength: 'min-text-length',
} as const;

/**
 * Supported special attribute selectors from AdGuard.
 *
 * Note: If new pseudo-classes are added here, ensure to update
 * the set and logic in the converter methods accordingly.
 */
const AdgAttributeSelectors = {
    MaxLength: 'max-length',
    MinLength: 'min-length',
    TagContent: 'tag-content',
    Wildcard: 'wildcard',
} as const;

/**
 * Supported special pseudo-classes from AdGuard.
 *
 * Note: If new pseudo-classes are added here, ensure to update
 * the set and logic in the converter methods accordingly.
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
    MIXED_SYNTAX_ADG_UBO: 'Mixed AdGuard and uBlock syntax',

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
 * @returns A {@link CssSimpleSelector} to add to the current compound selector,
 * or `false` to skip it, or `true` to keep it as-is.
 */
type OnSpecialAttributeSelectorCallback = (name: string, value: string) => CssSimpleSelector | boolean;

/**
 * Callback type for handling special pseudo-class selectors during selector list conversion.
 *
 * @param name Name of the special pseudo-class selector.
 * @param argument Argument of the special pseudo-class selector.
 *
 * @returns A {@link CssSimpleSelector} to add to the current compound selector,
 * or `false` to skip it, or `true` to keep it as-is.
 */
type OnSpecialPseudoClassSelectorCallback = (name: string, argument: string) => CssSimpleSelector | boolean;

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
        let parser: HtmlFilteringRuleParser;
        let onSpecialAttributeSelector: OnSpecialAttributeSelectorCallback;
        let onSpecialPseudoClassSelector: OnSpecialPseudoClassSelectorCallback;

        if (rule.syntax === AdblockSyntax.Adg) {
            parser = AdgHtmlFilteringBodyParser;
            onSpecialAttributeSelector = HtmlRuleConverter.convertSpecialAttributeSelectorAdgToAdg;
            onSpecialPseudoClassSelector = HtmlRuleConverter.convertSpecialPseudoClassSelectorAdgToAdg;
        } else if (rule.syntax === AdblockSyntax.Ubo) {
            parser = UboHtmlFilteringBodyParser;
            onSpecialAttributeSelector = HtmlRuleConverter.convertSpecialAttributeSelectorUboToAdg;
            onSpecialPseudoClassSelector = HtmlRuleConverter.convertSpecialPseudoClassSelectorUboToAdg;
        } else {
            throw new RuleConversionError(ERROR_MESSAGES.ABP_NOT_SUPPORTED);
        }

        // Convert body
        const convertedBody = HtmlRuleConverter.convertBody(
            rule.body,
            parser,
            AdgHtmlFilteringBodyGenerator,
            onSpecialAttributeSelector,
            onSpecialPseudoClassSelector,
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

        // Convert body
        const convertedBody = HtmlRuleConverter.convertBody(
            rule.body,
            AdgHtmlFilteringBodyParser,
            UboHtmlFilteringBodyGenerator,
            HtmlRuleConverter.convertSpecialAttributeSelectorAdgToUbo,
            HtmlRuleConverter.convertSpecialPseudoClassSelectorAdgToUbo,
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
     * Handles special attribute selectors during AdGuard to AdGuard conversion:
     * - `[tag-content="content"]` -> `:contains(content)`
     *   direct conversion, no changes to value
     * - `[wildcard="*content*"] -> `:contains(/*.content*./)`
     *   convert search pattern to regular expression
     * - `[min-length="min"]` -> `:contains(/^(?=.{min,}$).*\/)`
     *   converts to a length-matching regular expression
     * - `[max-length="max"]` -> `:contains(/^(?=.{0,max}$).*\/)`
     *   converts to a length-matching regular expression
     *
     * Note: This attribute selector to pseudo-class selector conversion
     * is needed because AdGuard special attribute selectors are going
     * to be deprecated and removed soon.
     *
     * @param name Name of the special attribute selector.
     * @param value Value of the special attribute selector.
     *
     * @returns A {@link CssSimpleSelector} to add to the current compound selector.
     */
    private static convertSpecialAttributeSelectorAdgToAdg(name: string, value: string): CssSimpleSelector {
        switch (name) {
            // `[tag-content="content"]` -> `:contains(content)`
            // direct conversion, no changes to value
            case AdgAttributeSelectors.TagContent: {
                return HtmlRuleConverter.getPseudoClassSelectorNode(
                    AdgPseudoClasses.Contains,
                    value,
                );
            }

            // `[wildcard="*content*"] -> `:contains(/*.content*./)`
            // convert search pattern to regular expression
            case AdgAttributeSelectors.Wildcard: {
                return HtmlRuleConverter.getPseudoClassSelectorNode(
                    AdgPseudoClasses.Contains,
                    RegExpUtils.globToRegExp(value),
                );
            }

            // `[min-length="min"]` -> `:contains(/^(?=.{min,}$).*\/)`
            // `[max-length="max"]` -> `:contains(/^(?=.{0,max}$).*\/)`
            // converts to a length-matching regular expression
            case AdgAttributeSelectors.MinLength:
            case AdgAttributeSelectors.MaxLength: {
                // Validate length value
                HtmlRuleConverter.assertValidLengthValue(
                    name,
                    value,
                    ERROR_MESSAGES.SPECIAL_ATTRIBUTE_SELECTOR_VALUE_INT,
                    ERROR_MESSAGES.SPECIAL_ATTRIBUTE_SELECTOR_VALUE_POSITIVE,
                );

                // It's safe to cast to number here after validation
                const length = Number(value);

                let min: number | null = null;
                let max: number | null = null;

                if (name === AdgAttributeSelectors.MinLength) {
                    min = length;
                } else {
                    max = length;
                }

                return HtmlRuleConverter.getPseudoClassSelectorNode(
                    AdgPseudoClasses.Contains,
                    RegExpUtils.getLengthRegexp(
                        min,
                        max,
                    ),
                );
            }

            // This line is unreachable due to exhausted cases, but we keep it to satisfy TS
            default: {
                throw new RuleConversionError(sprintf(
                    ERROR_MESSAGES.SPECIAL_ATTRIBUTE_SELECTOR_NOT_SUPPORTED,
                    name,
                ));
            }
        }
    }

    /**
     * Since special pseudo-class selectors do not need conversion
     * in AdGuard to AdGuard conversion, we simply return `true` to keep them as-is.
     *
     * @param name Name of the special pseudo-class selector.
     *
     * @returns `true` to keep the special pseudo-class selector as-is.
     *
     * @throws Rule conversion error for mixed syntax.
     */
    private static convertSpecialPseudoClassSelectorAdgToAdg(name: string): true {
        if (SUPPORTED_UBO_PSEUDO_CLASSES.has(name)) {
            throw new RuleConversionError(sprintf(
                ERROR_MESSAGES.INVALID_RULE,
                ERROR_MESSAGES.MIXED_SYNTAX_ADG_UBO,
            ));
        }

        return true;
    }

    /**
     * Since special attribute selectors only AdGuard-specific,
     * we should never encounter them in uBlock rules.
     *
     * @throws Rule conversion error for mixed syntax.
     */
    private static convertSpecialAttributeSelectorUboToAdg(): never {
        throw new RuleConversionError(sprintf(
            ERROR_MESSAGES.INVALID_RULE,
            ERROR_MESSAGES.MIXED_SYNTAX_ADG_UBO,
        ));
    }

    /**
     * Handles special pseudo-class selectors during uBlock to AdGuard conversion:
     * - `:has-text(text)` -> `:contains(text)`
     *   direct conversion, no changes to argument
     * - `:min-text-length(min)` -> `:contains(/^(?=.{min,MAX_CONVERSION_DEFAULT}$).*\/)`
     *   converts to a length-matching regular expression
     *
     * @param name Name of the special pseudo-class selector.
     * @param argument Argument of the special pseudo-class selector.
     *
     * @returns A {@link CssSimpleSelector} to add to the current compound selector.
     *
     * @throws If AdGuard-specific pseudo-class selector is found in uBlock rule.
     */
    private static convertSpecialPseudoClassSelectorUboToAdg(name: string, argument: string): CssSimpleSelector {
        switch (name) {
            // `:has-text(text)` -> `:contains(text)`
            // direct conversion, no changes to argument
            case UboPseudoClasses.HasText: {
                return HtmlRuleConverter.getPseudoClassSelectorNode(
                    AdgPseudoClasses.Contains,
                    argument,
                );
            }

            // `:min-text-length(min)` -> `:contains(/^(?=.{min,MAX_CONVERSION_DEFAULT}$).*\/)`
            // converts to a length-matching regular expression
            case UboPseudoClasses.MinTextLength: {
                // Validate length value
                HtmlRuleConverter.assertValidLengthValue(
                    name,
                    argument,
                    ERROR_MESSAGES.SPECIAL_PSEUDO_CLASS_SELECTOR_ARGUMENT_INT,
                    ERROR_MESSAGES.SPECIAL_PSEUDO_CLASS_SELECTOR_ARGUMENT_POSITIVE,
                );

                // It's safe to cast to number here after validation
                const minLength = Number(argument);

                return HtmlRuleConverter.getPseudoClassSelectorNode(
                    AdgPseudoClasses.Contains,
                    RegExpUtils.getLengthRegexp(minLength, ADG_HTML_CONVERSION_MAX_LENGTH),
                );
            }

            // Throw an error if the AdGuard-specific pseudo-class selector found in uBlock rule
            case AdgPseudoClasses.Contains: {
                throw new RuleConversionError(sprintf(
                    ERROR_MESSAGES.INVALID_RULE,
                    ERROR_MESSAGES.MIXED_SYNTAX_ADG_UBO,
                ));
            }

            // This line is unreachable due to exhausted cases, but we keep it to satisfy TS
            default: {
                throw new RuleConversionError(sprintf(
                    ERROR_MESSAGES.SPECIAL_PSEUDO_CLASS_SELECTOR_NOT_SUPPORTED,
                    name,
                ));
            }
        }
    }

    /**
     * Handles special attribute selectors during AdGuard to uBlock conversion:
     * - `[tag-content="content"]` -> `:has-text(content)`
     *   direct conversion, no changes to value
     * - `[wildcard="*content*"] -> `:has-text(/*.content*./)`
     *   convert search pattern to regular expression
     * - `[min-length="min"]` -> `:min-text-length(min)`
     *   direct conversion, no changes to value
     * - `[max-length]` is skipped
     *
     * @param name Name of the special attribute selector.
     * @param value Value of the special attribute selector.
     *
     * @returns A {@link CssSimpleSelector} to add to the current compound selector, or `false` to skip it.
     */
    private static convertSpecialAttributeSelectorAdgToUbo(name: string, value: string): CssSimpleSelector | false {
        switch (name) {
            // `[tag-content="content"]` -> `:has-text(content)`
            // direct conversion, no changes to value
            case AdgAttributeSelectors.TagContent: {
                return HtmlRuleConverter.getPseudoClassSelectorNode(
                    UboPseudoClasses.HasText,
                    value,
                );
            }

            // `[wildcard="*content*"] -> `:has-text(/*.content*./)`
            // convert search pattern to regular expression
            case AdgAttributeSelectors.Wildcard: {
                return HtmlRuleConverter.getPseudoClassSelectorNode(
                    UboPseudoClasses.HasText,
                    RegExpUtils.globToRegExp(value),
                );
            }

            // `[min-length="min"]` -> `:min-text-length(min)`
            // direct conversion, no changes to value
            case AdgAttributeSelectors.MinLength: {
                // Validate length value
                HtmlRuleConverter.assertValidLengthValue(
                    name,
                    value,
                    ERROR_MESSAGES.SPECIAL_ATTRIBUTE_SELECTOR_VALUE_INT,
                    ERROR_MESSAGES.SPECIAL_ATTRIBUTE_SELECTOR_VALUE_POSITIVE,
                );

                return HtmlRuleConverter.getPseudoClassSelectorNode(
                    UboPseudoClasses.MinTextLength,
                    value,
                );
            }

            // `[max-length]` is skipped
            case AdgAttributeSelectors.MaxLength: {
                return false;
            }

            // This line is unreachable due to exhausted cases, but we keep it to satisfy TS
            default: {
                throw new RuleConversionError(sprintf(
                    ERROR_MESSAGES.SPECIAL_ATTRIBUTE_SELECTOR_NOT_SUPPORTED,
                    name,
                ));
            }
        }
    }

    /**
     * Handles special pseudo-class selectors during AdGuard to uBlock conversion:
     * - `:contains(text)` -> `:has-text(text)`
     *   direct conversion, no changes to argument
     *
     * @param name Name of the special pseudo-class selector.
     * @param argument Argument of the special pseudo-class selector.
     *
     * @returns A {@link CssSimpleSelector} to add to the current compound selector.
     *
     * @throws If uBlock-specific pseudo-class selector is found in AdGuard rule.
     */
    private static convertSpecialPseudoClassSelectorAdgToUbo(name: string, argument: string): CssSimpleSelector {
        switch (name) {
            // `:contains(text)` -> `:has-text(text)`
            // direct conversion, no changes to argument
            case AdgPseudoClasses.Contains: {
                return HtmlRuleConverter.getPseudoClassSelectorNode(
                    UboPseudoClasses.HasText,
                    argument,
                );
            }

            // Throw an error if the uBlock-specific pseudo-class selector found in AdGuard rule
            case UboPseudoClasses.HasText:
            case UboPseudoClasses.MinTextLength: {
                throw new RuleConversionError(sprintf(
                    ERROR_MESSAGES.INVALID_RULE,
                    ERROR_MESSAGES.MIXED_SYNTAX_ADG_UBO,
                ));
            }

            // This line is unreachable due to exhausted cases, but we keep it to satisfy TS
            default: {
                throw new RuleConversionError(sprintf(
                    ERROR_MESSAGES.SPECIAL_PSEUDO_CLASS_SELECTOR_NOT_SUPPORTED,
                    name,
                ));
            }
        }
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
     *
     * @returns Converted selector list without special simple selectors.
     */
    private static convertBody(
        body: Value | HtmlFilteringRuleBody,
        parser: HtmlFilteringRuleParser,
        generator: HtmlFilteringRuleGenerator,
        onSpecialAttributeSelector: OnSpecialAttributeSelectorCallback,
        onSpecialPseudoClassSelector: OnSpecialPseudoClassSelectorCallback,
    ): Value | HtmlFilteringRuleBody {
        // Handle case when body is raw value string.
        // If so, parse it first as we need to work with AST nodes.
        let processedBody: HtmlFilteringRuleBody;
        if (body.type === 'Value') {
            processedBody = parser.parse(body.value, {
                isLocIncluded: false,
                parseHtmlFilteringRuleBodies: true,
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

                        // Invoke callback and:
                        // - add returned simple selector if it's not boolean
                        // - skip adding if returned value is false
                        // - keep original simple selector if returned value is true
                        const result = onSpecialAttributeSelector(name, value);
                        if (typeof result !== 'boolean') {
                            convertedSimpleSelectors.push(result);
                            continue;
                        } else if (result === false) {
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

                        // Invoke callback and:
                        // - add returned simple selector if it's not boolean
                        // - skip adding if returned value is false
                        // - keep original simple selector if returned value is true
                        const result = onSpecialPseudoClassSelector(name, argument);
                        if (typeof result !== 'boolean') {
                            convertedSimpleSelectors.push(result);
                            continue;
                        } else if (result === false) {
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
                            convertedSimpleSelectors.push(
                                HtmlRuleConverter.getPseudoClassSelectorNode(
                                    simpleSelector.name.value,
                                    simpleSelector.argument?.value,
                                ),
                            );
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
     * Creates a CSS pseudo-class selector node.
     *
     * @param name The name of the pseudo-class selector.
     * @param argument Optional argument of the pseudo-class selector.
     *
     * @returns CSS pseudo-class selector node.
     */
    private static getPseudoClassSelectorNode(name: string, argument?: string): CssPseudoClassSelector {
        return {
            type: 'CssPseudoClassSelector',
            name: {
                type: 'Value',
                value: name,
            },
            argument: argument ? {
                type: 'Value',
                value: argument,
            } : undefined,
        };
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
