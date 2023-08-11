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
    OPEN_PARENTHESIS,
    OPEN_SQUARE_BRACKET,
    SPACE,
} from '../../utils/constants';
import {
    type AnyCosmeticRule,
    type CosmeticRuleSeparator,
    CosmeticRuleType,
    type CssInjectionRule,
    type ElementHidingRule,
    type HtmlFilteringRule,
    type JsInjectionRule,
    type ModifierList,
    RuleCategory,
    type ScriptletInjectionRule,
    type Value,
    defaultLocation,
} from '../common';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { StringUtils } from '../../utils/string';
import { locRange, shiftLoc } from '../../utils/location';
import { ElementHidingBodyParser } from './body/elementhiding';
import { CssInjectionBodyParser } from './body/css';
import { ScriptletInjectionBodyParser } from './body/scriptlet';
import { HtmlFilteringBodyParser } from './body/html';
import { CommentRuleParser } from '../comment';
import { extractUboModifiersFromSelectorList, hasUboModifierIndicator } from '../../utils/ubo-modifiers';
import { CssTreeNodeType } from '../../utils/csstree-constants';

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
export class CosmeticRuleParser {
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
     * @param raw Raw cosmetic rule
     * @param loc Location of the rule
     * @returns
     * Parsed cosmetic rule AST or null if it failed to parse based on the known cosmetic rules
     * @throws If the input matches the cosmetic rule pattern but syntactically invalid
     */
    public static parse(raw: string, loc = defaultLocation): AnyCosmeticRule | null {
        // Find separator (every cosmetic rule has one)
        const separatorResult = CosmeticRuleSeparatorUtils.find(raw);

        // If there is no separator, it is not a cosmetic rule
        if (!separatorResult) {
            return null;
        }

        // The syntax is initially common
        let syntax = AdblockSyntax.Common;

        const patternStart = StringUtils.skipWS(raw);
        const patternEnd = StringUtils.skipWSBack(raw, separatorResult.start - 1) + 1;

        const bodyStart = separatorResult.end;
        const bodyEnd = StringUtils.skipWSBack(raw) + 1;

        // Parse pattern
        const rawPattern = raw.substring(patternStart, patternEnd);
        let domainListStart = patternStart;
        let rawDomainList = rawPattern;

        let modifiers: ModifierList | undefined;

        // AdGuard modifier list
        if (rawPattern[0] === OPEN_SQUARE_BRACKET) {
            if (rawPattern[1] !== DOLLAR_SIGN) {
                throw new AdblockSyntaxError(
                    `Missing $ at the beginning of the AdGuard modifier list in pattern '${rawPattern}'`,
                    locRange(loc, patternStart, patternEnd),
                );
            }

            // Find the end of the modifier list
            const modifierListEnd = StringUtils.findNextUnescapedCharacter(rawPattern, CLOSE_SQUARE_BRACKET);

            if (modifierListEnd === -1) {
                throw new AdblockSyntaxError(
                    `Missing ] at the end of the AdGuard modifier list in pattern '${rawPattern}'`,
                    locRange(loc, patternStart, patternEnd),
                );
            }

            // Parse modifier list
            modifiers = ModifierListParser.parse(
                rawPattern.substring(patternStart + 2, modifierListEnd),
                shiftLoc(loc, patternStart + 2),
            );

            // Domain list is everything after the modifier list
            rawDomainList = rawPattern.substring(modifierListEnd + 1);
            domainListStart = modifierListEnd + 1;

            // Change syntax, since only AdGuard supports this type of modifier list
            syntax = AdblockSyntax.Adg;
        }

        // Parse domain list
        const domains = DomainListParser.parse(rawDomainList, ',', shiftLoc(loc, domainListStart));

        // Parse body
        const rawBody = raw.substring(bodyStart, bodyEnd);

        let body;

        // Separator node
        const separator: Value<CosmeticRuleSeparator> = {
            type: 'Value',
            loc: locRange(loc, separatorResult.start, separatorResult.end),
            value: separatorResult.separator,
        };

        const exception = CosmeticRuleSeparatorUtils.isException(separatorResult.separator);

        switch (separatorResult.separator) {
            // Element hiding rules
            case '##':
            case '#@#':
            case '#?#':
            case '#@?#':
                // Check if the body is a uBO CSS injection. Since element hiding rules
                // are very common, we should check this with a fast check first.
                if (CssInjectionBodyParser.isUboCssInjection(rawBody)) {
                    if (syntax === AdblockSyntax.Adg) {
                        throw new AdblockSyntaxError(
                            'AdGuard modifier list is not supported in uBO CSS injection rules',
                            locRange(loc, patternStart, patternEnd),
                        );
                    }

                    const uboCssInjectionRuleNode: CssInjectionRule = {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.CssInjectionRule,
                        loc: locRange(loc, 0, raw.length),
                        raws: {
                            text: raw,
                        },
                        syntax: AdblockSyntax.Ubo,
                        exception,
                        modifiers,
                        domains,
                        separator,
                        body: {
                            ...CssInjectionBodyParser.parse(rawBody, shiftLoc(loc, bodyStart)),
                            raw: rawBody,
                        },
                    };

                    if (hasUboModifierIndicator(rawBody)) {
                        const extractedUboModifiers = extractUboModifiersFromSelectorList(
                            uboCssInjectionRuleNode.body.selectorList,
                        );
                        if (extractedUboModifiers.modifiers.children.length > 0) {
                            if (!uboCssInjectionRuleNode.modifiers) {
                                uboCssInjectionRuleNode.modifiers = {
                                    type: 'ModifierList',
                                    children: [],
                                };
                            }

                            uboCssInjectionRuleNode.modifiers.children.push(
                                ...extractedUboModifiers.modifiers.children,
                            );
                            uboCssInjectionRuleNode.body.selectorList = extractedUboModifiers.cleaned;
                            uboCssInjectionRuleNode.syntax = AdblockSyntax.Ubo;
                        }
                    }

                    return uboCssInjectionRuleNode;
                }

                // eslint-disable-next-line no-case-declarations
                const elementHidingRuleNode: ElementHidingRule = {
                    category: RuleCategory.Cosmetic,
                    type: CosmeticRuleType.ElementHidingRule,
                    loc: locRange(loc, 0, raw.length),
                    raws: {
                        text: raw,
                    },
                    syntax,
                    exception,
                    modifiers,
                    domains,
                    separator,
                    body: {
                        ...ElementHidingBodyParser.parse(rawBody, shiftLoc(loc, bodyStart)),
                        raw: rawBody,
                    },
                };

                if (hasUboModifierIndicator(rawBody)) {
                    const extractedUboModifiers = extractUboModifiersFromSelectorList(
                        elementHidingRuleNode.body.selectorList,
                    );
                    if (extractedUboModifiers.modifiers.children.length > 0) {
                        if (!elementHidingRuleNode.modifiers) {
                            elementHidingRuleNode.modifiers = {
                                type: 'ModifierList',
                                children: [],
                            };
                        }

                        elementHidingRuleNode.modifiers.children.push(...extractedUboModifiers.modifiers.children);
                        elementHidingRuleNode.body.selectorList = extractedUboModifiers.cleaned;
                        elementHidingRuleNode.syntax = AdblockSyntax.Ubo;
                    }
                }

                return elementHidingRuleNode;

            // ADG CSS injection / ABP snippet injection
            case '#$#':
            case '#@$#':
            case '#$?#':
            case '#@$?#':
                // ADG CSS injection
                if (CssInjectionBodyParser.isAdgCssInjection(rawBody)) {
                    return <CssInjectionRule>{
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.CssInjectionRule,
                        loc: locRange(loc, 0, raw.length),
                        raws: {
                            text: raw,
                        },
                        syntax: AdblockSyntax.Adg,
                        exception,
                        modifiers,
                        domains,
                        separator,
                        body: {
                            ...CssInjectionBodyParser.parse(rawBody, shiftLoc(loc, bodyStart)),
                            raw: rawBody,
                        },
                    };
                }

                // ABP snippet injection
                if (['#$#', '#@$#'].includes(separator.value)) {
                    if (syntax === AdblockSyntax.Adg) {
                        throw new AdblockSyntaxError(
                            'AdGuard modifier list is not supported in ABP snippet injection rules',
                            locRange(loc, patternStart, patternEnd),
                        );
                    }

                    return <ScriptletInjectionRule>{
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.ScriptletInjectionRule,
                        loc: locRange(loc, 0, raw.length),
                        raws: {
                            text: raw,
                        },
                        syntax: AdblockSyntax.Abp,
                        exception,
                        modifiers,
                        domains,
                        separator,
                        body: {
                            ...ScriptletInjectionBodyParser.parse(rawBody, AdblockSyntax.Abp, shiftLoc(loc, bodyStart)),
                            raw: rawBody,
                        },
                    };
                }

                // ABP snippet injection is not supported for #$?# and #@$?#
                throw new AdblockSyntaxError(
                    `Separator '${separator.value}' is not supported for scriptlet injection`,
                    locRange(loc, separator.loc?.start.offset ?? 0, separator.loc?.end.offset ?? raw.length),
                );

            // uBO scriptlet injection
            case '##+':
            case '#@#+':
                if (syntax === AdblockSyntax.Adg) {
                    throw new AdblockSyntaxError(
                        'AdGuard modifier list is not supported in uBO scriptlet injection rules',
                        locRange(loc, patternStart, patternEnd),
                    );
                }

                // uBO scriptlet injection
                return <ScriptletInjectionRule>{
                    category: RuleCategory.Cosmetic,
                    type: CosmeticRuleType.ScriptletInjectionRule,
                    loc: locRange(loc, 0, raw.length),
                    raws: {
                        text: raw,
                    },
                    syntax: AdblockSyntax.Ubo,
                    exception,
                    modifiers,
                    domains,
                    separator,
                    body: {
                        ...ScriptletInjectionBodyParser.parse(rawBody, AdblockSyntax.Ubo, shiftLoc(loc, bodyStart)),
                        raw: rawBody,
                    },
                };

            // ADG JS / scriptlet injection
            case '#%#':
            case '#@%#':
                // ADG scriptlet injection
                if (rawBody.trim().startsWith(ADG_SCRIPTLET_MASK)) {
                    // ADG scriptlet injection
                    return <ScriptletInjectionRule>{
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.ScriptletInjectionRule,
                        loc: locRange(loc, 0, raw.length),
                        raws: {
                            text: raw,
                        },
                        syntax: AdblockSyntax.Adg,
                        exception,
                        modifiers,
                        domains,
                        separator,
                        body: {
                            ...ScriptletInjectionBodyParser.parse(rawBody, AdblockSyntax.Ubo, shiftLoc(loc, bodyStart)),
                            raw: rawBody,
                        },
                    };
                }

                // Don't allow empty body
                if (bodyEnd <= bodyStart) {
                    throw new AdblockSyntaxError(
                        'Empty body in JS injection rule',
                        locRange(loc, 0, raw.length),
                    );
                }

                // ADG JS injection
                return <JsInjectionRule>{
                    category: RuleCategory.Cosmetic,
                    type: CosmeticRuleType.JsInjectionRule,
                    loc: locRange(loc, 0, raw.length),
                    raws: {
                        text: raw,
                    },
                    syntax: AdblockSyntax.Adg,
                    exception,
                    modifiers,
                    domains,
                    separator,
                    body: {
                        type: 'Value',
                        loc: locRange(loc, bodyStart, bodyEnd),
                        value: rawBody,
                        raw: rawBody,
                    },
                };

            // uBO HTML filtering
            case '##^':
            case '#@#^':
                if (syntax === AdblockSyntax.Adg) {
                    throw new AdblockSyntaxError(
                        'AdGuard modifier list is not supported in uBO HTML filtering rules',
                        locRange(loc, patternStart, patternEnd),
                    );
                }

                // eslint-disable-next-line no-case-declarations
                const uboHtmlRuleNode: HtmlFilteringRule = {
                    category: RuleCategory.Cosmetic,
                    type: CosmeticRuleType.HtmlFilteringRule,
                    loc: locRange(loc, 0, raw.length),
                    raws: {
                        text: raw,
                    },
                    syntax: AdblockSyntax.Ubo,
                    exception,
                    modifiers,
                    domains,
                    separator,
                    body: {
                        ...HtmlFilteringBodyParser.parse(rawBody, shiftLoc(loc, bodyStart)),
                        raw: rawBody,
                    },
                };

                if (
                    hasUboModifierIndicator(rawBody)
                    && uboHtmlRuleNode.body.body.type === CssTreeNodeType.SelectorList
                ) {
                    // eslint-disable-next-line max-len
                    const extractedUboModifiers = extractUboModifiersFromSelectorList(uboHtmlRuleNode.body.body);
                    if (extractedUboModifiers.modifiers.children.length > 0) {
                        if (!uboHtmlRuleNode.modifiers) {
                            uboHtmlRuleNode.modifiers = {
                                type: 'ModifierList',
                                children: [],
                            };
                        }

                        uboHtmlRuleNode.modifiers.children.push(...extractedUboModifiers.modifiers.children);
                        uboHtmlRuleNode.body.body = extractedUboModifiers.cleaned;
                        uboHtmlRuleNode.syntax = AdblockSyntax.Ubo;
                    }
                }

                return uboHtmlRuleNode;

            // ADG HTML filtering
            case '$$':
            case '$@$':
                body = HtmlFilteringBodyParser.parse(rawBody, shiftLoc(loc, bodyStart));
                body.raw = rawBody;

                if (body.body.type === 'Function') {
                    throw new AdblockSyntaxError(
                        'Functions are not supported in ADG HTML filtering rules',
                        locRange(loc, bodyStart, bodyEnd),
                    );
                }

                return <HtmlFilteringRule>{
                    category: RuleCategory.Cosmetic,
                    type: CosmeticRuleType.HtmlFilteringRule,
                    loc: locRange(loc, 0, raw.length),
                    raws: {
                        text: raw,
                    },
                    syntax: AdblockSyntax.Adg,
                    exception,
                    modifiers,
                    domains,
                    separator,
                    body,
                };

            default:
                return null;
        }
    }

    /**
     * Generates the rule pattern from the AST.
     *
     * @param ast Cosmetic rule AST
     * @returns Raw rule pattern
     * @example
     * - '##.foo' → ''
     * - 'example.com,example.org##.foo' → 'example.com,example.org'
     * - '[$path=/foo/bar]example.com##.foo' → '[$path=/foo/bar]example.com'
     */
    public static generatePattern(ast: AnyCosmeticRule): string {
        let result = EMPTY;

        // AdGuard modifiers (if any)
        if (ast.syntax === AdblockSyntax.Adg && ast.modifiers && ast.modifiers.children.length > 0) {
            result += OPEN_SQUARE_BRACKET;
            result += DOLLAR_SIGN;
            result += ModifierListParser.generate(ast.modifiers);
            result += CLOSE_SQUARE_BRACKET;
        }

        // Domain list (if any)
        result += DomainListParser.generate(ast.domains);

        return result;
    }

    /**
     * Generates the rule body from the AST.
     *
     * @param ast Cosmetic rule AST
     * @returns Raw rule body
     * @example
     * - '##.foo' → '.foo'
     * - 'example.com,example.org##.foo' → '.foo'
     * - 'example.com#%#//scriptlet('foo')' → '//scriptlet('foo')'
     */
    public static generateBody(ast: AnyCosmeticRule): string {
        let result = EMPTY;

        // Body
        switch (ast.type) {
            case CosmeticRuleType.ElementHidingRule:
                result = ElementHidingBodyParser.generate(ast.body);
                break;

            case CosmeticRuleType.CssInjectionRule:
                result = CssInjectionBodyParser.generate(ast.body, ast.syntax);
                break;

            case CosmeticRuleType.HtmlFilteringRule:
                result = HtmlFilteringBodyParser.generate(ast.body, ast.syntax);
                break;

            case CosmeticRuleType.JsInjectionRule:
                // Native JS code
                result = ast.body.value;
                break;

            case CosmeticRuleType.ScriptletInjectionRule:
                result = ScriptletInjectionBodyParser.generate(ast.body, ast.syntax);
                break;

            default:
                throw new Error('Unknown cosmetic rule type');
        }

        return result;
    }

    /**
     * Converts a cosmetic rule AST into a string.
     *
     * @param ast Cosmetic rule AST
     * @returns Raw string
     */
    public static generate(ast: AnyCosmeticRule): string {
        let result = EMPTY;

        // Pattern
        result += CosmeticRuleParser.generatePattern(ast);

        // Separator
        result += ast.separator.value;

        // uBO rule modifiers
        if (ast.syntax === AdblockSyntax.Ubo && ast.modifiers) {
            ast.modifiers.children.forEach((modifier) => {
                result += COLON;
                result += modifier.modifier.value;
                if (modifier.value) {
                    result += OPEN_PARENTHESIS;
                    result += modifier.value.value;
                    result += CLOSE_PARENTHESIS;
                }
            });

            // If there are at least one modifier, add a space
            if (ast.modifiers.children.length) {
                result += SPACE;
            }
        }

        // Body
        result += CosmeticRuleParser.generateBody(ast);

        return result;
    }
}
