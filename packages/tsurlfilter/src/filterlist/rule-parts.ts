import isIp from 'is-ip';
import {
    findNextNonWhitespace,
    findNextWhitespace,
    findPrevNonWhitespace,
    hasWhitespace,
} from '../utils/string-utils';
import {
    CLOSE_SQUARE,
    COMMA,
    ESCAPE,
    OPEN_SQUARE,
    SPACE,
    TAB,
} from '../common/constants';

/**
 * Rule category.
 */
export const enum RuleCategory {
    /**
     * Host rule.
     *
     * @example
     * ```adblock
     * 127.0.0.1 example.com
     * ```
     */
    Host,

    /**
     * Network rule.
     *
     * @example
     * ```adblock
     * ||example.com
     * ```
     */
    Network,

    /**
     * Cosmetic rule.
     *
     * @example
     * ```adblock
     * example.com##.ads
     * ```
     */
    Cosmetic,
}

/**
 * Cosmetic rule type.
 */
export const enum CosmeticRuleType {
    /**
     * Element hiding rule.
     *
     * @example
     * ```adblock
     * example.com##.ads
     * ```
     */
    ElementHidingRule,

    /**
     * CSS injection rule.
     *
     * @example
     * ```adblock
     * example.com#$#.selector { ... }
     * ```
     */
    CssInjectionRule,

    /**
     * JS injection rule.
     *
     * @example
     * ```adblock
     * example.com#%#js-code
     * ```
     */
    JsInjectionRule,

    /**
     * HTML filtering rule.
     *
     * @example
     * ```adblock
     * example.com$$selector
     * ```
     */
    HtmlFilteringRule,
}

/**
 * Host rule parts.
 */
export type HostRuleParts = {
    /**
     * Rule category.
     */
    category: RuleCategory.Host;

    /**
     * Start position of the domains.
     */
    domainsStart: number;

    /**
     * End position of the domains.
     */
    domainsEnd: number;

    /**
     * Start position of the IP.
     */
    ipStart?: number;

    /**
     * End position of the IP.
     */
    ipEnd?: number;

    /**
     * Text of the rule.
     */
    text: string;
};

/**
 * Network rule parts.
 */
export type NetworkRuleParts = {
    /**
     * Rule category.
     */
    category: RuleCategory.Network;

    /**
     * Whether the rule is an allowlist.
     */
    allowlist: boolean;

    /**
     * Start position of the pattern.
     */
    patternStart: number;

    /**
     * End position of the pattern.
     */
    patternEnd: number;

    /**
     * Start position of the modifiers.
     */
    modifiersStart?: number;

    /**
     * End position of the modifiers.
     */
    modifiersEnd?: number;

    /**
     * Start position of the domains.
     */
    domainsStart?: number;

    /**
     * End position of the domains.
     */
    domainsEnd?: number;

    /**
     * Text of the rule.
     */
    text: string;
};

/**
 * Cosmetic rule parts.
 */
export type CosmeticRuleParts = {
    /**
     * Rule category.
     */
    category: RuleCategory.Cosmetic;

    /**
     * Type of the cosmetic rule.
     */
    type: CosmeticRuleType;

    /**
     * Whether the rule is an allowlist.
     */
    allowlist: boolean;

    /**
     * Start position of the pattern.
     */
    patternStart?: number;

    /**
     * End position of the pattern.
     */
    patternEnd?: number;

    /**
     * Start position of the content.
     */
    contentStart: number;

    /**
     * End position of the content.
     */
    contentEnd: number;

    /**
     * Start position of the separator.
     */
    separatorStart: number;

    /**
     * End position of the separator.
     */
    separatorEnd: number;

    /**
     * Start position of the domains.
     */
    domainsStart?: number;

    /**
     * End position of the domains.
     */
    domainsEnd?: number;

    /**
     * Text of the rule.
     */
    text: string;
};

/**
 * Rule parts.
 */
export type RuleParts = HostRuleParts | NetworkRuleParts | CosmeticRuleParts;

const MIN_RULE_LENGTH = 4;

const ADBLOCK_COMMENT_MARKER = '!';
const HOST_COMMENT_MARKER = '#';

const NETWORK_RULE_ALLOWLIST_MARKER = '@@';
const NETWORK_RULE_ALLOWLIST_MARKER_LENGTH = NETWORK_RULE_ALLOWLIST_MARKER.length;

const MODIFIER_ASSIGN = '=';
const DOMAIN_MODIFIER = 'domain';
const DOMAIN_MODIFIER_LENGTH = DOMAIN_MODIFIER.length;

const COSMETIC_SEPARATOR_OFFSET_MASK = (1 << 26) - 1; // 0x03FFFFFF (26 lowest bits)
const COSMETIC_SEPARATOR_LEN_SHIFT = 26; // 3 bits
const COSMETIC_SEPARATOR_TYPE_SHIFT = 29; // 2 bits
const COSMETIC_SEPARATOR_ALLOW_SHIFT = 31; // 1 bit

const DOMAIN_START_SHIFT = 16;
const DOMAIN_END_MASK = 0xFFFF;

/**
 * Encodes the offset, length, type, and allow flag into a single number.
 *
 * @param offset The offset of the separator.
 * @param length The length of the separator.
 * @param type The type of the separator.
 * @param allow Whether the separator is an allowlist.
 *
 * @returns The encoded separator value.
 */
const encodeSeparator = (
    offset: number,
    length: number,
    type: CosmeticRuleType,
    allow: boolean,
): number => {
    return (offset & COSMETIC_SEPARATOR_OFFSET_MASK)
           | ((length & 0x7) << COSMETIC_SEPARATOR_LEN_SHIFT)
           | ((type & 0x3) << COSMETIC_SEPARATOR_TYPE_SHIFT)
           | ((allow ? 1 : 0) << COSMETIC_SEPARATOR_ALLOW_SHIFT);
};

/**
 * Extracts the offset position from an encoded cosmetic separator value.
 *
 * @param v The encoded separator value.
 *
 * @returns The offset position.
 */
const decodeSeparatorOffset = (v: number) => v & COSMETIC_SEPARATOR_OFFSET_MASK;

/**
 * Extracts the length of the separator from an encoded cosmetic separator value.
 *
 * @param v The encoded separator value.
 *
 * @returns The length of the separator.
 */
const decodeSeparatorLength = (v: number) => (v >>> COSMETIC_SEPARATOR_LEN_SHIFT) & 0x7;

/**
 * Extracts the type of the separator from an encoded cosmetic separator value.
 *
 * @param v The encoded separator value.
 *
 * @returns The type of the separator.
 */
const decodeSeparatorType = (v: number) => (v >>> COSMETIC_SEPARATOR_TYPE_SHIFT) & 0x3;

/**
 * Extracts whether the separator is an allowlist from an encoded cosmetic separator value.
 *
 * @param v The encoded separator value.
 *
 * @returns Whether the separator is an allowlist.
 */
const decodeSeparatorIsAllowlist = (v: number) => ((v >>> COSMETIC_SEPARATOR_ALLOW_SHIFT) & 0x1) === 1;

/**
 * Scans a rule for a hashmark-based cosmetic separator and returns an encoded representation if found.
 *
 * @param rule The rule to scan.
 *
 * @returns An encoded representation of the separator if found, or `null` otherwise.
 */
const findHashmarkBasedCosmeticSeparator = (rule: string): number | null => {
    let i = -1;

    // eslint-disable-next-line no-cond-assign
    while ((i = rule.indexOf('#', i + 1)) !== -1) {
        if (rule[i + 1] === '#' && rule[i - 1] !== SPACE) {
            // ##
            return encodeSeparator(i, 2, CosmeticRuleType.ElementHidingRule, false);
        }

        if (rule[i + 1] === '?' && rule[i + 2] === '#') {
            // #?#
            return encodeSeparator(i, 3, CosmeticRuleType.CssInjectionRule, false);
        }

        if (rule[i + 1] === '%' && rule[i + 2] === '#') {
            // #%#
            return encodeSeparator(i, 3, CosmeticRuleType.JsInjectionRule, false);
        }

        if (rule[i + 1] === '$') {
            if (rule[i + 2] === '#') {
                // #$#
                return encodeSeparator(i, 3, CosmeticRuleType.CssInjectionRule, false);
            }
            if (rule[i + 2] === '?' && rule[i + 3] === '#') {
                // #$?#
                return encodeSeparator(i, 4, CosmeticRuleType.CssInjectionRule, false);
            }
        }

        if (rule[i + 1] === '@') {
            if (rule[i + 2] === '#' && rule[i - 1] !== SPACE) {
                // #@#
                return encodeSeparator(i, 3, CosmeticRuleType.ElementHidingRule, true);
            }

            if (rule[i + 2] === '?' && rule[i + 3] === '#') {
                // #@?#
                return encodeSeparator(i, 4, CosmeticRuleType.ElementHidingRule, true);
            }

            if (rule[i + 2] === '%' && rule[i + 3] === '#') {
                // #@%#
                return encodeSeparator(i, 4, CosmeticRuleType.JsInjectionRule, true);
            }

            if (rule[i + 2] === '$') {
                if (rule[i + 3] === '#') {
                    // #@$#
                    return encodeSeparator(i, 4, CosmeticRuleType.CssInjectionRule, true);
                }

                if (rule[i + 3] === '?' && rule[i + 4] === '#') {
                    // #@$?#
                    return encodeSeparator(i, 5, CosmeticRuleType.CssInjectionRule, true);
                }
            }
        }
    }

    return null;
};

/**
 * Encodes the start and end positions of domains.
 *
 * @param start The start position of the domains.
 * @param end The end position of the domains.
 *
 * @returns The encoded domains value.
 */
const encodeDomains = (start: number, end: number): number => {
    return (start << DOMAIN_START_SHIFT) | end;
};

/**
 * Decodes the start position of domains from an encoded domains value.
 *
 * @param value The encoded domains value.
 *
 * @returns The start position of the domains.
 */
const decodeDomainsStart = (value: number): number => {
    return value >> DOMAIN_START_SHIFT;
};

/**
 * Decodes the end position of domains from an encoded domains value.
 *
 * @param value The encoded domains value.
 *
 * @returns The end position of the domains.
 */
const decodeDomainsEnd = (value: number): number => {
    return value & DOMAIN_END_MASK;
};

/**
 * Extracts the start and end positions of domains from a modifier list.
 *
 * @param rule The rule containing the modifier list.
 * @param modifierListStart The start position of the modifier list.
 * @param modifiersEnd The end position of the modifiers.
 *
 * @returns The encoded domains value or `null` if no domains are found.
 */
const extractDomainsFromModifierList = (
    rule: string,
    modifierListStart: number,
    modifiersEnd: number,
): number | null => {
    const start = rule.indexOf(DOMAIN_MODIFIER, modifierListStart);

    if (start === -1) {
        return null;
    }

    let i = findNextNonWhitespace(rule, start + DOMAIN_MODIFIER_LENGTH, modifiersEnd);

    if (rule[i] !== MODIFIER_ASSIGN) {
        return null;
    }

    i += 1;

    const valueStart = i;

    i = findNextNonWhitespace(rule, i, modifiersEnd);

    // find next unescaped comma or the end of the string
    while (i < modifiersEnd) {
        if (rule[i] === ESCAPE) {
            i += 2;
            continue;
        }
        if (rule[i] === COMMA) {
            break;
        }
        i += 1;
    }

    return encodeDomains(valueStart, i);
};

/**
 * Builds cosmetic rule parts.
 *
 * @param rule The adblock rule to tokenize.
 * @param realStart The start of the rule.
 * @param realEnd The end of the rule.
 * @param separatorEncoded The encoded separator.
 *
 * @returns The rule parts or null if the rule is not a cosmetic rule.
 */
function buildCosmeticRuleParts(
    rule: string,
    realStart: number,
    realEnd: number,
    separatorEncoded: number,
): CosmeticRuleParts | null {
    const offset = decodeSeparatorOffset(separatorEncoded);
    const length = decodeSeparatorLength(separatorEncoded);

    let domainsStart: number | undefined;
    let domainsEnd: number | undefined;

    // handle cosmetic modifiers
    if (rule[realStart] === OPEN_SQUARE) {
        // skip whitespace
        let i = realStart + 1;
        while (i < realEnd && (rule[i] === SPACE || rule[i] === TAB)) {
            i += 1;
        }

        if (rule[i] === '$') {
            // find last unescaped ] from separator
            let j = offset - 1;

            while (j >= realStart) {
                if (rule[j] === CLOSE_SQUARE && rule[j - 1] !== ESCAPE) {
                    break;
                }
                j -= 1;
            }

            if (j < realStart) {
                return null;
            }

            const domain = extractDomainsFromModifierList(rule, i + 1, j);

            if (domain !== null) {
                domainsStart = decodeDomainsStart(domain);
                domainsEnd = decodeDomainsEnd(domain);
            }
        } else {
            // invalid rule
            return null;
        }
    } else if (realStart < offset) {
        domainsStart = realStart;
        domainsEnd = offset;
    }

    return {
        category: RuleCategory.Cosmetic,
        type: decodeSeparatorType(separatorEncoded),
        allowlist: decodeSeparatorIsAllowlist(separatorEncoded),
        patternStart: realStart,
        patternEnd: offset,
        contentStart: findNextNonWhitespace(rule, offset + length, rule.length),
        contentEnd: realEnd,
        separatorStart: offset,
        separatorEnd: offset + length,
        domainsStart,
        domainsEnd,
        text: rule,
    };
}

/**
 * Parses a host rule and returns its parts.
 *
 * @param rule The rule to parse.
 * @param realStart The start of the rule.
 * @param realEnd The end of the rule.
 *
 * @returns The rule parts or null if the rule is not a host rule.
 */
function getHostRuleParts(rule: string, realStart: number, realEnd: number): HostRuleParts | null {
    // rule end without comments, e.g. rule can be `example.com #comment` or `127.0.0.1 example.com #comment`
    // but we can drop the comments in such rules
    let endWithoutComment: number;

    const hashMarkIndex = rule.indexOf(HOST_COMMENT_MARKER, realStart);
    if (hashMarkIndex !== -1) {
        endWithoutComment = findPrevNonWhitespace(rule, hashMarkIndex - 1);
    } else {
        endWithoutComment = realEnd;
    }

    const ipStart = realStart;
    let ipEnd: number | undefined;

    // if IP present, it should be the first part
    const nextSpaceIndex = findNextWhitespace(rule, realStart);
    if (nextSpaceIndex === -1) {
        ipEnd = endWithoutComment;
    } else {
        ipEnd = nextSpaceIndex;
    }

    const firstPart = rule.slice(ipStart, ipEnd);
    if (!isIp(firstPart)) {
        // domains only syntax
        return {
            category: RuleCategory.Host,
            domainsStart: realStart,
            domainsEnd: endWithoutComment,
            text: rule,
        };
    }

    const domainsStart = findNextNonWhitespace(rule, nextSpaceIndex + 1, endWithoutComment);

    if (ipStart !== undefined && domainsStart >= endWithoutComment) {
        // invalid rule, because ip needs to be followed by domain(s)
        return null;
    }

    return {
        category: RuleCategory.Host,
        domainsStart,
        domainsEnd: endWithoutComment,
        ipStart,
        ipEnd,
        text: rule,
    };
}

/**
 * Tokenizes an adblock rule string into structured components: host, network, or cosmetic rule parts.
 *
 * Depending on rule content and options, it extracts relevant ranges for pattern, modifiers,
 * content, domains, separators, etc.
 *
 * ## Rule Categories:
 * - `Host`: domain-only or IP-based hosts file entries (e.g. `127.0.0.1 example.com`)
 * - `Network`: standard filter list entries with optional modifiers (e.g. `||example.com^$script`)
 * - `Cosmetic`: element hiding or injection rules (e.g. `example.com##.ad`, `[$domain=foo]##.ad`).
 *
 * @param rule The raw adblock rule string to tokenize.
 * @param ignoreCosmetics If true, skip processing cosmetic rules.
 * @param ignoreHosts If true, skip processing host file style rules.
 *
 * @returns Returns a structured rule object with offset ranges,
 * or `null` if the rule is invalid, a comment, or filtered out.
 */
export function getRuleParts(
    rule: string,
    ignoreCosmetics = false,
    ignoreHosts = true,
): RuleParts | null {
    const { length: ruleLength } = rule;

    const realStart = findNextNonWhitespace(rule, 0, ruleLength);
    const realEnd = findPrevNonWhitespace(rule, ruleLength - 1) + 1;

    // Ignore comments
    if (rule[realStart] === ADBLOCK_COMMENT_MARKER) {
        return null;
    }

    // Drop rules that are too short or empty
    if (realEnd - realStart < MIN_RULE_LENGTH) {
        return null;
    }

    // Try to find a hash-based cosmetic separator
    let cosmeticSeparator = findHashmarkBasedCosmeticSeparator(rule);

    if (cosmeticSeparator !== null) {
        if (ignoreCosmetics) {
            return null;
        }

        return buildCosmeticRuleParts(rule, realStart, realEnd, cosmeticSeparator);
    }

    // Check host-like comments after the cosmetic separator, to avoid false positives, like `##example.com`
    if (rule[realStart] === HOST_COMMENT_MARKER) {
        return null;
    }

    // try to find dollar based cosmetic separator or network rule separator
    let dollarCount = 0;
    let lastDollarIndex = -1;

    let i = realStart - 1;

    // Check all '$' based patterns
    // eslint-disable-next-line no-cond-assign
    while ((i = rule.indexOf('$', i + 1)) !== -1) {
        dollarCount += 1;
        lastDollarIndex = i;

        if (rule[i + 1] === '$') {
            // $$
            cosmeticSeparator = encodeSeparator(i, 2, CosmeticRuleType.HtmlFilteringRule, false);
        }

        if (rule[i + 1] === '@' && rule[i + 2] === '$') {
            // $@$
            cosmeticSeparator = encodeSeparator(i, 3, CosmeticRuleType.HtmlFilteringRule, true);
        }
    }

    if (cosmeticSeparator !== null) {
        if (ignoreCosmetics) {
            return null;
        }

        return buildCosmeticRuleParts(rule, realStart, realEnd, cosmeticSeparator);
    }

    if (dollarCount === 0) {
        if (!ignoreHosts && hasWhitespace(rule, realStart, realEnd)) {
            // FIXME: domain-only host rules
            return getHostRuleParts(rule, realStart, realEnd);
        }

        const allowlist = rule.startsWith(NETWORK_RULE_ALLOWLIST_MARKER, realStart);

        // simple case, there are no modifiers
        return {
            category: RuleCategory.Network,
            allowlist,
            patternStart: allowlist ? realStart + NETWORK_RULE_ALLOWLIST_MARKER_LENGTH : realStart,
            patternEnd: realEnd,
            text: rule,
        };
    }

    // FIXME: problematic case
    // if (dollarCount > 1 && rule.indexOf('/', lastDollarIndex) !== -1) {
    //     // check if there is / somewhere after last dollar sign
    // }

    const modifierListStart = lastDollarIndex + 1;
    const modifierListEnd = realEnd;

    const allowlist = rule.startsWith(NETWORK_RULE_ALLOWLIST_MARKER, realStart);

    const result: NetworkRuleParts = {
        category: RuleCategory.Network,
        allowlist,
        patternStart: allowlist ? realStart + NETWORK_RULE_ALLOWLIST_MARKER_LENGTH : realStart,
        patternEnd: lastDollarIndex,
        modifiersStart: modifierListStart,
        modifiersEnd: modifierListEnd,
        text: rule,
    };

    const domains = extractDomainsFromModifierList(rule, modifierListStart, modifierListEnd);

    if (domains) {
        result.domainsStart = decodeDomainsStart(domains);
        result.domainsEnd = decodeDomainsEnd(domains);
    }

    return result;
}
