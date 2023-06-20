import { CosmeticRuleSeparatorUtils } from '../../utils/cosmetic-rule-separator';
import { AdblockSyntax } from '../../utils/adblockers';
import { DomainListParser } from '../misc/domain-list';
import { ModifierListParser } from '../misc/modifier-list';
import {
    ADG_SCRIPTLET_MASK,
    CLOSE_SQUARE_BRACKET,
    DOLLAR_SIGN,
    EMPTY,
    OPEN_SQUARE_BRACKET,
} from '../../utils/constants';
import {
    AnyCosmeticRule,
    CosmeticRuleSeparator,
    CosmeticRuleType,
    CssInjectionRule,
    ElementHidingRule,
    HtmlFilteringRule,
    JsInjectionRule,
    ModifierList,
    RuleCategory,
    ScriptletInjectionRule,
    Value,
    defaultLocation,
} from '../common';
import { AdblockSyntaxError } from '../errors/adblock-syntax-error';
import { StringUtils } from '../../utils/string';
import { locRange, shiftLoc } from '../../utils/location';
import { ElementHidingBodyParser } from './body/elementhiding';
import { CssInjectionBodyParser } from './body/css';
import { ScriptletInjectionBodyParser } from './body/scriptlet';
import { HtmlFilteringBodyParser } from './body/html';
import { CommentRuleParser } from '../comment';

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

                    return <CssInjectionRule>{
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
                }

                return <ElementHidingRule>{
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

                return <HtmlFilteringRule>{
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
     * Converts a cosmetic rule AST into a string.
     *
     * @param ast Cosmetic rule AST
     * @returns Raw string
     */
    public static generate(ast: AnyCosmeticRule): string {
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

        // Separator
        result += ast.separator.value;

        // Body
        switch (ast.type) {
            case CosmeticRuleType.ElementHidingRule:
                result += ElementHidingBodyParser.generate(ast.body);
                break;

            case CosmeticRuleType.CssInjectionRule:
                result += CssInjectionBodyParser.generate(ast.body, ast.syntax);
                break;

            case CosmeticRuleType.HtmlFilteringRule:
                result += HtmlFilteringBodyParser.generate(ast.body, ast.syntax);
                break;

            case CosmeticRuleType.JsInjectionRule:
                // Native JS code
                result += ast.body.value;
                break;

            case CosmeticRuleType.ScriptletInjectionRule:
                result += ScriptletInjectionBodyParser.generate(ast.body, ast.syntax);
                break;

            default:
                throw new Error('Unknown cosmetic rule type');
        }

        return result;
    }
}
