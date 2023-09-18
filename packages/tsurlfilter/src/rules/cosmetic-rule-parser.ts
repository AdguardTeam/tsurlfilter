import { parseOptionsString } from '../utils/parse-options-string';
import { COMMA_SEPARATOR, DomainModifier, PIPE_SEPARATOR } from '../modifiers/domain-modifier';
import { findCosmeticRuleMarker } from './cosmetic-rule-marker';
import { CosmeticRuleModifiers, CosmeticRuleModifiersSyntax } from './cosmetic-rule-modifiers';
import { SimpleRegex } from './simple-regex';

const cosmeticRuleModifiersList = Object.values(CosmeticRuleModifiers) as string[];

export type CosmeticRuleModifiersCollection = {
    [P in CosmeticRuleModifiers]?: string;
};

type UrlPatternResult = { url: string };
type PathDomainPatternResult = { path?: string, domainModifier?: DomainModifier };

export const isUrlPatternResult = (
    result: UrlPatternResult | PathDomainPatternResult,
): result is UrlPatternResult => 'url' in result;

/**
 * Helper class for parsing text of cosmetic rules
 * used by CosmeticRule and [Filter compiler](https://github.com/AdguardTeam/FiltersCompiler)
 *
 *
 * The cosmetic rule contains of the following parts:
 *
 * `pattern##content`
 *
 * `pattern` contains the list of the rule modifiers and domains.
 *
 * `##` is a marker (might be a different marker depending on the rule type).
 * You can find the list of markers in the CosmeticRuleMarker enumeration.
 *
 * `content` might be a CSS selector, a scriptlet or something else, depending on the rule type.
 */
export class CosmeticRuleParser {
    /**
     * Parse the rule's pattern, cosmetic marker and the content parts from the rule text.
     * If the content is empty, throws a SyntaxError.
     *
     * @param ruleText
     * @returns Object with pattern, marker and content text parts
     */
    static parseRuleTextByMarker(ruleText: string): {
        pattern?: string;
        marker: string;
        content: string;
    } {
        const [markerIndex, marker] = findCosmeticRuleMarker(ruleText);

        if (marker === null) {
            throw new SyntaxError('Not a cosmetic rule');
        }

        const content = ruleText.substring(markerIndex + marker.length).trim();

        if (!content) {
            throw new SyntaxError('Rule content is empty');
        }

        let pattern;

        if (markerIndex > 0) {
            pattern = ruleText.substring(0, markerIndex);
        }

        return {
            pattern,
            marker,
            content,
        };
    }

    /**
     * Extracts the rule modifiers and domains from the rule pattern.
     * @param rulePattern
     * @returns Object with modifiers and domains text parts
     */
    static parseRulePatternText(rulePattern: string): {
        domainsText?: string;
        modifiersText?: string;
    } {
        const {
            OpenBracket,
            CloseBracket,
            SpecialSymbol,
            EscapeCharacter,
        } = CosmeticRuleModifiersSyntax;

        if (!rulePattern.startsWith(`${OpenBracket + SpecialSymbol}`)) {
            return { domainsText: rulePattern };
        }

        let closeBracketIndex;

        // The first two characters cannot be closing brackets
        for (let i = 2; i < rulePattern.length; i += 1) {
            if (rulePattern[i] === CloseBracket && rulePattern[i - 1] !== EscapeCharacter) {
                closeBracketIndex = i;
                break;
            }
        }

        if (!closeBracketIndex) {
            throw new SyntaxError('Can\'t parse modifiers list');
        }

        // Handle this case: `[$]`
        if (closeBracketIndex === 2) {
            throw new SyntaxError('Modifiers list can\'t be empty');
        }

        const modifiersText = rulePattern.slice(2, closeBracketIndex);

        let domainsText;

        if (closeBracketIndex < rulePattern.length - 1) {
            domainsText = rulePattern.slice(closeBracketIndex + 1);
        }

        return {
            modifiersText,
            domainsText,
        };
    }

    /**
     * Parses the list of modifiers. Parsing is done in the same way as it's done in the NetworkRule, i.e.
     * we have a comma-separated list of modifier-value pairs.
     * If we encounter an invalid modifier, this method throws a SyntaxError.
     *
     * @param modifiersText - list of modifiers splited by comma
     * @returns - modifiers collection object
     */
    static parseRuleModifiers(modifiersText: string | undefined): CosmeticRuleModifiersCollection | null {
        if (!modifiersText) {
            return null;
        }

        const { Assigner } = CosmeticRuleModifiersSyntax;

        const modifiersTextArray = parseOptionsString(modifiersText, false);

        const modifiers = Object.create(null);

        for (let i = 0; i < modifiersTextArray.length; i += 1) {
            const modifierText = modifiersTextArray[i];
            const assignerIndex = modifierText.indexOf(Assigner);

            if (modifierText === CosmeticRuleModifiers.Path) {
                // Empty path modifier without assigner and value will match only main page
                modifiers[modifierText] = '';
                continue;
            }

            if (assignerIndex === -1) {
                throw new SyntaxError('Modifier must have assigned value');
            }

            const modifierKey = modifierText.substring(0, assignerIndex);

            if (modifierKey === CosmeticRuleModifiers.Url && modifiersTextArray.length > 1) {
                throw new SyntaxError('The $url modifier can\'t be used with other modifiers');
            }

            if (cosmeticRuleModifiersList.includes(modifierKey)) {
                const modifierValue = modifierText.substring(assignerIndex + 1);

                modifiers[modifierKey] = modifierValue;
            } else {
                throw new SyntaxError(`'${modifierKey}' is not valid modifier`);
            }
        }

        return modifiers;
    }

    /**
     * Parses the rule pattern and extracts the permitted/restricted domains and the unescaped path modifier value,
     * If domains are declared through $domain modifier and pattern domain list, this method throws a SyntaxError.
     * @param rulePattern - rule pattern text
     *
     * @returns Object with permitted/restricted domains list and/or the path modifier string value,
     * or url modifier string value
     */
    static parseRulePattern(rulePattern: string): UrlPatternResult | PathDomainPatternResult {
        const {
            domainsText,
            modifiersText,
        } = CosmeticRuleParser.parseRulePatternText(rulePattern);

        let domains = domainsText;
        let path;

        const modifiers = CosmeticRuleParser.parseRuleModifiers(modifiersText);

        if (modifiers) {
            if (modifiers.url) {
                if (domains) {
                    throw new SyntaxError('The $url modifier is not allowed in a domain-specific rule');
                } else {
                    const { url } = modifiers;
                    return { url };
                }
            }

            if (modifiers.path || modifiers.path === '') {
                path = modifiers.path;

                if (SimpleRegex.isRegexPattern(path)) {
                    path = SimpleRegex.unescapeRegexSpecials(
                        path,
                        SimpleRegex.reModifierPatternEscapedSpecialCharacters,
                    );
                }
            }

            if (modifiers.domain) {
                if (domains) {
                    throw new SyntaxError('The $domain modifier is not allowed in a domain-specific rule');
                } else {
                    domains = modifiers.domain;
                }
            }
        }

        let domainModifier;

        // Skip wildcard domain
        if (domains && domains !== SimpleRegex.MASK_ANY_CHARACTER) {
            const separator = modifiers?.domain ? PIPE_SEPARATOR : COMMA_SEPARATOR;
            domainModifier = new DomainModifier(domains, separator);
        }

        return {
            path,
            domainModifier,
        };
    }
}
