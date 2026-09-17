/**
 * @file HTML filtering rule converter.
 */

import { sprintf } from 'sprintf-js';

import { cloneDomainListNode } from '../../ast-utils/clone';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { RuleConversionError } from '../../errors/rule-conversion-error';
import {
    AdgHtmlFilteringBodyGenerator,
} from '../../generator/cosmetic/html-filtering-body/adg-html-filtering-body-generator';
import {
    UboHtmlFilteringBodyGenerator,
} from '../../generator/cosmetic/html-filtering-body/ubo-html-filtering-body-generator';
import {
    type AttributeSelector,
    type AttributeSelectorWithValue,
    type ComplexSelector,
    CosmeticRuleSeparator,
    CosmeticRuleType,
    type HtmlFilteringRule,
    type HtmlFilteringRuleBody,
    type PseudoClassSelector,
    RuleCategory,
    type SelectorCombinator,
    type SimpleSelector,
    type Value,
} from '../../nodes';
import { AdgHtmlFilteringBodyParser } from '../../parser/cosmetic/html-filtering-body/adg-html-filtering-body-parser';
import { UboHtmlFilteringBodyParser } from '../../parser/cosmetic/html-filtering-body/ubo-html-filtering-body-parser';
import { AdblockSyntax } from '../../utils/adblockers';
import {
    BACKSLASH,
    COLON,
    DOUBLE_QUOTE,
    EMPTY,
    EQUALS,
    OPEN_SQUARE_BRACKET,
    SINGLE_QUOTE,
} from '../../utils/constants';
import { RegExpUtils } from '../../utils/regexp';
import { createNodeConversionResult, type NodeConversionResult } from '../base-interfaces/conversion-result';
import { RuleConverterBase } from '../base-interfaces/rule-converter-base';
import { PseudoClasses } from '../css/index';

/**
 * Upper bound of the length-matching regular expression generated when
 * converting uBlock `:min-text-length()` to AdGuard `:contains()`.
 *
 * The bound must not exceed 65535: converted rules are applied by CoreLibs,
 * which compiles `:contains(/.../)` patterns with PCRE2, and PCRE2 rejects
 * quantifier numbers greater than 65535 ("quantifier too large" error).
 *
 * Note: the AdGuard `[max-length]` attribute itself defaults to 8192 (8 KB)
 * when not specified, but it is handled natively by CoreLibs and is not
 * affected by the PCRE2 quantifier limit.
 *
 * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#html-filtering-rules}
 * @see {@link https://www.pcre.org/current/doc/html/pcre2limits.html}
 */
const ADG_HTML_CONVERSION_MAX_LENGTH = 65535;

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
 * Markers of special pseudo-class selectors with raw-text arguments,
 * used to detect and normalize unparseable HTML filtering rule bodies.
 *
 * Note: the leading colon is a part of the marker on purpose, so that
 * `contains(` / `has-text(` occurring inside string literals or attribute
 * values (e.g. `[data-x="contains(foo"]`) is not mistaken for a special
 * pseudo-class selector.
 */
const SPECIAL_PSEUDO_CLASS_ARG_MARKERS = [
    `:${AdgPseudoClasses.Contains}(`,
    `:${PseudoClasses.AbpContains}(`,
    `:${UboPseudoClasses.HasText}(`,
] as const;

/**
 * Pattern matching special attribute selectors in a raw HTML filtering rule
 * body, e.g. `[tag-content=` or `[ min-length =`. Whitespace around the
 * attribute name and the `=` operator is allowed, as permitted by the
 * attribute selector grammar.
 */
const SPECIAL_ATTRIBUTE_SELECTOR_PATTERN = new RegExp(
    `^\\[\\s*(?:${Object.values(AdgAttributeSelectors).join('|')})\\s*=`,
);

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
    INVALID_SELECTOR_COMBINATOR: "Invalid selector combinator '%s' used between selectors",
    UNKNOWN_SELECTOR_TYPE: "Unknown selector type '%s' found during conversion",

    SPECIAL_ATTRIBUTE_SELECTOR_OPERATOR_INVALID: "Special attribute selector '%s' has invalid operator '%s'",
    SPECIAL_ATTRIBUTE_SELECTOR_FLAG_NOT_SUPPORTED: "Special attribute selector '%s' does not support flags",
    SPECIAL_ATTRIBUTE_SELECTOR_VALUE_REQUIRED: "Special attribute selector '%s' requires a value",
    SPECIAL_ATTRIBUTE_SELECTOR_VALUE_INT: "Value of special attribute selector '%s' must be an integer, got '%s'",
    SPECIAL_ATTRIBUTE_SELECTOR_VALUE_POSITIVE: "Value of special attribute selector '%s' must be a positive integer, got '%s'",
    SPECIAL_ATTRIBUTE_SELECTOR_NOT_SUPPORTED: "Special attribute selector '%s' is not supported in conversion",
    SPECIAL_PSEUDO_CLASS_SELECTOR_ARGUMENT_REQUIRED: "Special pseudo-class selector '%s' requires an argument",
    SPECIAL_PSEUDO_CLASS_SELECTOR_ARGUMENT_INT: "Argument of special pseudo-class selector '%s' must be an integer, got '%s'",
    SPECIAL_PSEUDO_CLASS_SELECTOR_ARGUMENT_POSITIVE: "Argument of special pseudo-class selector '%s' must be a positive integer, got '%s'",
    SPECIAL_PSEUDO_CLASS_SELECTOR_ARGUMENT_TOO_LARGE: "Argument of special pseudo-class selector '%s' must not exceed %s, got '%s'",
    SPECIAL_PSEUDO_CLASS_SELECTOR_NOT_SUPPORTED: "Special pseudo-class selector '%s' is not supported in conversion",
} as const;
/* eslint-enable max-len */

/**
 * Callback type for handling special attribute selectors during selector list conversion.
 *
 * @param name Name of the special attribute selector.
 * @param value Value of the special attribute selector.
 *
 * @returns A {@link SimpleSelector} to add to the current complex selector,
 * or `false` to skip it, or `true` to keep it as-is.
 */
type OnSpecialAttributeSelectorCallback = (name: string, value: string) => SimpleSelector | boolean;

/**
 * Callback type for handling special pseudo-class selectors during selector list conversion.
 *
 * @param name Name of the special pseudo-class selector.
 * @param argument Argument of the special pseudo-class selector.
 *
 * @returns A {@link SimpleSelector} to add to the current complex selector,
 * or `false` to skip it, or `true` to keep it as-is.
 */
type OnSpecialPseudoClassSelectorCallback = (name: string, argument: string) => SimpleSelector | boolean;

/**
 * Union type of HTML filtering rule body parsers:
 * - AdGuard HTML filtering body parser - {@link AdgHtmlFilteringBodyParser}
 * - uBlock HTML filtering body parser - {@link UboHtmlFilteringBodyParser}.
 */
type HtmlFilteringRuleParser =
    | typeof AdgHtmlFilteringBodyParser
    | typeof UboHtmlFilteringBodyParser;

/**
 * Union type of HTML filtering rule body generators:
 * - AdGuard HTML filtering body generator - {@link AdgHtmlFilteringBodyGenerator}
 * - uBlock HTML filtering body generator - {@link UboHtmlFilteringBodyGenerator}.
 */
type HtmlFilteringRuleGenerator =
    | typeof AdgHtmlFilteringBodyGenerator
    | typeof UboHtmlFilteringBodyGenerator;

/**
 * Result of scanning a raw HTML filtering rule body for special selector
 * markers — see {@link HtmlRuleConverter.scanSpecialSelectorMarkers}.
 */
interface SpecialSelectorMarkers {
    /**
     * Whether a special attribute selector (e.g. `[tag-content=`) was found.
     */
    hasSpecialAttributeSelector: boolean;

    /**
     * Index of the last special pseudo-class selector marker
     * (e.g. `:contains(`), or -1 if none was found.
     */
    lastPseudoClassMarkerIndex: number;

    /**
     * Length of the marker at {@link SpecialSelectorMarkers.lastPseudoClassMarkerIndex},
     * or 0 if none was found.
     */
    lastPseudoClassMarkerLength: number;
}

/**
 * HTML filtering rule converter class.
 *
 * @todo Implement `convertToUbo` (ABP currently doesn't support HTML filtering rules).
 */
export class HtmlRuleConverter extends RuleConverterBase {
    /**
     * Converts a HTML rule to AdGuard syntax, if possible.
     *
     * Note: for AdGuard rules this is not a strict validation. AdGuard rules
     * whose bodies cannot be parsed as CSS selector lists (e.g. `:contains()`
     * with an unbalanced parenthesis in the argument) are tolerated: such
     * rules are kept as-is with `isConverted: false`, so callers must not
     * treat a returned result as proof of rule validity.
     *
     * @param rule Rule node to convert.
     *
     * @returns An object which follows the {@link NodeConversionResult} interface. Its `result` property contains
     * the array of converted rule nodes, and its `isConverted` flag indicates whether the original rule was converted.
     * If the rule was not converted, the result array will contain the original node with the same object reference.
     *
     * @throws If the rule is genuinely invalid — an unparseable body without
     * special selector markers, or a conversion error (e.g. mixed AdGuard and
     * uBlock syntax, invalid length values) — or cannot be converted.
     */
    public static convertToAdg(rule: HtmlFilteringRule): NodeConversionResult<HtmlFilteringRule> {
        let parser: HtmlFilteringRuleParser;
        let onSpecialAttributeSelector: OnSpecialAttributeSelectorCallback;
        let onSpecialPseudoClassSelector: OnSpecialPseudoClassSelectorCallback;

        let isConverted = false;
        if (rule.syntax === AdblockSyntax.Adg) {
            parser = AdgHtmlFilteringBodyParser;
            onSpecialAttributeSelector = (name, value) => {
                /**
                 * Mark rule as converted in ADG -> ADG conversion only if
                 * special attribute selectors are present in the rule body,
                 * because they are deprecated and will be removed soon,
                 * so we convert them to pseudo-class selectors.
                 */
                isConverted = true;
                return HtmlRuleConverter.convertSpecialAttributeSelectorAdgToAdg(name, value);
            };
            onSpecialPseudoClassSelector = (name, argument) => {
                const result = HtmlRuleConverter.convertSpecialPseudoClassSelectorAdgToAdg(name, argument);
                // Mark rule as converted in ADG -> ADG conversion if the special
                // pseudo-class selector was replaced (e.g. `:has-text()` -> `:contains()`)
                if (typeof result !== 'boolean') {
                    isConverted = true;
                }
                return result;
            };
        } else if (rule.syntax === AdblockSyntax.Ubo) {
            /**
             * Always mark rule as converted in UBO -> ADG conversion.
             */
            isConverted = true;
            parser = UboHtmlFilteringBodyParser;
            onSpecialAttributeSelector = HtmlRuleConverter.convertSpecialAttributeSelectorUboToAdg;
            onSpecialPseudoClassSelector = HtmlRuleConverter.convertSpecialPseudoClassSelectorUboToAdg;
        } else {
            throw new RuleConversionError(ERROR_MESSAGES.ABP_NOT_SUPPORTED);
        }

        // Convert body
        let convertedBody: Value | HtmlFilteringRuleBody;
        try {
            convertedBody = HtmlRuleConverter.convertBody(
                rule.body,
                parser,
                AdgHtmlFilteringBodyGenerator,
                onSpecialAttributeSelector,
                onSpecialPseudoClassSelector,
                rule.syntax === AdblockSyntax.Adg,
            );
        } catch (error) {
            // Tolerant fallback for AdGuard HTML filtering rules whose bodies
            // cannot be parsed as CSS selector lists, e.g. `:contains()` with
            // an unbalanced parenthesis or an unterminated string in the
            // argument. Such rules are valid in CoreLibs and are present in
            // production filter lists, so we keep them as-is instead of
            // excluding them during conversion.
            // Note: only applies to AdGuard-syntax rules whose raw body
            // contains special selector markers (see hasSpecialSimpleSelectors);
            // unparseable rules without such markers still throw.

            const isAdgWithSpecialSelectorsWithError = rule.syntax === AdblockSyntax.Adg
                && error instanceof AdblockSyntaxError
                && HtmlRuleConverter.hasSpecialSimpleSelectors(
                    rule.body.type === 'Value' ? rule.body.value : '',
                );

            if (!isAdgWithSpecialSelectorsWithError) {
                throw error;
            }

            // First, try to normalize the unclosed special pseudo-class
            // selector argument by quoting it, e.g.
            // `:contains(eval(function(p,a,c,k,e,d))` ->
            // `:contains("eval(function(p,a,c,k,e,d)")`.
            // The re-parse is self-validating: if the normalized body
            // still cannot be parsed, the rule is kept as-is.
            const fixedBodyRaw = HtmlRuleConverter.fixUnclosedSpecialPseudoClassArgument(
                rule.body.type === 'Value' ? rule.body.value : '',
            );

            if (fixedBodyRaw === null) {
                return createNodeConversionResult([rule], false);
            }

            try {
                convertedBody = HtmlRuleConverter.convertBody(
                    {
                        type: 'Value',
                        value: fixedBodyRaw,
                    },
                    parser,
                    AdgHtmlFilteringBodyGenerator,
                    onSpecialAttributeSelector,
                    onSpecialPseudoClassSelector,
                    true,
                );
                isConverted = true;
            } catch (retryError) {
                // Only tolerate syntax errors: the repaired body may still be
                // unparseable, in which case the rule is kept as-is.
                // Conversion errors (e.g. mixed AdGuard and uBlock syntax or
                // invalid length values) must surface instead of being hidden
                // by the fallback.
                if (!(retryError instanceof AdblockSyntaxError)) {
                    throw retryError;
                }

                return createNodeConversionResult([rule], false);
            }
        }

        if (!isConverted) {
            return createNodeConversionResult([rule], false);
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
     * - `[wildcard="*content*"]` -> `:contains(/*.content*./s)`
     *   convert search pattern to regular expression
     * - `[min-length="min"]` -> `:contains(/^(?=.{min,}$).*\/s)`
     *   converts to a length-matching regular expression.
     * - `[max-length="max"]` -> `:contains(/^(?=.{0,max}$).*\/s)`
     *   converts to a length-matching regular expression.
     *
     * Note: This attribute selector to pseudo-class selector conversion
     * is needed because AdGuard special attribute selectors are going
     * to be deprecated and removed soon.
     *
     * @param name Name of the special attribute selector.
     * @param value Value of the special attribute selector.
     *
     * @returns A {@link SimpleSelector} to add to the current complex selector.
     */
    private static convertSpecialAttributeSelectorAdgToAdg(name: string, value: string): SimpleSelector {
        switch (name) {
            // `[tag-content="content"]` -> `:contains(content)`
            // direct conversion, no changes to value
            case AdgAttributeSelectors.TagContent: {
                return HtmlRuleConverter.getPseudoClassSelectorNode(
                    AdgPseudoClasses.Contains,
                    value,
                );
            }

            // `[wildcard="*content*"] -> `:contains(/*.content*./s)`
            // convert search pattern to regular expression
            case AdgAttributeSelectors.Wildcard: {
                return HtmlRuleConverter.getPseudoClassSelectorNode(
                    AdgPseudoClasses.Contains,
                    RegExpUtils.globToRegExp(value),
                );
            }

            // `[min-length="min"]` -> `:contains(/^(?=.{min,}$).*\/s)`
            // `[max-length="max"]` -> `:contains(/^(?=.{0,max}$).*\/s)`
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
     * Handles special pseudo-class selectors during AdGuard to AdGuard conversion:
     * - `:contains(text)` -> kept as-is
     * - `:-abp-contains(text)` -> kept as-is
     * - `:has-text(text)` -> `:contains(text)`
     *   `:has-text()` is a documented synonym for `:contains()` in AdGuard products.
     *
     * @param name Name of the special pseudo-class selector.
     * @param argument Argument of the special pseudo-class selector.
     *
     * @returns A {@link SimpleSelector} to add to the current complex selector,
     * or `true` to keep the original pseudo-class selector as-is.
     *
     * @throws Rule conversion error for mixed syntax.
     */
    private static convertSpecialPseudoClassSelectorAdgToAdg(name: string, argument: string): SimpleSelector | true {
        switch (name) {
            // `:has-text(text)` -> `:contains(text)`
            // `:has-text()` is a documented synonym for `:contains()` in AdGuard products:
            // https://adguard.com/kb/general/ad-filtering/create-own-filters/#html-filtering-rules--contains
            case UboPseudoClasses.HasText: {
                return HtmlRuleConverter.getPseudoClassSelectorNode(
                    AdgPseudoClasses.Contains,
                    argument,
                );
            }

            // Other uBlock-specific pseudo-classes are invalid in AdGuard rules
            case UboPseudoClasses.MinTextLength: {
                throw new RuleConversionError(sprintf(
                    ERROR_MESSAGES.INVALID_RULE,
                    ERROR_MESSAGES.MIXED_SYNTAX_ADG_UBO,
                ));
            }

            // `:contains()` and `:-abp-contains()` are kept as-is in AdGuard rules
            default: {
                return true;
            }
        }
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
     * - `:min-text-length(min)` -> `:contains(/^(?=.{min,MAX_CONVERSION_DEFAULT}$).*\/s)`
     *   converts to a length-matching regular expression.
     *
     * @param name Name of the special pseudo-class selector.
     * @param argument Argument of the special pseudo-class selector.
     *
     * @returns A {@link SimpleSelector} to add to the current complex selector.
     *
     * @throws If AdGuard-specific pseudo-class selector is found in uBlock rule.
     */
    private static convertSpecialPseudoClassSelectorUboToAdg(name: string, argument: string): SimpleSelector {
        switch (name) {
            // `:has-text(text)` -> `:contains(text)`
            // direct conversion, no changes to argument
            case UboPseudoClasses.HasText: {
                return HtmlRuleConverter.getPseudoClassSelectorNode(
                    AdgPseudoClasses.Contains,
                    argument,
                );
            }

            // `:min-text-length(min)` -> `:contains(/^(?=.{min,MAX_CONVERSION_DEFAULT}$).*\/s)`
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

                // The generated regular expression must stay within the PCRE2
                // quantifier limit — see the ADG_HTML_CONVERSION_MAX_LENGTH comment
                if (minLength > ADG_HTML_CONVERSION_MAX_LENGTH) {
                    throw new RuleConversionError(sprintf(
                        ERROR_MESSAGES.SPECIAL_PSEUDO_CLASS_SELECTOR_ARGUMENT_TOO_LARGE,
                        name,
                        ADG_HTML_CONVERSION_MAX_LENGTH,
                        argument,
                    ));
                }

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
     * - `[wildcard="*content*"]` -> `:has-text(/*.content*./s)`
     *   convert search pattern to regular expression
     * - `[min-length="min"]` -> `:min-text-length(min)`
     *   direct conversion, no changes to value
     * - `[max-length]` is skipped.
     *
     * @param name Name of the special attribute selector.
     * @param value Value of the special attribute selector.
     *
     * @returns A {@link SimpleSelector} to add to the current complex selector, or `false` to skip it.
     */
    private static convertSpecialAttributeSelectorAdgToUbo(name: string, value: string): SimpleSelector | false {
        switch (name) {
            // `[tag-content="content"]` -> `:has-text(content)`
            // direct conversion, no changes to value
            case AdgAttributeSelectors.TagContent: {
                return HtmlRuleConverter.getPseudoClassSelectorNode(
                    UboPseudoClasses.HasText,
                    value,
                );
            }

            // `[wildcard="*content*"] -> `:has-text(/*.content*./s)`
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
     *   direct conversion, no changes to argument.
     *
     * @param name Name of the special pseudo-class selector.
     * @param argument Argument of the special pseudo-class selector.
     *
     * @returns A {@link SimpleSelector} to add to the current complex selector.
     *
     * @throws If uBlock-specific pseudo-class selector is found in AdGuard rule.
     */
    private static convertSpecialPseudoClassSelectorAdgToUbo(name: string, argument: string): SimpleSelector {
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
     * Pre-scans a complex selector's child selectors
     * for {@link AdgAttributeSelectors.MinLength}
     * and {@link AdgAttributeSelectors.MaxLength} attribute selectors.
     *
     * Resolves duplicates to the most *restrictive* value:
     * - for multiple `[min-length]` selectors, the largest value is selected;
     * - for multiple `[max-length]` selectors, the smallest value is selected.
     *
     * Logs a warning when duplicate length selectors are found.
     *
     * @param selectors Child selectors of a complex selector to scan.
     *
     * @returns Resolved length constraints,
     * or `null` if no length selectors were found.
     */
    private static collectLengthConstraints(
        selectors: (SimpleSelector | SelectorCombinator)[],
    ): { min: number | null; max: number | null } | null {
        const minValues: number[] = [];
        const maxValues: number[] = [];

        for (let i = 0; i < selectors.length; i += 1) {
            const selector = selectors[i];

            if (selector.type !== 'AttributeSelector') {
                continue;
            }

            const { value: name } = selector.name;

            if (
                name !== AdgAttributeSelectors.MinLength
                && name !== AdgAttributeSelectors.MaxLength
            ) {
                continue;
            }

            if (!('value' in selector) || selector.value.value === EMPTY) {
                continue;
            }

            const { value } = selector.value;

            HtmlRuleConverter.assertValidLengthValue(
                name,
                value,
                ERROR_MESSAGES.SPECIAL_ATTRIBUTE_SELECTOR_VALUE_INT,
                ERROR_MESSAGES.SPECIAL_ATTRIBUTE_SELECTOR_VALUE_POSITIVE,
            );

            if (name === AdgAttributeSelectors.MinLength) {
                minValues.push(Number(value));
            } else {
                maxValues.push(Number(value));
            }
        }

        if (minValues.length === 0 && maxValues.length === 0) {
            return null;
        }

        let min: number | null = null;
        let max: number | null = null;

        if (minValues.length > 1) {
            min = Math.max(...minValues);
            // eslint-disable-next-line no-console
            console.warn(
                `Multiple [min-length] selectors found among: [${minValues.join(', ')}]. Selected largest: ${min}.`,
            );
        } else if (minValues.length === 1) {
            [min] = minValues;
        }

        if (maxValues.length > 1) {
            max = Math.min(...maxValues);
            // eslint-disable-next-line no-console
            console.warn(
                `Multiple [max-length] selectors found among: [${maxValues.join(', ')}]. Selected smallest: ${max}.`,
            );
        } else if (maxValues.length === 1) {
            [max] = maxValues;
        }

        return { min, max };
    }

    /**
     * Scans a raw HTML filtering rule body for special selector markers,
     * skipping over quoted text (string literals and attribute values), where
     * marker-like substrings may occur as plain text, e.g. the `:contains(`
     * in `[data-x=":contains(foo"]` is attribute text, not a selector.
     *
     * Quote handling:
     * - both single and double quotes toggle the quoted state;
     * - a backslash-escaped quote (`\"`) does not toggle the quoted state;
     * - a doubled quote (`""`) inside a quoted section is treated as an
     *   escaped quote (AdGuard escaping convention for `[tag-content]` values).
     *
     * @param raw Raw HTML filtering rule body.
     *
     * @returns Scan result — see {@link SpecialSelectorMarkers}.
     */
    private static scanSpecialSelectorMarkers(raw: string): SpecialSelectorMarkers {
        let hasSpecialAttributeSelector = false;
        let lastPseudoClassMarkerIndex = -1;
        let lastPseudoClassMarkerLength = 0;

        let quote: string | null = null;

        for (let i = 0; i < raw.length; i += 1) {
            const char = raw[i];

            if (quote !== null) {
                // A backslash escapes the next character inside quoted text
                if (char === BACKSLASH) {
                    i += 1;
                    continue;
                }

                // A doubled quote is an escaped quote
                // (AdGuard escaping convention for [tag-content] values)
                if (char === quote && raw[i + 1] === quote) {
                    i += 1;
                    continue;
                }

                // Closing quote
                if (char === quote) {
                    quote = null;
                }

                continue;
            }

            if (char === DOUBLE_QUOTE || char === SINGLE_QUOTE) {
                quote = char;
                continue;
            }

            // Outside of quoted text — check for special selector markers
            if (char === OPEN_SQUARE_BRACKET && SPECIAL_ATTRIBUTE_SELECTOR_PATTERN.test(raw.slice(i))) {
                hasSpecialAttributeSelector = true;
                continue;
            }

            if (char === COLON) {
                for (const marker of SPECIAL_PSEUDO_CLASS_ARG_MARKERS) {
                    if (raw.startsWith(marker, i)) {
                        lastPseudoClassMarkerIndex = i;
                        lastPseudoClassMarkerLength = marker.length;
                        break;
                    }
                }
            }
        }

        return {
            hasSpecialAttributeSelector,
            lastPseudoClassMarkerIndex,
            lastPseudoClassMarkerLength,
        };
    }

    /**
     * Checks if the raw HTML filtering rule body contains any special
     * attribute selector or special pseudo-class selector.
     *
     * Used by the tolerant fallback to distinguish rules with special
     * selectors (which must be kept as-is if unparseable) from genuinely
     * invalid rules (which must be rejected).
     *
     * @param raw Raw HTML filtering rule body.
     *
     * @returns `true` if the body contains special selectors, otherwise `false`.
     */
    private static hasSpecialSimpleSelectors(raw: string): boolean {
        const {
            hasSpecialAttributeSelector,
            lastPseudoClassMarkerIndex,
        } = HtmlRuleConverter.scanSpecialSelectorMarkers(raw);

        return hasSpecialAttributeSelector || lastPseudoClassMarkerIndex >= 0;
    }

    /**
     * Normalizes the raw HTML filtering rule body with an unclosed special
     * pseudo-class selector argument by quoting that argument as a CSS string,
     * e.g. `:contains(eval(function(p,a,c,k,e,d))` ->
     * `:contains("eval(function(p,a,c,k,e,d)")`.
     *
     * The argument of the last special pseudo-class selector is considered to
     * end at the last closing parenthesis of the rule body; the rest of the
     * body is kept as-is. This mirrors the lenient behavior of CoreLibs, which
     * supports such rules in production filter lists.
     *
     * @param raw Raw HTML filtering rule body to normalize.
     *
     * @returns Normalized body, or `null` if the body cannot be normalized
     * (no special pseudo-class selector found, or no closing parenthesis found).
     */
    private static fixUnclosedSpecialPseudoClassArgument(raw: string): string | null {
        // Find the last special pseudo-class selector marker outside of quoted text
        const {
            lastPseudoClassMarkerIndex,
            lastPseudoClassMarkerLength,
        } = HtmlRuleConverter.scanSpecialSelectorMarkers(raw);

        // No special pseudo-class selector found - cannot normalize
        if (lastPseudoClassMarkerIndex < 0) {
            return null;
        }

        // Opening parenthesis of the special pseudo-class selector
        const openParenIndex = lastPseudoClassMarkerIndex + lastPseudoClassMarkerLength - 1;

        // The argument ends at the last closing parenthesis of the rule body
        const closeParenIndex = raw.lastIndexOf(')');

        // No closing parenthesis found - cannot normalize
        if (closeParenIndex <= openParenIndex) {
            return null;
        }

        // Extract the raw argument and quote it as a CSS string,
        // escaping any double quotes inside the argument
        const argumentRaw = raw.slice(openParenIndex + 1, closeParenIndex);
        const quotedArgument = `"${argumentRaw.replace(/"/g, '\\"')}"`;

        return raw.slice(0, openParenIndex + 1) + quotedArgument + raw.slice(closeParenIndex);
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
     * @param shouldMergeLengthSelectors If true, `[min-length]` and `[max-length]` attribute
     * selectors within the same complex selector are merged into a single `:contains()` pseudo-class.
     * Defaults to `false`.
     *
     * @returns Converted selector list without special simple selectors.
     */
    private static convertBody(
        body: Value | HtmlFilteringRuleBody,
        parser: HtmlFilteringRuleParser,
        generator: HtmlFilteringRuleGenerator,
        onSpecialAttributeSelector: OnSpecialAttributeSelectorCallback,
        onSpecialPseudoClassSelector: OnSpecialPseudoClassSelectorCallback,
        shouldMergeLengthSelectors = false,
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
        const convertedComplexSelectors: ComplexSelector[] = [];
        for (let i = 0; i < complexSelectors.length; i += 1) {
            const { children: selectors } = complexSelectors[i];

            // Complex selector node must not be empty
            HtmlRuleConverter.assertNotEmpty(selectors, ERROR_MESSAGES.EMPTY_COMPLEX_SELECTOR);

            // Pre-scan for [min-length] / [max-length] constraints to merge them into one :contains()
            const lengthConstraints = shouldMergeLengthSelectors
                ? HtmlRuleConverter.collectLengthConstraints(selectors)
                : null;
            let lengthContainsEmitted = false;

            // Convert each selector
            const convertedSelectors: (SimpleSelector | SelectorCombinator)[] = [];
            for (let j = 0; j < selectors.length; j += 1) {
                const selector = selectors[j];

                switch (selector.type) {
                    case 'SelectorCombinator': {
                        // Throw if selector combinator used incorrectly
                        if (
                            // If first selector in the complex selector (`> div`)
                            j === 0
                            // If the previous selector is also a combinator (`div > + span`)
                            || j === selectors.length - 1
                            // If the last selector in the complex selector (`div +`)
                            || (j > 0 && selectors[j - 1].type === 'SelectorCombinator')
                        ) {
                            throw new RuleConversionError(sprintf(
                                ERROR_MESSAGES.INVALID_RULE,
                                sprintf(
                                    ERROR_MESSAGES.INVALID_SELECTOR_COMBINATOR,
                                    selector.value,
                                ),
                            ));
                        }

                        break;
                    }

                    case 'AttributeSelector': {
                        // Not a special attribute selector - clone as-is after the switch
                        if (!SUPPORTED_ADG_ATTRIBUTE_SELECTORS.has(selector.name.value)) {
                            break;
                        }

                        // Throw an error if value is missing
                        if (!('value' in selector) || selector.value.value === EMPTY) {
                            throw new RuleConversionError(sprintf(
                                ERROR_MESSAGES.SPECIAL_ATTRIBUTE_SELECTOR_VALUE_REQUIRED,
                                selector.name.value,
                            ));
                        }

                        // Throw an error if operator is not '='
                        if (selector.operator.value !== EQUALS) {
                            throw new RuleConversionError(sprintf(
                                ERROR_MESSAGES.SPECIAL_ATTRIBUTE_SELECTOR_OPERATOR_INVALID,
                                selector.name.value,
                                selector.operator.value,
                            ));
                        }

                        // Throw an error if flag is specified
                        if (selector.flag) {
                            throw new RuleConversionError(sprintf(
                                ERROR_MESSAGES.SPECIAL_ATTRIBUTE_SELECTOR_FLAG_NOT_SUPPORTED,
                                selector.name.value,
                            ));
                        }

                        const name = selector.name.value;
                        const { value } = selector.value;

                        // Merge [min-length] and [max-length] into a single :contains() (ADG→ADG)
                        if (
                            lengthConstraints !== null
                            && (
                                name === AdgAttributeSelectors.MinLength
                                || name === AdgAttributeSelectors.MaxLength
                            )
                        ) {
                            if (!lengthContainsEmitted) {
                                // Invoke the callback once to trigger its side effects
                                // (e.g. the isConverted flag in convertToAdg), but discard
                                // the individual :contains() it returns — we emit the
                                // merged one instead.
                                onSpecialAttributeSelector(name, value);
                                convertedSelectors.push(HtmlRuleConverter.getPseudoClassSelectorNode(
                                    AdgPseudoClasses.Contains,
                                    RegExpUtils.getLengthRegexp(
                                        lengthConstraints.min,
                                        lengthConstraints.max,
                                    ),
                                ));
                                lengthContainsEmitted = true;
                            }
                            continue;
                        }

                        // Invoke callback and:
                        // - add returned simple selector if it's not boolean
                        // - skip adding if returned value is false
                        // - keep original simple selector if returned value is true
                        const result = onSpecialAttributeSelector(name, value);
                        if (typeof result !== 'boolean') {
                            convertedSelectors.push(result);
                            continue;
                        } else if (result === false) {
                            continue;
                        }

                        break;
                    }

                    case 'PseudoClassSelector': {
                        // Not a special pseudo-class selector - clone as-is after the switch
                        if (
                            !SUPPORTED_ADG_PSEUDO_CLASSES.has(selector.name.value)
                            && !SUPPORTED_UBO_PSEUDO_CLASSES.has(selector.name.value)
                        ) {
                            break;
                        }

                        // Throw an error if argument is missing
                        if (!selector.argument || selector.argument.value === EMPTY) {
                            throw new RuleConversionError(sprintf(
                                ERROR_MESSAGES.SPECIAL_PSEUDO_CLASS_SELECTOR_ARGUMENT_REQUIRED,
                                selector.name.value,
                            ));
                        }

                        const name = selector.name.value;
                        const argument = selector.argument.value;

                        // Invoke callback and:
                        // - add returned simple selector if it's not boolean
                        // - skip adding if returned value is false
                        // - keep original simple selector if returned value is true
                        const result = onSpecialPseudoClassSelector(name, argument);
                        if (typeof result !== 'boolean') {
                            convertedSelectors.push(result);
                            continue;
                        } else if (result === false) {
                            continue;
                        }

                        break;
                    }

                    // Increment total simple selectors for other
                    // selector types and clone them as-is after the switch
                    default: {
                        break;
                    }
                }

                // Clone selector if previous conditions are not met
                convertedSelectors.push(HtmlRuleConverter.cloneSelector(selector));
            }

            convertedComplexSelectors.push({
                type: 'ComplexSelector',
                children: convertedSelectors,
            });
        }

        let convertedBody: Value | HtmlFilteringRuleBody = {
            type: 'HtmlFilteringRuleBody',
            selectorList: {
                type: 'SelectorList',
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
     * Clones a simple selector or selector combinator node.
     *
     * @param selector Simple selector or selector combinator node to clone.
     *
     * @returns Cloned simple selector or selector combinator node.
     */
    private static cloneSelector(
        selector: SimpleSelector | SelectorCombinator,
    ): SimpleSelector | SelectorCombinator {
        const { type } = selector;
        switch (type) {
            case 'TypeSelector':
            case 'IdSelector':
            case 'ClassSelector':
                return {
                    type: selector.type,
                    value: selector.value,
                };

            case 'SelectorCombinator':
                return {
                    type: selector.type,
                    value: selector.value,
                };

            case 'AttributeSelector': {
                const attributeSelectorClone: AttributeSelector = {
                    type: selector.type,
                    name: {
                        type: selector.name.type,
                        value: selector.name.value,
                    },
                };

                if ('value' in selector && selector.value) {
                    (attributeSelectorClone as AttributeSelectorWithValue).operator = {
                        type: selector.operator.type,
                        value: selector.operator.value,
                    };

                    (attributeSelectorClone as AttributeSelectorWithValue).value = {
                        type: selector.value.type,
                        value: selector.value.value,
                    };

                    if (selector.flag) {
                        (attributeSelectorClone as AttributeSelectorWithValue).flag = {
                            type: selector.flag.type,
                            value: selector.flag.value,
                        };
                    }
                }

                return attributeSelectorClone;
            }

            case 'PseudoClassSelector': {
                const pseudoClassSelectorClone: PseudoClassSelector = {
                    type: selector.type,
                    name: {
                        type: selector.name.type,
                        value: selector.name.value,
                    },
                };

                if (selector.argument) {
                    pseudoClassSelectorClone.argument = {
                        type: selector.argument.type,
                        value: selector.argument.value,
                    };
                }

                return pseudoClassSelectorClone;
            }

            default: {
                throw new RuleConversionError(sprintf(
                    ERROR_MESSAGES.INVALID_RULE,
                    sprintf(
                        ERROR_MESSAGES.UNKNOWN_SELECTOR_TYPE,
                        type,
                    ),
                ));
            }
        }
    }

    /**
     * Creates a CSS pseudo-class selector node.
     *
     * @param name The name of the pseudo-class selector.
     * @param argument Optional argument of the pseudo-class selector.
     *
     * @returns CSS pseudo-class selector node.
     */
    private static getPseudoClassSelectorNode(name: string, argument?: string): PseudoClassSelector {
        return {
            type: 'PseudoClassSelector',
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
