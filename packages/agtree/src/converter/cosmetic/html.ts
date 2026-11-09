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
    REGEX_MARKER,
    SINGLE_QUOTE,
    SLASH,
} from '../../utils/constants';
import { RegExpUtils } from '../../utils/regexp';
import { SPECIAL_PSEUDO_CLASS_NAMES } from '../../utils/special-pseudo-classes';
import { createNodeConversionResult, type NodeConversionResult } from '../base-interfaces/conversion-result';
import { RuleConverterBase } from '../base-interfaces/rule-converter-base';

/**
 * Upper bound of the length-matching regular expression generated when
 * converting uBlock `:min-text-length()` to AdGuard `:contains()`.
 *
 * The bound must not exceed 65535: converted rules are applied by CoreLibs,
 * which compiles `:contains(/.../)` patterns with PCRE2, and PCRE2 rejects
 * quantifier numbers greater than 65535 ("quantifier too large" error).
 *
 * Note: this bound applies to the generated regular expression only.
 * The `[max-length]` and `[min-length]` attribute values are not bounded
 * by it: products apply those attributes natively, without PCRE2.
 *
 * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#html-filtering-rules}
 * @see {@link https://www.pcre.org/current/doc/html/pcre2limits.html}
 */
const ADG_HTML_CONVERSION_MAX_LENGTH = 65535;

/**
 * Pattern for the value of the `[min-length]` and `[max-length]` special
 * attribute selectors.
 *
 * CoreLibs parses these values with `strtoimax(value, &end, 10)`, so leading
 * whitespace and a leading `+` are accepted, while trailing whitespace and
 * other number formats are not: `" 5"` and `"+5"` are valid, `"5 "` and
 * `"1e2"` are not.
 */
const ADG_LENGTH_ATTRIBUTE_VALUE_PATTERN = /^\s*\+?\d+$/;

/**
 * Pattern for the argument of the uBlock `:min-text-length()` special
 * pseudo-class.
 *
 * In uBlock, the argument is validated with a digits-only pattern
 * (`compileInteger` in its static-filtering-parser), so `( 5 )` and `(1e2)`
 * are rejected.
 */
const UBO_MIN_TEXT_LENGTH_ARGUMENT_PATTERN = /^\d+$/;

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
 * Set of {@link SPECIAL_PSEUDO_CLASS_NAMES}: all special pseudo-classes
 * shared with the parser, including the AdGuard `:-abp-contains()` alias.
 */
const SPECIAL_PSEUDO_CLASS_NAME_SET = new Set<string>(SPECIAL_PSEUDO_CLASS_NAMES);

/**
 * HTML raw text elements, whose `innerHTML` equals `textContent`.
 *
 * The content of these elements is text rather than a tree of child nodes,
 * and HTML serialization writes it literally. Thus `<` and `>` in a
 * `[tag-content]` or `[wildcard]` value stay literal characters in both
 * `innerHTML` and `textContent`, so the value can still match in uBlock
 * `:has-text()`, which tests `textContent`.
 *
 * @see {@link https://html.spec.whatwg.org/multipage/syntax.html#raw-text-elements}
 */
const RAW_TEXT_ELEMENTS = new Set<string>(['script', 'style']);

/**
 * Named HTML character references that browsers decode even without the
 * trailing semicolon (the legacy references of the HTML named character
 * references table).
 *
 * Other named references are decoded only with a trailing semicolon, while
 * numeric references are decoded with or without it.
 *
 * @see {@link https://html.spec.whatwg.org/multipage/named-characters.html}
 */
const LEGACY_HTML_CHARACTER_REFERENCE_NAMES = [
    'AElig', 'AMP', 'Aacute', 'Acirc', 'Agrave', 'Aring', 'Atilde', 'Auml',
    'COPY', 'Ccedil', 'ETH', 'Eacute', 'Ecirc', 'Egrave', 'Euml', 'GT',
    'Iacute', 'Icirc', 'Igrave', 'Iuml', 'LT', 'Ntilde', 'Oacute', 'Ocirc',
    'Ograve', 'Oslash', 'Otilde', 'Ouml', 'QUOT', 'REG', 'THORN', 'Uacute',
    'Ucirc', 'Ugrave', 'Uuml', 'Yacute',
    'aacute', 'acirc', 'acute', 'aelig', 'agrave', 'amp', 'aring', 'atilde',
    'auml', 'brvbar', 'ccedil', 'cedil', 'cent', 'copy', 'curren', 'deg',
    'divide', 'eacute', 'ecirc', 'egrave', 'eth', 'euml', 'frac12', 'frac14',
    'frac34', 'gt', 'iacute', 'icirc', 'iexcl', 'igrave', 'iquest', 'iuml',
    'laquo', 'lt', 'macr', 'micro', 'middot', 'nbsp', 'not', 'ntilde',
    'oacute', 'ocirc', 'ograve', 'ordf', 'ordm', 'oslash', 'otilde', 'ouml',
    'para', 'plusmn', 'pound', 'quot', 'raquo', 'reg', 'sect', 'shy', 'sup1',
    'sup2', 'sup3', 'szlig', 'thorn', 'times', 'uacute', 'ucirc', 'ugrave',
    'uml', 'uuml', 'yacute', 'yen', 'yuml',
];

/**
 * Matches an HTML character reference that a browser decodes in an element's
 * `textContent`: any named or numeric reference with a trailing semicolon, a
 * numeric reference without it, or a legacy named reference without it.
 */
const HTML_CHARACTER_REFERENCE_REGEXP = new RegExp(
    `&(?:#[0-9]+;?|#[xX][0-9a-fA-F]+;?|[a-zA-Z][a-zA-Z0-9]*;|${
        LEGACY_HTML_CHARACTER_REFERENCE_NAMES.join('|')
    })`,
);

/**
 * Markers of special pseudo-class selectors with raw-text arguments,
 * used to detect special selector markers in raw (unparseable) HTML
 * filtering rule bodies. Derived from {@link SPECIAL_PSEUDO_CLASS_NAMES},
 * so the converter stays in sync with the lenient body parser.
 *
 * Note: the leading colon is a part of the marker on purpose, so that
 * `contains(` / `has-text(` occurring inside string literals or attribute
 * values (e.g. `[data-x="contains(foo"]`) is not mistaken for a special
 * pseudo-class selector.
 */
const SPECIAL_PSEUDO_CLASS_ARG_MARKERS = SPECIAL_PSEUDO_CLASS_NAMES.map((name) => `:${name}(`);

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
 * Pattern matching [tag-content] values that are NOT chain-safe, i.e. cannot
 * be emitted as a standalone `:contains()` literal directly followed by
 * another special pseudo-class: quotes, parentheses, brackets, braces,
 * backslashes or colons in the literal make CoreLibs' special pseudo-class
 * argument scanner swallow the next free `:` so that the two pseudo-classes
 * silently collapse into one bogus literal argument.
 */
const CHAIN_UNSAFE_LITERAL_PATTERN = /["'\\()[\]{}:]/;

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
    EMPTY_COMPLEX_SELECTOR_AFTER_DROP: 'Complex selector cannot be empty',
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
    SPECIAL_PSEUDO_CLASS_SELECTOR_ARGUMENT_INVALID_IN_UBO: "Argument of special pseudo-class selector '%s' is not valid in uBlock Origin: '%s'",
    SPECIAL_PSEUDO_CLASS_SELECTOR_NOT_SUPPORTED: "Special pseudo-class selector '%s' is not supported in conversion",
} as const;
/* eslint-enable max-len */

/**
 * Callback type for handling special attribute selectors during selector list conversion.
 *
 * @param name Name of the special attribute selector.
 * @param value Value of the special attribute selector.
 * @param typeSelector Lowercase type selector of the compound selector that
 * contains the special attribute selector, or `null` if the compound selector
 * has no type selector.
 *
 * @returns A {@link SimpleSelector} to add to the current complex selector,
 * or `false` to skip it, or `true` to keep it as-is.
 */
type OnSpecialAttributeSelectorCallback = (
    name: string,
    value: string,
    typeSelector: string | null,
) => SimpleSelector | boolean;

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
 * HTML filtering rule converter class.
 *
 * @todo Implement `convertToUbo` (ABP currently doesn't support HTML filtering rules).
 */
export class HtmlRuleConverter extends RuleConverterBase {
    /**
     * Converts a HTML rule to AdGuard syntax, if possible.
     *
     * Note: for AdGuard rules this is not a strict validation. AdGuard rule
     * bodies with an unbalanced special pseudo-class argument, e.g.
     * `:contains((function(...)`, are tolerated and parsed leniently by the
     * parser itself (CoreLibs parity, see `AdgHtmlFilteringBodyParser`);
     * other unparseable bodies with special selectors are kept as-is with
     * `isConverted: false`, so callers must not treat a returned result as
     * proof of rule validity.
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
            // cannot be parsed as CSS selector lists even leniently, e.g. an
            // unterminated string in a special attribute selector value.
            // Such rules may still be supported by other adblockers, so we
            // keep them as-is instead of excluding them during conversion.
            //
            // Note: unbalanced special pseudo-class arguments, e.g.
            // `script:contains((function(g,b,a,c,e,d)`, do not reach this
            // fallback: such bodies are parsed leniently by the parser
            // itself, mirroring CoreLibs (see AdgHtmlFilteringBodyParser).
            // This fallback only applies to AdGuard-syntax rules whose raw
            // body contains special selector markers (see
            // hasSpecialSimpleSelectors); unparseable rules without such
            // markers still throw.
            const isAdgWithSpecialSelectorsWithError = rule.syntax === AdblockSyntax.Adg
                && error instanceof AdblockSyntaxError
                && HtmlRuleConverter.hasSpecialSimpleSelectors(
                    rule.body.type === 'Value' ? rule.body.value : '',
                );

            if (!isAdgWithSpecialSelectorsWithError) {
                throw error;
            }

            return createNodeConversionResult([rule], false);
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
     * Note: a valid ADG rule may be kept as-is with `isConverted: false` when
     * a special attribute selector cannot be represented in uBlock without
     * changing its matching semantics, e.g. HTML markup or an HTML character
     * reference in `[tag-content]`/`[wildcard]` for an element other than
     * `script`/`style`, see {@link HtmlRuleConverter.containsHtmlMarkup},
     * {@link HtmlRuleConverter.containsHtmlCharacterReference} and
     * {@link HtmlRuleConverter.isRawTextElement}. Callers must not treat
     * `isConverted: false` as proof of rule invalidity.
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

        // Set when a special attribute selector cannot be represented in
        // uBlock without changing its matching semantics. uBlock cannot mix
        // AdGuard-only selectors into the converted top-level selector list,
        // so the whole rule is kept as-is instead of emitting a rule that
        // matches other elements.
        let isUnconvertible = false;

        const onSpecialAttributeSelector: OnSpecialAttributeSelectorCallback = (name, value, typeSelector) => {
            // The markup and character reference checks do not apply to raw
            // text elements: their `innerHTML` equals `textContent`, so the
            // value is still present in the text that uBlock matches.
            if (
                (name === AdgAttributeSelectors.TagContent
                    || name === AdgAttributeSelectors.Wildcard)
                && (
                    HtmlRuleConverter.containsHtmlMarkup(value)
                    || HtmlRuleConverter.containsHtmlCharacterReference(value)
                )
                && !HtmlRuleConverter.isRawTextElement(typeSelector)
            ) {
                isUnconvertible = true;
                // Keep the selector: `convertBody()` converts the body
                // before `isUnconvertible` is checked below, and dropping the
                // only selector of a complex selector makes it throw
                // `RuleConversionError: Complex selector cannot be empty`.
                // The converted body is discarded anyway.
                return true;
            }

            return HtmlRuleConverter.convertSpecialAttributeSelectorAdgToUbo(name, value);
        };

        // Convert body
        const convertedBody = HtmlRuleConverter.convertBody(
            rule.body,
            AdgHtmlFilteringBodyParser,
            UboHtmlFilteringBodyGenerator,
            onSpecialAttributeSelector,
            HtmlRuleConverter.convertSpecialPseudoClassSelectorAdgToUbo,
        );

        if (isUnconvertible) {
            // A selector list is a union of complex selectors, and special
            // attribute selectors cannot be mixed into the converted selector
            // list, so dropping only the unconvertible complex selectors
            // would change the rule. Keep the original rule as a native HTML
            // filtering selector instead.
            return createNodeConversionResult([rule], false);
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

                body: convertedBody,
            }],
            true,
        );
    }

    /**
     * Handles special attribute selectors during AdGuard to AdGuard conversion:
     * - `[tag-content="content"]` -> `:contains(content)`
     *   direct conversion, no changes to value. The value is emitted raw:
     *   any quotes in it are literal characters of the text to match, not
     *   a transport encoding to strip later. This mirrors CoreLibs, which
     *   never unquotes `:contains()` arguments.
     * - `[wildcard="*content*"]` -> `:contains(/^.*content.*$/s)`
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
                // The value is emitted raw: quotes within the value are
                // literal characters to match, not a transport encoding —
                // same as CoreLibs, which never unquotes `:contains()`
                // arguments.
                return HtmlRuleConverter.getPseudoClassSelectorNode(
                    AdgPseudoClasses.Contains,
                    value,
                );
            }

            // `[wildcard="*content*"]` -> `:contains(/^.*content.*$/s)`
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
                const length = HtmlRuleConverter.resolveAdgLengthAttributeValue(name, value);

                let min: string | null = null;
                let max: string | null = null;

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
     * - `:has-text(text)` -> `:contains(text)`
     *   `:has-text()` is a documented synonym for `:contains()` in AdGuard products.
     *
     * Note: `:-abp-contains()` does not reach this method. The converter
     * validates its argument and keeps it as-is in `convertBody` (see AG-61400).
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

            // `:contains()` is kept as-is in AdGuard rules
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
     * @throws If `:contains()` is found in a uBlock rule (mixed syntax).
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
                    UBO_MIN_TEXT_LENGTH_ARGUMENT_PATTERN,
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
     * Checks whether a special attribute selector value contains HTML markup
     * characters (`<` or `>`).
     *
     * AdGuard `[tag-content]` and `[wildcard]` match the element HTML
     * (`innerHTML`), while uBlock `:has-text()` matches the element text
     * (`textContent`). Tags exist only in the HTML, so a value that contains
     * markup can never be found in uBlock's `textContent`, i.e. the converted
     * rule would match nothing. Such rules are kept as-is instead.
     *
     * Exception: for raw text elements the two strings are equal, see
     * {@link HtmlRuleConverter.isRawTextElement}.
     *
     * @param value Value of the special attribute selector.
     *
     * @returns `true` if the value contains HTML markup, otherwise `false`.
     */
    private static containsHtmlMarkup(value: string): boolean {
        return value.includes('<') || value.includes('>');
    }

    /**
     * Checks whether a special attribute selector value contains an HTML
     * character reference, e.g. `&lt;`, `&amp;`, `&#39;` or `&copy 2024`.
     *
     * AdGuard `[tag-content]` and `[wildcard]` match the element HTML
     * (`innerHTML`), where a character reference stays encoded, while uBlock
     * `:has-text()` matches the decoded `textContent`. A value with a
     * character reference can therefore never be found in uBlock's
     * `textContent`, i.e. the converted rule would match nothing. Such rules
     * are kept as-is instead.
     *
     * Browsers decode numeric references and the legacy named references
     * listed in the HTML specification even without the trailing semicolon,
     * e.g. `&#39` and `&copy 2024`, so those forms are detected as well.
     * Other named references require the semicolon.
     *
     * Exception: character references are not decoded in raw text elements
     * either, so their `innerHTML` and `textContent` stay equal, see
     * {@link HtmlRuleConverter.isRawTextElement}.
     *
     * @param value Value of the special attribute selector.
     *
     * @returns `true` if the value contains an HTML character reference,
     * otherwise `false`.
     */
    private static containsHtmlCharacterReference(value: string): boolean {
        return HTML_CHARACTER_REFERENCE_REGEXP.test(value);
    }

    /**
     * Checks whether the type selector refers to an HTML raw text element.
     *
     * For raw text elements (`script`, `style`) the element content is text,
     * not a tree of child nodes, so `innerHTML` and `textContent` are equal.
     * A `[tag-content]` or `[wildcard]` value with markup characters can
     * therefore still match in uBlock `:has-text()`, which tests
     * `textContent`.
     *
     * @param typeSelector Type selector of the compound selector, or `null`
     * if the compound selector has no type selector.
     *
     * @returns `true` if the type selector refers to a raw text element,
     * otherwise `false`.
     */
    private static isRawTextElement(typeSelector: string | null): boolean {
        return typeSelector !== null && RAW_TEXT_ELEMENTS.has(typeSelector);
    }

    /**
     * Handles special attribute selectors during AdGuard to uBlock conversion:
     * - `[tag-content="content"]` -> `:has-text(/content/)`
     *   The literal is escaped and emitted as a regular expression. A plain
     *   uBlock `:has-text()` argument is matched case-insensitively, while
     *   AdGuard `[tag-content]` is case-sensitive. Only the `i` flag is
     *   accepted by uBlock, so a regexp without flags stays case-sensitive.
     * - `[wildcard="*content*"]` -> `:has-text(/^[\s\S]*content[\s\S]*$/)`
     *   convert search pattern to a uBlock-compatible regular expression:
     *   uBlock accepts only the `i` flag, so the dot-all `s` flag cannot be
     *   used and `[\s\S]` replaces the dots.
     * - `[min-length="min"]` -> `:min-text-length(min)`
     *   the value is validated and normalized to plain digits, since uBlock
     *   accepts only digits (e.g. `" 5"` and `"+5"` become `5`)
     * - `[max-length]` is skipped, but its value is validated the same way as
     *   `[min-length]` first, so an invalid value throws the same conversion
     *   error as in AdGuard to AdGuard conversion instead of being dropped
     *   silently. Dropping a selector may empty its compound; the caller
     *   handles the emptied compounds and rejects a complex selector left
     *   without any constraint, see {@link convertBody}.
     *
     * Note: values that contain HTML markup or an HTML character reference are
     * passed to this method only for raw text elements, where `innerHTML`
     * equals `textContent`; for other elements such rules are kept as-is, see
     * {@link HtmlRuleConverter.containsHtmlMarkup},
     * {@link HtmlRuleConverter.containsHtmlCharacterReference} and
     * {@link HtmlRuleConverter.isRawTextElement}.
     *
     * @param name Name of the special attribute selector.
     * @param value Value of the special attribute selector.
     *
     * @returns A {@link SimpleSelector} to add to the current complex selector, or `false` to skip it.
     *
     * @throws Rule conversion error if the value of a length selector is invalid.
     */
    private static convertSpecialAttributeSelectorAdgToUbo(name: string, value: string): SimpleSelector | false {
        switch (name) {
            // `[tag-content="content"]` -> `:has-text(/content/)`
            // the escaped literal is a case-sensitive regexp in uBlock, and
            // quotes are emitted as hex escapes for CSS-tree, which parses the
            // argument before uBlock reads the regexp
            case AdgAttributeSelectors.TagContent: {
                return HtmlRuleConverter.getPseudoClassSelectorNode(
                    UboPseudoClasses.HasText,
                    `${REGEX_MARKER}${RegExpUtils.escapeRegexSpecials(value, true)}${REGEX_MARKER}`,
                );
            }

            // `[wildcard="*content*"]` -> `:has-text(/^[\s\S]*content[\s\S]*$/)`
            // convert search pattern to a uBlock-compatible regular expression
            case AdgAttributeSelectors.Wildcard: {
                return HtmlRuleConverter.getPseudoClassSelectorNode(
                    UboPseudoClasses.HasText,
                    RegExpUtils.globToUboRegExp(value),
                );
            }

            // `[min-length="min"]` -> `:min-text-length(min)`
            // `[max-length]` is skipped after validating its value, since uBlock
            // has no equivalent for it
            case AdgAttributeSelectors.MinLength:
            case AdgAttributeSelectors.MaxLength: {
                // Validate length value the same way as in AdGuard to AdGuard
                // conversion before dropping `[max-length]`. The value is
                // normalized to plain decimal digits, since uBlock validates
                // the `:min-text-length()` argument with a digits-only pattern
                // (e.g. `" 5"` and `"+5"` -> `5`).
                const normalizedValue = HtmlRuleConverter.resolveAdgLengthAttributeValue(name, value);

                if (name === AdgAttributeSelectors.MaxLength) {
                    return false;
                }

                return HtmlRuleConverter.getPseudoClassSelectorNode(
                    UboPseudoClasses.MinTextLength,
                    normalizedValue,
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
     * Handles special pseudo-class selectors during AdGuard to uBlock conversion:
     * - `:contains(text)` -> `:has-text(text)`
     *   direct conversion, no changes to argument. A text argument that
     *   uBlock would reject (e.g. `:contains("foo" )`) is not converted.
     *
     * Note: `:-abp-contains()` does not reach this method. It is an AdGuard
     * alias of `:contains()`, but its uBlock mapping is not implemented yet
     * (see AG-61400), so `convertBody` keeps it as-is.
     *
     * @param name Name of the special pseudo-class selector.
     * @param argument Argument of the special pseudo-class selector.
     *
     * @returns A {@link SimpleSelector} to add to the current complex selector.
     *
     * @throws If uBlock-specific pseudo-class selector is found in AdGuard rule,
     * or the argument is not valid in uBlock.
     */
    private static convertSpecialPseudoClassSelectorAdgToUbo(name: string, argument: string): SimpleSelector {
        switch (name) {
            // `:contains(text)` -> `:has-text(text)`
            // direct conversion, no changes to argument
            case AdgPseudoClasses.Contains: {
                if (!HtmlRuleConverter.isUboTextArgumentSupported(argument)) {
                    throw new RuleConversionError(sprintf(
                        ERROR_MESSAGES.SPECIAL_PSEUDO_CLASS_SELECTOR_ARGUMENT_INVALID_IN_UBO,
                        name,
                        argument,
                    ));
                }

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
     * Returns the lowercase type selector of the compound selector that
     * contains the simple selector at the given index.
     *
     * A compound selector starts after a combinator, and a type selector,
     * when present, is its first simple selector.
     *
     * @param selectors Child selectors of a complex selector.
     * @param index Index of the simple selector within the complex selector.
     *
     * @returns Lowercase type selector, or `null` if the compound selector
     * has no type selector.
     */
    private static getCompoundTypeSelector(
        selectors: (SimpleSelector | SelectorCombinator)[],
        index: number,
    ): string | null {
        let compoundStart = 0;

        for (let i = index - 1; i >= 0; i -= 1) {
            if (selectors[i].type === 'SelectorCombinator') {
                compoundStart = i + 1;
                break;
            }
        }

        const firstSelector = selectors[compoundStart];

        if (firstSelector.type !== 'TypeSelector') {
            return null;
        }

        return firstSelector.value.toLowerCase();
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
     * @param selectors Child selectors of a complex selector to scan.
     *
     * @returns Resolved length constraints,
     * or `null` if no length selectors were found.
     */
    private static collectLengthConstraints(
        selectors: (SimpleSelector | SelectorCombinator)[],
    ): { min: string | null; max: string | null } | null {
        const minValues: string[] = [];
        const maxValues: string[] = [];

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

            const normalizedValue = HtmlRuleConverter.resolveAdgLengthAttributeValue(name, value);

            if (name === AdgAttributeSelectors.MinLength) {
                minValues.push(normalizedValue);
            } else {
                maxValues.push(normalizedValue);
            }
        }

        if (minValues.length === 0 && maxValues.length === 0) {
            return null;
        }

        let min: string | null = null;
        let max: string | null = null;

        if (minValues.length > 0) {
            min = minValues.reduce((largest, current) => (
                HtmlRuleConverter.compareLengthDigitStrings(current, largest) > 0
                    ? current
                    : largest
            ));
        }

        if (maxValues.length > 0) {
            max = maxValues.reduce((smallest, current) => (
                HtmlRuleConverter.compareLengthDigitStrings(current, smallest) < 0
                    ? current
                    : smallest
            ));
        }

        return { min, max };
    }

    /**
     * Checks whether the raw HTML filtering rule body contains any special
     * attribute selector or special pseudo-class selector outside of quoted
     * text, where marker-like substrings may occur as plain text, e.g. the
     * `:contains(` in `[data-x=":contains(foo"]`.
     *
     * Quote handling:
     * - both single and double quotes toggle the quoted state;
     * - a backslash-escaped quote (`\"`) does not toggle the quoted state;
     * - a doubled quote (`""`) inside a quoted section is treated as an
     *   escaped quote (AdGuard escaping convention for `[tag-content]` values).
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
                return true;
            }

            if (char === COLON && SPECIAL_PSEUDO_CLASS_ARG_MARKERS.some((marker) => raw.startsWith(marker, i))) {
                return true;
            }
        }

        return false;
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
     *
     * @throws Rule conversion error if dropping a special selector leaves the
     * complex selector without any constraint, because the resulting all-`*`
     * selector matches almost every element.
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

            // Deferred special attribute values (ADG→ADG only): [tag-content]
            // and [wildcard] cannot be converted in isolation, because their
            // CoreLibs-safe form depends on the other special attributes of
            // the same complex selector — see appendSpecialAttributePseudoClasses
            const deferredTagContentValues: string[] = [];
            const deferredWildcardValues: string[] = [];

            // Convert each selector
            const convertedSelectors: (SimpleSelector | SelectorCombinator)[] = [];

            // Whether a special selector was dropped in this complex selector.
            // Only a compound emptied by a drop gets `*`; one emptied by the
            // ADG→ADG move stays an error, because that path moves special
            // attribute selectors to the end of the complex selector instead
            // of dropping them.
            let hasDroppedSelector = false;
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
                        const typeSelector = HtmlRuleConverter.getCompoundTypeSelector(selectors, j);

                        // [tag-content] and [wildcard] are deferred in ADG→ADG
                        // conversion: their emission may need to be merged with
                        // the length constraints or with each other to stay
                        // valid in CoreLibs.
                        if (
                            shouldMergeLengthSelectors
                            && (
                                name === AdgAttributeSelectors.TagContent
                                || name === AdgAttributeSelectors.Wildcard
                            )
                        ) {
                            // Invoke the callback to trigger its side effects
                            // (e.g. the isConverted flag in convertToAdg), but
                            // discard the single-attribute pseudo-class it
                            // returns — the actual nodes are emitted after the
                            // selector loop.
                            onSpecialAttributeSelector(name, value, typeSelector);
                            if (name === AdgAttributeSelectors.TagContent) {
                                deferredTagContentValues.push(value);
                            } else {
                                deferredWildcardValues.push(value);
                            }
                            continue;
                        }

                        // Merge [min-length] and [max-length] into a single :contains() (ADG→ADG)
                        if (
                            lengthConstraints !== null
                            && (
                                name === AdgAttributeSelectors.MinLength
                                || name === AdgAttributeSelectors.MaxLength
                            )
                        ) {
                            // Invoke the callback to trigger its side effects
                            // (e.g. the isConverted flag in convertToAdg), but
                            // discard the individual :contains() it returns —
                            // the merged one is emitted after the selector loop,
                            // possibly combined with the other deferred
                            // constraints.
                            onSpecialAttributeSelector(name, value, typeSelector);
                            continue;
                        }

                        // Invoke callback and:
                        // - add returned simple selector if it's not boolean
                        // - skip adding if returned value is false
                        // - keep original simple selector if returned value is true
                        const result = onSpecialAttributeSelector(name, value, typeSelector);
                        if (typeof result !== 'boolean') {
                            convertedSelectors.push(result);
                            continue;
                        } else if (result === false) {
                            hasDroppedSelector = true;
                            continue;
                        }

                        break;
                    }

                    case 'PseudoClassSelector': {
                        const name = selector.name.value;
                        const isSupported = SUPPORTED_ADG_PSEUDO_CLASSES.has(name)
                            || SUPPORTED_UBO_PSEUDO_CLASSES.has(name);

                        // Not a special pseudo-class selector - clone as-is after
                        // the switch. The shared list is checked as well, so every
                        // name added there gets its argument validated automatically.
                        if (!isSupported && !SPECIAL_PSEUDO_CLASS_NAME_SET.has(name)) {
                            break;
                        }

                        // Throw an error if argument is missing
                        if (!selector.argument || selector.argument.value === EMPTY) {
                            throw new RuleConversionError(sprintf(
                                ERROR_MESSAGES.SPECIAL_PSEUDO_CLASS_SELECTOR_ARGUMENT_REQUIRED,
                                name,
                            ));
                        }

                        // Only the special pseudo-classes supported for conversion
                        // reach the callbacks. The `:-abp-contains()` alias is kept
                        // as-is for now (see AG-61400).
                        if (!isSupported) {
                            break;
                        }

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
                            hasDroppedSelector = true;
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

            // Emit the pseudo-classes converted from the deferred special
            // attribute selectors (ADG→ADG). They are appended at the end of
            // the complex selector, which is their original position in any
            // rule that is valid in CoreLibs: special attributes may only
            // appear on the leaf selector there.
            if (shouldMergeLengthSelectors) {
                HtmlRuleConverter.appendSpecialAttributePseudoClasses(
                    convertedSelectors,
                    deferredTagContentValues,
                    deferredWildcardValues,
                    lengthConstraints,
                );
            }

            // Dropping a special attribute selector may empty its whole
            // compound selector, which would leave a dangling combinator.
            // `*` adds no constraint of its own, so the rest of the rule keeps
            // its meaning: `##^div > *` instead of a rule uBlock rejects.
            //
            // Only a compound emptied by a drop gets `*`; one emptied by the
            // ADG→ADG move stays an error, because that path moves special
            // attribute selectors to the end of the complex selector instead
            // of dropping them.
            let normalizedSelectors = convertedSelectors;
            if (hasDroppedSelector) {
                // A complex selector that a drop left without any constraint
                // must not become a universal selector: uBlock applies `*` to
                // `html` too, and removing `html` breaks the response filter.
                // Keep the previous conversion error.
                //
                // A `*` written by the rule author does not constrain the
                // match either, so `$$* > [max-length="1"]` is rejected as
                // well: it would become `##^* > *`.
                if (!HtmlRuleConverter.hasNonUniversalSelector(convertedSelectors)) {
                    throw new RuleConversionError(ERROR_MESSAGES.EMPTY_COMPLEX_SELECTOR_AFTER_DROP);
                }

                normalizedSelectors = HtmlRuleConverter.replaceEmptyCompoundsWithUniversalSelector(
                    convertedSelectors,
                );
            }

            convertedComplexSelectors.push({
                type: 'ComplexSelector',
                children: normalizedSelectors,
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
     * Checks whether a complex selector contains at least one simple selector
     * other than the universal selector `*`.
     *
     * The universal selector adds no constraint, so a complex selector made
     * only of `*` selectors and combinators matches almost every element,
     * including `html` in the `*` case. The caller uses this check to reject a
     * complex selector that dropped special selectors left without any
     * constraint, see
     * {@link ERROR_MESSAGES.EMPTY_COMPLEX_SELECTOR_AFTER_DROP}.
     *
     * @param convertedSelectors Converted selectors of a complex selector.
     *
     * @returns `true` if at least one selector constrains the match.
     */
    private static hasNonUniversalSelector(
        convertedSelectors: (SimpleSelector | SelectorCombinator)[],
    ): boolean {
        return convertedSelectors.some((selector) => (
            selector.type !== 'SelectorCombinator'
            && (selector.type !== 'TypeSelector' || selector.value !== '*')
        ));
    }

    /**
     * Replaces empty compound selectors left by dropped special simple
     * selectors with the universal selector `*`.
     *
     * A special attribute selector may be the whole compound selector, so
     * dropping it produces a dangling combinator (`div > [max-length]` becomes
     * `div >`), which uBlock rejects. `*` adds no constraint of its own, so the
     * rest of the rule keeps its meaning: `##^div > *` instead of an invalid
     * rule lost entirely.
     *
     * The caller must ensure the complex selector keeps at least one
     * non-universal selector, see {@link hasNonUniversalSelector}: a complex
     * selector left without any constraint is a conversion error.
     *
     * @param convertedSelectors Converted selectors of a complex selector.
     *
     * @returns Converted selectors with empty compounds replaced by `*`.
     */
    private static replaceEmptyCompoundsWithUniversalSelector(
        convertedSelectors: (SimpleSelector | SelectorCombinator)[],
    ): (SimpleSelector | SelectorCombinator)[] {
        const result: (SimpleSelector | SelectorCombinator)[] = [];

        for (let i = 0; i < convertedSelectors.length; i += 1) {
            const selector = convertedSelectors[i];

            if (selector.type === 'SelectorCombinator') {
                // A combinator at the start of the complex selector or right
                // after another combinator separates an empty compound. A new
                // node is created for every empty compound, so the returned
                // AST holds no shared references.
                if (result.length === 0 || result[result.length - 1].type === 'SelectorCombinator') {
                    result.push({
                        type: 'TypeSelector',
                        value: '*',
                    });
                }
            }

            result.push(selector);
        }

        // The last compound is empty if the complex selector ends with a
        // combinator
        if (result[result.length - 1].type === 'SelectorCombinator') {
            result.push({
                type: 'TypeSelector',
                value: '*',
            });
        }

        return result;
    }

    /**
     * Checks whether a [tag-content] literal can be emitted as a standalone
     * `:contains()` pseudo-class directly followed by another special
     * pseudo-class ("chain-safe"):
     *
     * - it must not be empty and must not start with a slash — a leading `/`
     *   makes the argument look like a regular expression to CoreLibs;
     * - it must not contain quotes, parentheses, brackets, braces,
     *   backslashes or colons — CoreLibs' special pseudo-class argument
     *   scanner splits a `:contains()` chain at the next free `:`, and any
     *   of those characters would swallow the separator, silently merging
     *   the two pseudo-classes into a single bogus literal argument.
     *
     * A literal that is not chain-safe is still valid as a *single*
     * `:contains()` pseudo-class (CoreLibs takes the whole argument between
     * `(` and the closing `)` of the sole pseudo-class in the rule), but it
     * must be folded into a merged regular expression as soon as another
     * regex-like constraint has to be emitted as well.
     *
     * @param value [tag-content] value to check.
     *
     * @returns `true` if the literal is chain-safe, otherwise `false`.
     */
    private static isChainSafeLiteral(value: string): boolean {
        return value.length > 0
            && value[0] !== SLASH
            && !CHAIN_UNSAFE_LITERAL_PATTERN.test(value);
    }

    /**
     * Emits the pseudo-classes converted from the deferred special attribute
     * selectors ([tag-content], [wildcard], [min-length], [max-length]) of a
     * single complex selector, honoring the constraints of CoreLibs' HTML
     * filter:
     *
     * - at most one "tag-content" constraint (a literal `:contains()`) and one
     *   "wildcard" constraint (a regex `:contains()`) are allowed per selector,
     *   so e.g. `[wildcard="..."]` cannot be chained with
     *   `[max-length="..."]` as two regex `:contains()` pseudo-classes;
     * - a literal `:contains()` may be chained in front of a single regex
     *   `:contains()` only when it is chain-safe, see
     *   {@link HtmlRuleConverter.isChainSafeLiteral}.
     *
     * Combinations which cannot be represented as such a chain — an unsafe
     * literal plus any regex-like constraint, or several regex-like
     * constraints (multiple [wildcard] values, `[wildcard]` combined with
     * `[min/max-length]`, multiple [tag-content] values) — are merged into a
     * single regular expression instead:
     * `/^(?=.{min,max}$)(?=<glob>)(?=.*<literal>).*\/s`.
     *
     * @param convertedSelectors Converted selectors of the complex selector,
     * the emitted pseudo-classes are appended to it.
     * @param tagContentValues Deferred [tag-content] values.
     * @param wildcardGlobValues Deferred [wildcard] glob values.
     * @param lengthConstraints Deferred length constraints collected from
     * [min-length] / [max-length], or `null` if absent.
     */
    private static appendSpecialAttributePseudoClasses(
        convertedSelectors: (SimpleSelector | SelectorCombinator)[],
        tagContentValues: string[],
        wildcardGlobValues: string[],
        lengthConstraints: { min: string | null; max: string | null } | null,
    ): void {
        // Nothing was deferred
        if (
            tagContentValues.length === 0
            && wildcardGlobValues.length === 0
            && lengthConstraints === null
        ) {
            return;
        }

        const literalChainSafe = tagContentValues.length === 1
            && HtmlRuleConverter.isChainSafeLiteral(tagContentValues[0]);

        // Whether the deferred constraints require a regex `:contains()`
        // pseudo-class: either several regex-like constraints (multiple
        // [wildcard] values, or [wildcard] combined with [min/max-length]),
        // or an unsafe literal which cannot stand in front of another
        // special pseudo-class.
        const needsRegexContains = lengthConstraints !== null
            || wildcardGlobValues.length > 0
            || tagContentValues.length > 1;

        // Whether the single [tag-content] literal is emitted as a standalone
        // `:contains()` pseudo-class: always safe when it is the only special
        // pseudo-class of the selector, and safe right before a single regex
        // `:contains()` only when chain-safe; otherwise it is folded into the
        // merged regex below.
        const emitLiteralStandalone = tagContentValues.length === 1
            && (literalChainSafe || !needsRegexContains);

        if (emitLiteralStandalone) {
            convertedSelectors.push(HtmlRuleConverter.getPseudoClassSelectorNode(
                AdgPseudoClasses.Contains,
                tagContentValues[0],
            ));
        }

        // Literals which were not emitted standalone are folded into the
        // merged regex as lookaheads
        const mergedLiterals = emitLiteralStandalone
            ? tagContentValues.slice(1)
            : tagContentValues;

        // Count the constraints which still have to be emitted: when exactly
        // one remains, it keeps its own canonical single-constraint form
        const remainingConstraints = mergedLiterals.length
            + wildcardGlobValues.length
            + (lengthConstraints !== null ? 1 : 0);

        if (remainingConstraints === 0) {
            // A literal-only selection needs nothing else: even a literal
            // which is not chain-safe is valid as a single `:contains()`, as
            // CoreLibs takes the whole argument of the only pseudo-class in
            // the rule.
            return;
        }

        if (
            remainingConstraints === 1
            && mergedLiterals.length === 0
            && lengthConstraints === null
        ) {
            // A single [wildcard] constraint keeps its own canonical form
            convertedSelectors.push(HtmlRuleConverter.getPseudoClassSelectorNode(
                AdgPseudoClasses.Contains,
                RegExpUtils.globToRegExp(wildcardGlobValues[0]),
            ));
            return;
        }

        if (
            remainingConstraints === 1
            && mergedLiterals.length === 0
            && wildcardGlobValues.length === 0
        ) {
            // A single length constraint keeps its own canonical form.
            // lengthConstraints is non-null because remainingConstraints
            // is 1 and neither literals nor globs remain.
            convertedSelectors.push(HtmlRuleConverter.getPseudoClassSelectorNode(
                AdgPseudoClasses.Contains,
                RegExpUtils.getLengthRegexp(
                    lengthConstraints?.min ?? null,
                    lengthConstraints?.max ?? null,
                ),
            ));
            return;
        }

        // All remaining constraints are merged into a single regular
        // expression, each as a lookahead: length `(?=.{min,max}$)`, glob
        // `(?=<glob>)`, escaped literal `(?=.*<literal>)`.
        let mergedRegex = '/^';

        if (lengthConstraints !== null) {
            mergedRegex += RegExpUtils.getLengthLookahead(
                lengthConstraints.min,
                lengthConstraints.max,
            );
        }

        for (const glob of wildcardGlobValues) {
            mergedRegex += `(?=${RegExpUtils.globToRegExpBody(glob)})`;
        }

        for (const literal of mergedLiterals) {
            mergedRegex += `(?=.*${RegExpUtils.escapeRegexSpecials(literal)})`;
        }

        mergedRegex += '.*/s';

        convertedSelectors.push(HtmlRuleConverter.getPseudoClassSelectorNode(
            AdgPseudoClasses.Contains,
            mergedRegex,
        ));
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
     * Checks whether uBlock Origin accepts a plain-text argument in an HTML
     * filtering `:has-text()` pseudo-class.
     *
     * The parser reads a text argument with `compileText()`, which calls
     * `unquoteString()`. The unquoting must consume the whole argument,
     * otherwise uBlock rejects the rule. For example, uBlock accepts `"foo"`
     * and unquotes it to `foo`, but rejects `"foo" ` because the space follows
     * the closing quote.
     *
     * @param argument Argument to check.
     *
     * @returns `true` if uBlock Origin accepts the argument, `false` otherwise.
     */
    private static isUboTextArgumentSupported(argument: string): boolean {
        if (argument === EMPTY) {
            return false;
        }

        const quote = argument.charAt(0);
        if (quote !== DOUBLE_QUOTE && quote !== SINGLE_QUOTE) {
            return true;
        }

        let index = 1;

        while (index < argument.length) {
            const char = argument.charAt(index);

            if (char === quote) {
                index += 1;
                break;
            }

            if (char === BACKSLASH) {
                index += 1;

                if (index === argument.length) {
                    break;
                }
            }

            index += 1;
        }

        return index === argument.length;
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
     * Validates and normalizes the value of the `[min-length]` or
     * `[max-length]` special attribute selector.
     *
     * The returned value is a string of plain decimal digits with no leading
     * whitespace, no leading `+` and no leading zeros (except a single `0` for
     * zero). The value never goes through a JavaScript `number`, so large
     * values are neither rounded nor converted to exponent notation.
     *
     * The value is not bounded by {@link ADG_HTML_CONVERSION_MAX_LENGTH}:
     * that constant bounds only the regular expression generated from uBlock
     * `:min-text-length()`. AdGuard products apply the `[min-length]` and
     * `[max-length]` attributes natively, and uBlock applies
     * `:min-text-length()` natively.
     *
     * @param name Name of the special attribute selector.
     * @param value Original attribute value.
     *
     * @returns Normalized value as a string of decimal digits.
     *
     * @throws If the value is not a valid non-negative integer.
     */
    private static resolveAdgLengthAttributeValue(name: string, value: string): string {
        HtmlRuleConverter.assertValidLengthValue(
            name,
            value,
            ERROR_MESSAGES.SPECIAL_ATTRIBUTE_SELECTOR_VALUE_INT,
            ERROR_MESSAGES.SPECIAL_ATTRIBUTE_SELECTOR_VALUE_POSITIVE,
            ADG_LENGTH_ATTRIBUTE_VALUE_PATTERN,
        );

        return HtmlRuleConverter.normalizeLengthDigits(value);
    }

    /**
     * Normalizes a validated length value to plain decimal digits.
     *
     * Strips the leading whitespace and the optional `+` allowed by
     * {@link ADG_LENGTH_ATTRIBUTE_VALUE_PATTERN}, then strips leading zeros.
     * The pattern already rejects trailing whitespace, so only the leading
     * side needs stripping. A zero result is kept as a single `0`.
     *
     * @param value Validated length value.
     *
     * @returns Normalized value as a string of decimal digits.
     */
    private static normalizeLengthDigits(value: string): string {
        const digits = value.trimStart().replace(/^\+/, '');
        const withoutLeadingZeros = digits.replace(/^0+/, '');

        return withoutLeadingZeros === EMPTY ? '0' : withoutLeadingZeros;
    }

    /**
     * Compares two normalized strings of decimal digits without `number`
     * conversion, so large values keep their full precision.
     *
     * @param left First normalized digit string.
     * @param right Second normalized digit string.
     *
     * @returns A negative number if `left` is less than `right`, `0` if they
     * are equal, and a positive number if `left` is greater than `right`.
     */
    private static compareLengthDigitStrings(left: string, right: string): number {
        if (left.length !== right.length) {
            return left.length > right.length ? 1 : -1;
        }

        if (left === right) {
            return 0;
        }

        return left > right ? 1 : -1;
    }

    /**
     * Asserts that the given special attribute / pseudo-class length value is valid.
     *
     * @param name Name of the attribute or pseudo-class.
     * @param value Value to parse.
     * @param notIntErrorMessage Error message when the value is not an integer.
     * @param notPositiveErrorMessage Error message when the value is not positive.
     * @param valuePattern Pattern that the value must match to be an integer.
     *
     * @throws If the value is not a valid number or not positive.
     */
    private static assertValidLengthValue(
        name: string,
        value: string,
        notIntErrorMessage: string,
        notPositiveErrorMessage: string,
        valuePattern: RegExp,
    ): void {
        const parsed = Number(value);

        // A negative value is a valid number, but not a valid length. Check it
        // before the pattern check to keep the dedicated error message.
        if (parsed < 0) {
            throw new RuleConversionError(
                sprintf(
                    notPositiveErrorMessage,
                    name,
                    value,
                ),
            );
        }

        // The pattern is stricter than `Number()`: it also rejects `NaN`
        // (`abc`), `1e2`, `Infinity` and whitespace-only values.
        if (!valuePattern.test(value)) {
            throw new RuleConversionError(
                sprintf(
                    notIntErrorMessage,
                    name,
                    value,
                ),
            );
        }
    }
}
