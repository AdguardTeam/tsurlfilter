/* eslint-disable no-param-reassign */
import { sprintf } from 'sprintf-js';

import { CosmeticRuleSeparatorUtils } from '../../utils/cosmetic-rule-separator';
import { AdblockSyntax } from '../../utils/adblockers';
import { DomainListParser } from '../misc/domain-list';
import { ModifierListParser } from '../misc/modifier-list';
import {
    ADG_SCRIPTLET_MASK,
    CLOSE_PARENTHESIS,
    CLOSE_SQUARE_BRACKET,
    COLON,
    DOLLAR_SIGN,
    EMPTY,
    NULL,
    OPEN_PARENTHESIS,
    OPEN_SQUARE_BRACKET,
    SPACE,
    UBO_HTML_MASK,
    UBO_SCRIPTLET_MASK,
    UBO_SCRIPTLET_MASK_LEGACY,
} from '../../utils/constants';
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
    BinaryTypeMap,
    SYNTAX_SERIALIZATION_MAP,
    SYNTAX_DESERIALIZATION_MAP,
    type ScriptletInjectionRuleBody,
    type DomainList,
} from '../common';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { StringUtils } from '../../utils/string';
import { CommentRuleParser } from '../comment';
import { defaultParserOptions } from '../options';
import { UboPseudoName, type UboSelector, UboSelectorParser } from '../css/ubo-selector';
import { AdgCssInjectionParser } from '../css/adg-css-injection';
import { AbpSnippetInjectionBodyParser } from './body/abp-snippet';
import { UboScriptletInjectionBodyParser } from './body/ubo-scriptlet';
import { AdgScriptletInjectionBodyParser } from './body/adg-scriptlet';
import { ParserBase } from '../interface';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { ValueParser } from '../misc/value';
import { isUndefined } from '../../utils/type-guards';
import { BINARY_SCHEMA_VERSION } from '../../utils/binary-schema-version';

/**
 * Value map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const SEPARATOR_SERIALIZATION_MAP = new Map<string, number>([
    ['##', 0],
    ['#@#', 1],

    ['#?#', 2],
    ['#@?#', 3],

    ['#$#', 4],
    ['#$?#', 5],
    ['#@$#', 6],
    ['#@$?#', 7],

    ['#%#', 8],
    ['#@%#', 9],

    ['$$', 10],
    ['$@$', 11],
]);

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
const SEPARATOR_DESERIALIZATION_MAP = new Map<number, string>(
    Array.from(SEPARATOR_SERIALIZATION_MAP).map(([key, value]) => [value, key]),
);

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
const COSMETIC_RULE_TYPE_DESERIALIZATION_MAP = new Map<BinaryTypeMap, CosmeticRuleType>([
    [BinaryTypeMap.ElementHidingRule, CosmeticRuleType.ElementHidingRule],
    [BinaryTypeMap.CssInjectionRule, CosmeticRuleType.CssInjectionRule],
    [BinaryTypeMap.ScriptletInjectionRule, CosmeticRuleType.ScriptletInjectionRule],
    [BinaryTypeMap.JsInjectionRule, CosmeticRuleType.JsInjectionRule],
    [BinaryTypeMap.HtmlFilteringRule, CosmeticRuleType.HtmlFilteringRule],
]);

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const enum ElementHidingRuleSerializationMap {
    SelectorList = 1,
    Start,
    End,
}

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const enum CssInjectionRuleSerializationMap {
    SelectorList = 1,
    DeclarationList,
    MediaQueryList,
    Remove,
    Start,
    End,
}

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const enum CosmeticRuleSerializationMap {
    Syntax = 1,
    Exception,
    Separator,
    Modifiers,
    Domains,
    Body,
    Start,
    End,
}

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
export class CosmeticRuleParser extends ParserBase {
    /**
     * Determines whether a rule is a cosmetic rule. The rule is considered cosmetic if it
     * contains a cosmetic rule separator.
     *
     * @param raw Raw rule
     * @returns `true` if the rule is a cosmetic rule, `false` otherwise
     */
    public static isCosmeticRule(raw: string) {
        const trimmed = raw.trim();

        if (CommentRuleParser.isCommentRule(trimmed)) {
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

        let syntax = AdblockSyntax.Common;
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
            '##': [parseUboHtmlFiltering, parseUboScriptletInjection, parseUboCssInjection, parseElementHiding],
            '#@#': [parseUboHtmlFiltering, parseUboScriptletInjection, parseUboCssInjection, parseElementHiding],

            '#?#': [parseUboCssInjection, parseElementHiding],
            '#@?#': [parseUboCssInjection, parseElementHiding],

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

    /**
     * Generates the rule pattern from the AST.
     *
     * @param node Cosmetic rule node
     * @returns Raw rule pattern
     * @example
     * - '##.foo' → ''
     * - 'example.com,example.org##.foo' → 'example.com,example.org'
     * - '[$path=/foo/bar]example.com##.foo' → '[$path=/foo/bar]example.com'
     */
    public static generatePattern(node: AnyCosmeticRule): string {
        let result = EMPTY;

        // AdGuard modifiers (if any)
        if (node.syntax === AdblockSyntax.Adg && node.modifiers && node.modifiers.children.length > 0) {
            result += OPEN_SQUARE_BRACKET;
            result += DOLLAR_SIGN;
            result += ModifierListParser.generate(node.modifiers);
            result += CLOSE_SQUARE_BRACKET;
        }

        // Domain list (if any)
        result += DomainListParser.generate(node.domains);

        return result;
    }

    /**
     * Generates the rule body from the node.
     *
     * @param node Cosmetic rule node
     * @returns Raw rule body
     * @example
     * - '##.foo' → '.foo'
     * - 'example.com,example.org##.foo' → '.foo'
     * - 'example.com#%#//scriptlet('foo')' → '//scriptlet('foo')'
     */
    public static generateBody(node: AnyCosmeticRule): string {
        let result = EMPTY;

        // Body
        switch (node.type) {
            case CosmeticRuleType.ElementHidingRule:
                result = node.body.selectorList.value;
                break;

            case CosmeticRuleType.CssInjectionRule:
                if (node.syntax === AdblockSyntax.Adg) {
                    result = AdgCssInjectionParser.generate(node.body);
                } else if (node.syntax === AdblockSyntax.Ubo) {
                    if (node.body.mediaQueryList) {
                        result += COLON;
                        result += UboPseudoName.MatchesMedia;
                        result += OPEN_PARENTHESIS;
                        result += node.body.mediaQueryList.value;
                        result += CLOSE_PARENTHESIS;
                        result += SPACE;
                    }

                    result += node.body.selectorList.value;

                    if (node.body.remove) {
                        result += COLON;
                        result += UboPseudoName.Remove;
                        result += OPEN_PARENTHESIS;
                        result += CLOSE_PARENTHESIS;
                    } else if (node.body.declarationList) {
                        result += COLON;
                        result += UboPseudoName.Style;
                        result += OPEN_PARENTHESIS;
                        result += node.body.declarationList.value;
                        result += CLOSE_PARENTHESIS;
                    }
                }
                break;

            case CosmeticRuleType.HtmlFilteringRule:
            case CosmeticRuleType.JsInjectionRule:
                result = node.body.value;
                break;

            case CosmeticRuleType.ScriptletInjectionRule:
                switch (node.syntax) {
                    case AdblockSyntax.Adg:
                        result = AdgScriptletInjectionBodyParser.generate(node.body);
                        break;

                    case AdblockSyntax.Abp:
                        result = AbpSnippetInjectionBodyParser.generate(node.body);
                        break;

                    case AdblockSyntax.Ubo:
                        result = UboScriptletInjectionBodyParser.generate(node.body);
                        break;

                    default:
                        throw new Error('Scriptlet rule should have an explicit syntax');
                }
                break;

            default:
                throw new Error('Unknown cosmetic rule type');
        }

        return result;
    }

    /**
     * Converts a cosmetic rule AST into a string.
     *
     * @param node Cosmetic rule AST
     * @returns Raw string
     */
    public static generate(node: AnyCosmeticRule): string {
        let result = EMPTY;

        // Pattern
        result += CosmeticRuleParser.generatePattern(node);

        // Separator
        result += node.separator.value;

        // uBO rule modifiers
        if (node.syntax === AdblockSyntax.Ubo && node.modifiers) {
            node.modifiers.children.forEach((modifier) => {
                result += COLON;
                result += modifier.name.value;
                if (modifier.value) {
                    result += OPEN_PARENTHESIS;
                    result += modifier.value.value;
                    result += CLOSE_PARENTHESIS;
                }
            });

            // If there are at least one modifier, add a space
            if (node.modifiers.children.length) {
                result += SPACE;
            }
        }

        // Body
        result += CosmeticRuleParser.generateBody(node);

        return result;
    }

    /**
     * Serializes an element hiding rule body node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    private static serializeElementHidingBody(node: ElementHidingRuleBody, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.ElementHidingRuleBody);

        buffer.writeUint8(ElementHidingRuleSerializationMap.SelectorList);
        ValueParser.serialize(node.selectorList, buffer);

        if (!isUndefined(node.start)) {
            buffer.writeUint8(ElementHidingRuleSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(ElementHidingRuleSerializationMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }

    /**
     * Deserializes an element hiding rule body node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    private static deserializeElementHidingBody(buffer: InputByteBuffer, node: Partial<ElementHidingRuleBody>): void {
        buffer.assertUint8(BinaryTypeMap.ElementHidingRuleBody);

        node.type = 'ElementHidingRuleBody';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case ElementHidingRuleSerializationMap.SelectorList:
                    ValueParser.deserialize(buffer, node.selectorList = {} as Value);
                    break;

                case ElementHidingRuleSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case ElementHidingRuleSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Unknown property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }

    /**
     * Serializes a CSS injection rule body node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    private static serializeCssInjectionBody(node: CssInjectionRuleBody, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.CssInjectionRuleBody);

        if (node.mediaQueryList) {
            buffer.writeUint8(CssInjectionRuleSerializationMap.MediaQueryList);
            ValueParser.serialize(node.mediaQueryList, buffer);
        }

        buffer.writeUint8(CssInjectionRuleSerializationMap.SelectorList);
        ValueParser.serialize(node.selectorList, buffer);

        if (node.declarationList) {
            buffer.writeUint8(CssInjectionRuleSerializationMap.DeclarationList);
            ValueParser.serialize(node.declarationList, buffer);
        }

        if (node.remove) {
            buffer.writeUint8(CssInjectionRuleSerializationMap.Remove);
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(CssInjectionRuleSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(CssInjectionRuleSerializationMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }

    /**
     * Deserializes CSS injection rule body node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    private static deserializeCssInjectionBody(buffer: InputByteBuffer, node: CssInjectionRuleBody): void {
        buffer.assertUint8(BinaryTypeMap.CssInjectionRuleBody);

        node.type = 'CssInjectionRuleBody';
        node.remove = false;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case CssInjectionRuleSerializationMap.MediaQueryList:
                    ValueParser.deserialize(buffer, node.mediaQueryList = {} as Value);
                    break;

                case CssInjectionRuleSerializationMap.SelectorList:
                    ValueParser.deserialize(buffer, node.selectorList = {} as Value);
                    break;

                case CssInjectionRuleSerializationMap.DeclarationList:
                    ValueParser.deserialize(buffer, node.declarationList = {} as Value);
                    break;

                case CssInjectionRuleSerializationMap.Remove:
                    node.remove = true;
                    break;

                case CssInjectionRuleSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case CssInjectionRuleSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Unknown property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }

    /**
     * Serializes a cosmetic rule node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    // TODO: add support for raws, if ever needed
    public static serialize(node: AnyCosmeticRule, buffer: OutputByteBuffer): void {
        // specific properties
        switch (node.type) {
            case CosmeticRuleType.ElementHidingRule:
                // rule type
                buffer.writeUint8(BinaryTypeMap.ElementHidingRule);
                // syntax
                buffer.writeUint8(SYNTAX_SERIALIZATION_MAP.get(node.syntax) ?? 0);
                // rule body
                CosmeticRuleParser.serializeElementHidingBody(node.body, buffer);
                break;

            case CosmeticRuleType.CssInjectionRule:
                // rule type
                buffer.writeUint8(BinaryTypeMap.CssInjectionRule);
                // syntax
                buffer.writeUint8(SYNTAX_SERIALIZATION_MAP.get(node.syntax) ?? 0);
                // rule body
                CosmeticRuleParser.serializeCssInjectionBody(node.body, buffer);
                break;

            case CosmeticRuleType.JsInjectionRule:
                // rule type
                buffer.writeUint8(BinaryTypeMap.JsInjectionRule);
                // syntax
                buffer.writeUint8(SYNTAX_SERIALIZATION_MAP.get(node.syntax) ?? 0);
                // rule body
                ValueParser.serialize(node.body, buffer);
                break;

            case CosmeticRuleType.HtmlFilteringRule:
                // rule type
                buffer.writeUint8(BinaryTypeMap.HtmlFilteringRule);
                // syntax
                buffer.writeUint8(SYNTAX_SERIALIZATION_MAP.get(node.syntax) ?? 0);
                // rule body
                ValueParser.serialize(node.body, buffer);
                break;

            case CosmeticRuleType.ScriptletInjectionRule:
                // rule type
                buffer.writeUint8(BinaryTypeMap.ScriptletInjectionRule);
                // syntax
                buffer.writeUint8(SYNTAX_SERIALIZATION_MAP.get(node.syntax) ?? 0);
                // rule body
                switch (node.syntax) {
                    case AdblockSyntax.Adg:
                        AdgScriptletInjectionBodyParser.serialize(node.body, buffer);
                        break;

                    case AdblockSyntax.Abp:
                        AbpSnippetInjectionBodyParser.serialize(node.body, buffer);
                        break;

                    case AdblockSyntax.Ubo:
                        UboScriptletInjectionBodyParser.serialize(node.body, buffer);
                        break;

                    default:
                        throw new Error('Scriptlet rule should have an explicit syntax');
                }
                break;

            default:
                throw new Error('Unknown cosmetic rule type');
        }

        // common properties
        buffer.writeUint8(CosmeticRuleSerializationMap.Exception);
        buffer.writeUint8(node.exception ? 1 : 0);

        buffer.writeUint8(CosmeticRuleSerializationMap.Separator);
        ValueParser.serialize(node.separator, buffer, SEPARATOR_SERIALIZATION_MAP);

        if (node.modifiers) {
            buffer.writeUint8(CosmeticRuleSerializationMap.Modifiers);
            ModifierListParser.serialize(node.modifiers, buffer);
        }

        buffer.writeUint8(CosmeticRuleSerializationMap.Domains);
        DomainListParser.serialize(node.domains, buffer);

        if (!isUndefined(node.start)) {
            buffer.writeUint8(CosmeticRuleSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(CosmeticRuleSerializationMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }

    /**
     * Deserializes a cosmetic rule node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<AnyCosmeticRule>): void {
        const type = COSMETIC_RULE_TYPE_DESERIALIZATION_MAP.get(buffer.readUint8());
        if (isUndefined(type)) {
            throw new Error(`Unknown rule type: ${type}`);
        }
        node.type = type;

        node.category = RuleCategory.Cosmetic;

        const syntax = SYNTAX_DESERIALIZATION_MAP.get(buffer.readUint8()) ?? AdblockSyntax.Common;
        node.syntax = syntax;

        node.modifiers = undefined;

        switch (type) {
            case CosmeticRuleType.ElementHidingRule:
                CosmeticRuleParser.deserializeElementHidingBody(buffer, node.body = {} as ElementHidingRuleBody);
                break;

            case CosmeticRuleType.CssInjectionRule:
                CosmeticRuleParser.deserializeCssInjectionBody(buffer, node.body = {} as CssInjectionRuleBody);
                break;

            case CosmeticRuleType.JsInjectionRule:
                ValueParser.deserialize(buffer, node.body = {} as Value);
                break;

            case CosmeticRuleType.HtmlFilteringRule:
                ValueParser.deserialize(buffer, node.body = {} as Value);
                break;

            case CosmeticRuleType.ScriptletInjectionRule:
                switch (syntax) {
                    case AdblockSyntax.Adg:
                        // eslint-disable-next-line max-len
                        AdgScriptletInjectionBodyParser.deserialize(buffer, node.body = {} as ScriptletInjectionRuleBody);
                        break;

                    case AdblockSyntax.Abp:
                        AbpSnippetInjectionBodyParser.deserialize(buffer, node.body = {} as ScriptletInjectionRuleBody);
                        break;

                    case AdblockSyntax.Ubo:
                        // eslint-disable-next-line max-len
                        UboScriptletInjectionBodyParser.deserialize(buffer, node.body = {} as ScriptletInjectionRuleBody);
                        break;

                    default:
                        throw new Error('Scriptlet rule should have an explicit syntax');
                }
                break;

            default:
                throw new Error('Unknown cosmetic rule type');
        }

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case CosmeticRuleSerializationMap.Exception:
                    node.exception = buffer.readUint8() === 1;
                    break;

                case CosmeticRuleSerializationMap.Separator:
                    ValueParser.deserialize(buffer, node.separator = {} as Value, SEPARATOR_DESERIALIZATION_MAP);
                    break;

                case CosmeticRuleSerializationMap.Modifiers:
                    node.modifiers = {} as ModifierList;
                    ModifierListParser.deserialize(buffer, node.modifiers);
                    break;

                case CosmeticRuleSerializationMap.Domains:
                    DomainListParser.deserialize(buffer, node.domains = {} as DomainList);
                    break;

                case CosmeticRuleSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case CosmeticRuleSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Unknown property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
