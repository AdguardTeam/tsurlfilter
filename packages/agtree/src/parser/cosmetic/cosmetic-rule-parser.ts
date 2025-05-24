import { sprintf } from 'sprintf-js';
import { hasToken, TokenType } from '@adguard/css-tokenizer';

import { CosmeticRuleSeparatorUtils } from '../../utils/cosmetic-rule-separator.js';
import { AdblockSyntax } from '../../utils/adblockers.js';
import { DomainListParser } from '../misc/domain-list-parser.js';
import { ModifierListParser } from '../misc/modifier-list.js';
import {
    ADG_SCRIPTLET_MASK,
    CSS_BLOCK_OPEN,
    CSS_BLOCK_CLOSE,
    CLOSE_SQUARE_BRACKET,
    DOLLAR_SIGN,
    OPEN_SQUARE_BRACKET,
    UBO_HTML_MASK,
    UBO_SCRIPTLET_MASK,
    UBO_SCRIPTLET_MASK_LEGACY,
} from '../../utils/constants.js';
import {
    type AnyCosmeticRule,
    type CosmeticRuleSeparator,
    CosmeticRuleType,
    type ModifierList,
    RuleCategory,
    type Value,
    type CssInjectionRuleBody,
    type ElementHidingRuleBody,
    type CosmeticRule,
    type ElementHidingRule,
    type CssInjectionRule,
    type ScriptletInjectionRule,
    type JsInjectionRule,
    type HtmlFilteringRule,
    type UboSelector,
} from '../../nodes/index.js';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error.js';
import { StringUtils } from '../../utils/string.js';
import { CommentParser } from '../comment/comment-parser.js';
import { defaultParserOptions } from '../options.js';
import { UboSelectorParser } from '../css/ubo-selector-parser.js';
import { AdgCssInjectionParser } from '../css/adg-css-injection-parser.js';
import { AbpSnippetInjectionBodyParser } from './body/abp-snippet-injection-body-parser.js';
import { UboScriptletInjectionBodyParser } from './body/ubo-scriptlet-injection-body-parser.js';
import { AdgScriptletInjectionBodyParser } from './body/adg-scriptlet-injection-body-parser.js';
import { BaseParser } from '../base-parser.js';
import { UboPseudoName } from '../../common/ubo-selector-common.js';

/**
 * Possible error messages for uBO selectors. Formatted with {@link sprintf}.
 */
export const ERROR_MESSAGES = {
    EMPTY_RULE_BODY: 'Empty rule body',
    INVALID_BODY_FOR_SEPARATOR: "Body '%s' is not valid for the '%s' cosmetic rule separator",
    MISSING_ADGUARD_MODIFIER_LIST_END: "Missing '%s' at the end of the AdGuard modifier list in pattern '%s'",
    MISSING_ADGUARD_MODIFIER_LIST_MARKER: "Missing '%s' at the beginning of the AdGuard modifier list in pattern '%s'",
    SYNTAXES_CANNOT_BE_MIXED: "'%s' syntax cannot be mixed with '%s' syntax",
    SYNTAX_DISABLED: "Parsing '%s' syntax is disabled, but the rule uses it",
};

const ADG_CSS_INJECTION_PATTERN = /^(?:.+){(?:.+)}$/;

/**
 * `CosmeticRuleParser` is responsible for parsing cosmetic rules.
 *
 * Where possible, it automatically detects the difference between supported syntaxes:
 *  - AdGuard
 *  - uBlock Origin
 *  - Adblock Plus
 *
 * If the syntax is common / cannot be determined, the parser gives `Common` syntax.
 *
 * Please note that syntactically correct rules are parsed even if they are not actually
 * compatible with the given adblocker. This is a completely natural behavior, meaningful
 * checking of compatibility is not done at the parser level.
 */
// TODO: Make raw body parsing optional
// TODO: Split into smaller sections
export class CosmeticRuleParser extends BaseParser {
    /**
     * Determines whether a rule is a cosmetic rule. The rule is considered cosmetic if it
     * contains a cosmetic rule separator.
     *
     * @param raw Raw rule
     * @returns `true` if the rule is a cosmetic rule, `false` otherwise
     */
    public static isCosmeticRule(raw: string) {
        const trimmed = raw.trim();

        if (CommentParser.isCommentRule(trimmed)) {
            return false;
        }

        return CosmeticRuleSeparatorUtils.find(trimmed) !== null;
    }

    /**
     * Parses a cosmetic rule. The structure of the cosmetic rules:
     *  - pattern (AdGuard pattern can have modifiers, other syntaxes don't)
     *  - separator
     *  - body
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @returns
     * Parsed cosmetic rule AST or null if it failed to parse based on the known cosmetic rules
     * @throws If the input matches the cosmetic rule pattern but syntactically invalid
     */
    // TODO: Split to smaller functions
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): AnyCosmeticRule | null {
        // Find cosmetic rule separator - each cosmetic rule must have it, otherwise it is not a cosmetic rule
        const separatorResult = CosmeticRuleSeparatorUtils.find(raw);

        if (!separatorResult) {
            return null;
        }

        let syntax: AdblockSyntax = AdblockSyntax.Common;
        let modifiers: ModifierList | undefined;

        const patternStart = StringUtils.skipWS(raw);
        const patternEnd = StringUtils.skipWSBack(raw, separatorResult.start - 1) + 1;

        const bodyStart = StringUtils.skipWS(raw, separatorResult.end);
        const bodyEnd = StringUtils.skipWSBack(raw) + 1;

        // Note we use '<=' instead of '===' because we have bidirectional trim
        if (bodyEnd <= bodyStart) {
            throw new AdblockSyntaxError(
                ERROR_MESSAGES.EMPTY_RULE_BODY,
                baseOffset,
                baseOffset + raw.length,
            );
        }

        // Step 1. Parse the pattern: it can be a domain list or a domain list with modifiers (AdGuard)
        const rawPattern = raw.slice(patternStart, patternEnd);
        let patternOffset = patternStart;

        if (rawPattern[patternOffset] === OPEN_SQUARE_BRACKET) {
            // Save offset to the beginning of the modifier list for later
            const modifierListStart = patternOffset;

            // Consume opening square bracket
            patternOffset += 1;

            // Skip whitespace after opening square bracket
            patternOffset = StringUtils.skipWS(rawPattern, patternOffset);

            // Open square bracket should be followed by a modifier separator: [$
            if (rawPattern[patternOffset] !== DOLLAR_SIGN) {
                throw new AdblockSyntaxError(
                    sprintf(ERROR_MESSAGES.MISSING_ADGUARD_MODIFIER_LIST_MARKER, DOLLAR_SIGN, rawPattern),
                    baseOffset + patternOffset,
                    baseOffset + rawPattern.length,
                );
            }

            // Consume modifier separator
            patternOffset += 1;

            // Skip whitespace after modifier separator
            patternOffset = StringUtils.skipWS(rawPattern, patternOffset);

            // Modifier list ends with the last unescaped square bracket
            // We search for the last unescaped square bracket, because some modifiers can contain square brackets,
            // e.g. [$domain=/example[0-9]\.(com|org)/]##.ad
            const modifierListEnd = StringUtils.findLastUnescapedCharacter(rawPattern, CLOSE_SQUARE_BRACKET);

            if (modifierListEnd === -1) {
                throw new AdblockSyntaxError(
                    sprintf(ERROR_MESSAGES.MISSING_ADGUARD_MODIFIER_LIST_END, CLOSE_SQUARE_BRACKET, rawPattern),
                    baseOffset + patternOffset,
                    baseOffset + rawPattern.length,
                );
            }

            // Parse modifier list
            modifiers = ModifierListParser.parse(
                raw.slice(patternOffset, modifierListEnd),
                options,
                baseOffset + patternOffset,
            );

            // Expand modifier list location to include the opening and closing square brackets
            if (options.isLocIncluded) {
                modifiers.start = baseOffset + modifierListStart;
                modifiers.end = baseOffset + modifierListEnd + 1;
            }

            // Consume modifier list
            patternOffset = modifierListEnd + 1;

            // Change the syntax to ADG
            syntax = AdblockSyntax.Adg;
        }

        // Skip whitespace after modifier list
        patternOffset = StringUtils.skipWS(rawPattern, patternOffset);

        // Parse domains
        const domains = DomainListParser.parse(
            rawPattern.slice(patternOffset),
            options,
            baseOffset + patternOffset,
        );

        // Step 2. Parse the separator
        const separator: Value<CosmeticRuleSeparator> = {
            type: 'Value',
            value: separatorResult.separator,
        };

        if (options.isLocIncluded) {
            separator.start = baseOffset + separatorResult.start;
            separator.end = baseOffset + separatorResult.end;
        }

        const exception = CosmeticRuleSeparatorUtils.isException(separatorResult.separator);

        // Step 3. Parse the rule body
        let rawBody = raw.slice(bodyStart, bodyEnd);

        /**
         * Ensures that the rule syntax is common or the expected one. This function is used to prevent mixing
         * different syntaxes in the same rule.
         *
         * @example
         * The following rule mixes AdGuard and uBO syntaxes, because it uses AdGuard modifier list and uBO
         * CSS injection:
         * ```adblock
         * [$path=/something]example.com##.foo:style(color: red)
         * ```
         * In this case, parser sets syntax to AdGuard, because it detects the AdGuard modifier list, but
         * when parsing the rule body, it detects uBO CSS injection, which is not compatible with AdGuard.
         *
         * @param expectedSyntax Expected syntax
         * @throws If the rule syntax is not common or the expected one
         */
        const expectCommonOrSpecificSyntax = (expectedSyntax: AdblockSyntax) => {
            if (syntax !== AdblockSyntax.Common && syntax !== expectedSyntax) {
                throw new AdblockSyntaxError(
                    sprintf(ERROR_MESSAGES.SYNTAXES_CANNOT_BE_MIXED, expectedSyntax, syntax),
                    baseOffset + patternStart,
                    baseOffset + bodyEnd,
                );
            }
        };

        let uboSelector: UboSelector | undefined;

        // Parse UBO rule modifiers
        if (options.parseUboSpecificRules) {
            uboSelector = UboSelectorParser.parse(rawBody, options, baseOffset + bodyStart);
            rawBody = uboSelector.selector.value;

            // Do not allow ADG modifiers and UBO modifiers in the same rule
            if (uboSelector.modifiers && uboSelector.modifiers.children.length > 0) {
                // If modifiers are present, that means that the ADG modifier list was parsed
                expectCommonOrSpecificSyntax(AdblockSyntax.Ubo);

                // Change the syntax to uBO
                syntax = AdblockSyntax.Ubo;

                // Store the rule modifiers
                // Please note that not each special uBO modifier is a rule modifier, some of them are
                // used for CSS injection, for example `:style()` and `:remove()`
                for (const modifier of uboSelector.modifiers.children) {
                    // TODO: Add support for matches-media and element hiding rules
                    // TODO: Improve this condition if new uBO modifiers are added
                    if (modifier.name.value === UboPseudoName.MatchesPath) {
                        // Prepare the modifier list if it does not exist yet
                        if (!modifiers) {
                            modifiers = {
                                type: 'ModifierList',
                                children: [],
                            };

                            if (options.isLocIncluded) {
                                modifiers.start = baseOffset + bodyStart;
                                modifiers.end = baseOffset + bodyEnd;
                            }
                        }

                        modifiers.children.push(modifier);
                    }
                }
            }
        }

        // At this point, we don not exactly yet know the following properties, but we know everything else,
        // so we can create a base rule object with the known properties, and then we calculate the rest
        // of the properties and add them to the base rule object.

        // Note: we already know something about syntax, but need to handle these cases:
        //  - If syntax is common, but the rule is an AdGuard rule, we need to change the syntax to AdGuard
        //  - If syntax is uBO, but the rule is an AdGuard rule (or vice versa), we need to throw an error
        type RestProps = 'syntax' | 'type' | 'body';

        const raws = {
            text: raw,
        };

        const baseRule: Omit<CosmeticRule, RestProps> = {
            category: RuleCategory.Cosmetic,
            exception,
            modifiers,
            domains,
            separator,
        };

        if (options.includeRaws) {
            baseRule.raws = raws;
        }

        if (options.isLocIncluded) {
            baseRule.start = baseOffset;
            baseRule.end = baseOffset + raw.length;
        }

        const parseUboCssInjection = (): Pick<CssInjectionRule, RestProps> | null => {
            if (!uboSelector || !uboSelector.modifiers || uboSelector.modifiers.children?.length < 1) {
                return null;
            }

            expectCommonOrSpecificSyntax(AdblockSyntax.Ubo);

            const selectorList = uboSelector.selector;
            let declarationList: Value | undefined;
            let mediaQueryList: Value | undefined;
            let remove = false;

            for (const modifier of uboSelector.modifiers.children) {
                switch (modifier.name.value) {
                    case UboPseudoName.Style:
                        declarationList = modifier.value;
                        break;

                    case UboPseudoName.Remove:
                        declarationList = {
                            type: 'Value',
                            value: '',
                        };

                        remove = true;
                        break;

                    case UboPseudoName.MatchesMedia:
                        mediaQueryList = modifier.value;
                        break;

                    default:
                        break;
                }
            }

            // If neither `:style()` nor `:remove()` is present
            if (!declarationList) {
                return null;
            }

            const body: CssInjectionRuleBody = {
                type: 'CssInjectionRuleBody',
                selectorList,
                declarationList,
                mediaQueryList,
                remove,
            };

            if (options.isLocIncluded) {
                body.start = baseOffset + bodyStart;
                body.end = baseOffset + bodyEnd;
            }

            return {
                syntax: AdblockSyntax.Ubo,
                type: CosmeticRuleType.CssInjectionRule,
                body,
            };
        };

        const parseElementHiding = (): Pick<ElementHidingRule, RestProps> => {
            const selectorList: Value = {
                type: 'Value',
                value: rawBody,
            };

            if (options.isLocIncluded) {
                selectorList.start = baseOffset + bodyStart;
                selectorList.end = baseOffset + bodyEnd;
            }

            const body: ElementHidingRuleBody = {
                type: 'ElementHidingRuleBody',
                selectorList,
            };

            if (options.isLocIncluded) {
                body.start = baseOffset + bodyStart;
                body.end = baseOffset + bodyEnd;
            }

            return {
                syntax,
                type: CosmeticRuleType.ElementHidingRule,
                body,
            };
        };

        const parseAdgCssInjection = (): Pick<CssInjectionRule, RestProps> | null => {
            // TODO: Improve this detection. Need to cover the following cases:
            // #$#body { color: red;
            // #$#@media (min-width: 100px) { body { color: red; }

            // ADG CSS injection
            if (!ADG_CSS_INJECTION_PATTERN.test(rawBody)) {
                return null;
            }

            expectCommonOrSpecificSyntax(AdblockSyntax.Adg);

            return {
                syntax: AdblockSyntax.Adg,
                type: CosmeticRuleType.CssInjectionRule,
                body: AdgCssInjectionParser.parse(rawBody, options, baseOffset + bodyStart),
            };
        };

        /**
         * Parses Adb CSS injection rules
         * eg: example.com##.foo { display: none; }
         *
         * @returns parsed rule
         */
        const parseAbpCssInjection = (): Pick<CssInjectionRule, RestProps> | null => {
            if (!options.parseAbpSpecificRules) {
                return null;
            }

            // check if the rule contains both CSS block open and close characters
            // if none of them is present we can stop parsing
            if (rawBody.indexOf(CSS_BLOCK_OPEN) === -1 && rawBody.indexOf(CSS_BLOCK_CLOSE) === -1) {
                return null;
            }

            if (!hasToken(rawBody, new Set([TokenType.OpenCurlyBracket, TokenType.CloseCurlyBracket]))) {
                return null;
            }

            // try to parse the raw body as an AdGuard CSS injection rule
            const body = AdgCssInjectionParser.parse(rawBody, options, baseOffset + bodyStart);
            // if the parsed rule type is a 'CssInjectionRuleBody', return the parsed rule
            return {
                syntax: AdblockSyntax.Abp,
                type: CosmeticRuleType.CssInjectionRule,
                body,
            };
        };

        const parseAbpSnippetInjection = (): Pick<ScriptletInjectionRule, RestProps> | null => {
            if (!options.parseAbpSpecificRules) {
                throw new AdblockSyntaxError(
                    sprintf(ERROR_MESSAGES.SYNTAX_DISABLED, AdblockSyntax.Abp),
                    baseOffset + bodyStart,
                    baseOffset + bodyEnd,
                );
            }

            expectCommonOrSpecificSyntax(AdblockSyntax.Abp);

            const body = AbpSnippetInjectionBodyParser.parse(rawBody, options, baseOffset + bodyStart);

            if (options.isLocIncluded) {
                body.start = baseOffset + bodyStart;
                body.end = baseOffset + bodyEnd;
            }

            return {
                syntax: AdblockSyntax.Abp,
                type: CosmeticRuleType.ScriptletInjectionRule,
                body,
            };
        };

        const parseUboScriptletInjection = (): Pick<ScriptletInjectionRule, RestProps> | null => {
            if (!rawBody.startsWith(UBO_SCRIPTLET_MASK) && !rawBody.startsWith(UBO_SCRIPTLET_MASK_LEGACY)) {
                return null;
            }

            if (!options.parseUboSpecificRules) {
                throw new AdblockSyntaxError(
                    sprintf(ERROR_MESSAGES.SYNTAX_DISABLED, AdblockSyntax.Ubo),
                    baseOffset + bodyStart,
                    baseOffset + bodyEnd,
                );
            }

            expectCommonOrSpecificSyntax(AdblockSyntax.Ubo);

            const body = UboScriptletInjectionBodyParser.parse(rawBody, options, baseOffset + bodyStart);
            if (options.isLocIncluded) {
                body.start = baseOffset + bodyStart;
                body.end = baseOffset + bodyEnd;
            }

            return {
                syntax: AdblockSyntax.Ubo,
                type: CosmeticRuleType.ScriptletInjectionRule,
                body,
            };
        };

        const parseAdgScriptletInjection = (): Pick<ScriptletInjectionRule, RestProps> | null => {
            // ADG scriptlet injection
            if (!rawBody.startsWith(ADG_SCRIPTLET_MASK)) {
                return null;
            }

            expectCommonOrSpecificSyntax(AdblockSyntax.Adg);

            const body = AdgScriptletInjectionBodyParser.parse(rawBody, options, baseOffset + bodyStart);

            if (options.isLocIncluded) {
                body.start = baseOffset + bodyStart;
                body.end = baseOffset + bodyEnd;
            }

            return {
                syntax: AdblockSyntax.Adg,
                type: CosmeticRuleType.ScriptletInjectionRule,
                body,
            };
        };

        const parseAdgJsInjection = (): Pick<JsInjectionRule, RestProps> => {
            expectCommonOrSpecificSyntax(AdblockSyntax.Adg);

            const body: Value = {
                type: 'Value',
                value: rawBody,
            };

            if (options.isLocIncluded) {
                body.start = baseOffset + bodyStart;
                body.end = baseOffset + bodyEnd;
            }

            return {
                syntax: AdblockSyntax.Adg,
                type: CosmeticRuleType.JsInjectionRule,
                body,
            };
        };

        const parseUboHtmlFiltering = (): Pick<HtmlFilteringRule, RestProps> | null => {
            if (!rawBody.startsWith(UBO_HTML_MASK)) {
                return null;
            }

            if (!options.parseUboSpecificRules) {
                throw new AdblockSyntaxError(
                    sprintf(ERROR_MESSAGES.SYNTAX_DISABLED, AdblockSyntax.Ubo),
                    baseOffset + bodyStart,
                    baseOffset + bodyEnd,
                );
            }

            expectCommonOrSpecificSyntax(AdblockSyntax.Ubo);

            const body: Value = {
                type: 'Value',
                value: rawBody,
            };

            if (options.isLocIncluded) {
                body.start = baseOffset + bodyStart;
                body.end = baseOffset + bodyEnd;
            }

            return {
                syntax: AdblockSyntax.Ubo,
                type: CosmeticRuleType.HtmlFilteringRule,
                body,
            };
        };

        const parseAdgHtmlFiltering = (): Pick<HtmlFilteringRule, RestProps> => {
            expectCommonOrSpecificSyntax(AdblockSyntax.Adg);

            const body: Value = {
                type: 'Value',
                value: rawBody,
            };

            if (options.isLocIncluded) {
                body.start = baseOffset + bodyStart;
                body.end = baseOffset + bodyEnd;
            }

            return {
                syntax: AdblockSyntax.Adg,
                type: CosmeticRuleType.HtmlFilteringRule,
                body,
            };
        };

        // Create a fast lookup table for cosmetic rule separators and their parsing functions.
        // One separator can have multiple parsing functions. If the first function returns null,
        // the next function is called, and so on.
        // If all functions return null, an error should be thrown.
        const separatorMap = {
            '##': [
                parseUboHtmlFiltering,
                parseUboScriptletInjection,
                parseUboCssInjection,
                parseAbpCssInjection,
                parseElementHiding,
            ],
            '#@#': [
                parseUboHtmlFiltering,
                parseUboScriptletInjection,
                parseUboCssInjection,
                parseAbpCssInjection,
                parseElementHiding,
            ],

            '#?#': [parseUboCssInjection, parseAbpCssInjection, parseElementHiding],
            '#@?#': [parseUboCssInjection, parseAbpCssInjection, parseElementHiding],

            '#$#': [parseAdgCssInjection, parseAbpSnippetInjection],
            '#@$#': [parseAdgCssInjection, parseAbpSnippetInjection],
            '#$?#': [parseAdgCssInjection],
            '#@$?#': [parseAdgCssInjection],

            '#%#': [parseAdgScriptletInjection, parseAdgJsInjection],
            '#@%#': [parseAdgScriptletInjection, parseAdgJsInjection],

            $$: [parseAdgHtmlFiltering],
            '$@$': [parseAdgHtmlFiltering],
        };

        const parseFunctions = separatorMap[separatorResult.separator];

        let restProps;

        for (const parseFunction of parseFunctions) {
            restProps = parseFunction();

            if (restProps) {
                break;
            }
        }

        // If none of the parsing functions returned a result, it means that the rule is unknown / invalid.
        if (!restProps) {
            throw new AdblockSyntaxError(
                sprintf(ERROR_MESSAGES.INVALID_BODY_FOR_SEPARATOR, rawBody, separatorResult.separator),
                baseOffset + bodyStart,
                baseOffset + bodyEnd,
            );
        }

        // Combine the base rule with the rest of the properties.
        return {
            ...baseRule,
            ...restProps,
        };
    }
}
