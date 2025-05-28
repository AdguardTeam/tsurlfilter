export const enum RuleType {
    Network,
    Cosmetic,
}

export const enum CosmeticRuleType {
    ElementHidingRule,
    CssInjectionRule,
    JsInjectionRule,
    HtmlFilteringRule,
}

export type RuleParts = {
    type: RuleType,
    pattern?: string,
    domains?: string[],
    cosmeticContent?: string,
    cosmeticSeparator?: number,
    // FIXME: Remove this?
    text: string,
};

const NETWORK_RULE_SEPARATOR = '$';
const NETWORK_RULE_MODIFIER_ASSIGN = '=';
const REGEX_MARKER = '/';
const DOMAIN_MODIFIER = 'domain';
const DOMAIN_MODIFIER_LENGTH = DOMAIN_MODIFIER.length;

const COSMETIC_SEPARATOR_OFFSET_MASK = (1 << 26) - 1; // 0x03FFFFFF (26 lowest bits)

const COSMETIC_SEPARATOR_LEN_SHIFT = 26; // 3 bits
const COSMETIC_SEPARATOR_TYPE_SHIFT = 29; // 2 bits
const COSMETIC_SEPARATOR_ALLOW_SHIFT = 31; // 1 bit

const encode = (
    offset: number,
    length: number,
    type: CosmeticRuleType,
    allow: boolean,
): number => {
    // if (length > 5) throw new RangeError('length > 5');
    // if (type > 3) throw new RangeError('type > 3');

    return (offset & COSMETIC_SEPARATOR_OFFSET_MASK)
           | ((length & 0x7) << COSMETIC_SEPARATOR_LEN_SHIFT)
           | ((type & 0x3) << COSMETIC_SEPARATOR_TYPE_SHIFT)
           | ((allow ? 1 : 0) << COSMETIC_SEPARATOR_ALLOW_SHIFT);
};

export const decodeOffset = (v: number) => v & COSMETIC_SEPARATOR_OFFSET_MASK;
export const decodeLength = (v: number) => (v >>> COSMETIC_SEPARATOR_LEN_SHIFT) & 0x7;
export const decodeType = (v: number) => (v >>> COSMETIC_SEPARATOR_TYPE_SHIFT) & 0x3;
export const decodeIsAllowlist = (v: number) => ((v >>> COSMETIC_SEPARATOR_ALLOW_SHIFT) & 0x1) === 1;

const findCosmeticSeparator = (rule: string): number | null => {
    let i = -1;

    // Check all '#' based patterns
    // eslint-disable-next-line no-cond-assign
    while ((i = rule.indexOf('#', i + 1)) !== -1) {
        if (rule[i + 1] === '#' && rule[i - 1] !== ' ') {
            // ##
            return encode(i, 2, CosmeticRuleType.ElementHidingRule, false);
        }

        if (rule[i + 1] === '?' && rule[i + 2] === '#') {
            // #?#
            return encode(i, 3, CosmeticRuleType.CssInjectionRule, false);
        }

        if (rule[i + 1] === '%' && rule[i + 2] === '#') {
            // #%#
            return encode(i, 3, CosmeticRuleType.JsInjectionRule, false);
        }

        if (rule[i + 1] === '$') {
            if (rule[i + 2] === '#') {
                // #$#
                return encode(i, 3, CosmeticRuleType.CssInjectionRule, false);
            }
            if (rule[i + 2] === '?' && rule[i + 3] === '#') {
                // #$?#
                return encode(i, 4, CosmeticRuleType.CssInjectionRule, false);
            }
        }

        if (rule[i + 1] === '@') {
            if (rule[i + 2] === '#' && rule[i - 1] !== ' ') {
                // #@#
                return encode(i, 3, CosmeticRuleType.ElementHidingRule, true);
            }

            if (rule[i + 2] === '?' && rule[i + 3] === '#') {
                // #@?#
                return encode(i, 4, CosmeticRuleType.ElementHidingRule, true);
            }

            if (rule[i + 2] === '%' && rule[i + 3] === '#') {
                // #@%#
                return encode(i, 4, CosmeticRuleType.JsInjectionRule, true);
            }

            if (rule[i + 2] === '$') {
                if (rule[i + 3] === '#') {
                    // #@$#
                    return encode(i, 4, CosmeticRuleType.CssInjectionRule, true);
                }

                if (rule[i + 3] === '?' && rule[i + 4] === '#') {
                    // #@$?#
                    return encode(i, 5, CosmeticRuleType.CssInjectionRule, true);
                }
            }
        }
    }

    // Check all '$' based patterns
    i = -1;
    // eslint-disable-next-line no-cond-assign
    while ((i = rule.indexOf('$', i + 1)) !== -1) {
        if (rule[i + 1] === '$') {
            // $$
            return encode(i, 2, CosmeticRuleType.HtmlFilteringRule, false);
        }

        if (rule[i + 1] === '@' && rule[i + 2] === '$') {
            // $@$
            return encode(i, 3, CosmeticRuleType.HtmlFilteringRule, true);
        }
    }

    return null;
};

const isAdblockComment = (rule: string): boolean => {
    return rule.startsWith('!');
};

const isHostLikeComment = (rule: string): boolean => {
    return rule.startsWith('#');
};

const extractDomainsFromCosmeticPattern = (pattern: string): string[] => {
    if (pattern === '') {
        return [];
    }

    if (pattern.startsWith('[')) {
        // Right part already trimmed
        return pattern.slice(pattern.lastIndexOf(']') + 1).trimStart().split(',').map((d) => d.trim());
    }

    return pattern.split(',').map((d) => d.trim());
};

// TODO: Improve accuracy of regex detection
const findNetworkRuleSeparator = (rule: string): number => {
    let i = rule.lastIndexOf(NETWORK_RULE_SEPARATOR);

    if (i !== -1) {
        if (rule[i + 1] === REGEX_MARKER) {
            i = rule.lastIndexOf(NETWORK_RULE_SEPARATOR, i - 1);
        }
    }

    return i;
};

const extractDomainsFromNetworkRule = (rule: string, separator: number): string[] => {
    const domainIndex = rule.indexOf(DOMAIN_MODIFIER, separator + 1);

    if (domainIndex === -1) {
        return [];
    }

    let i = domainIndex + DOMAIN_MODIFIER_LENGTH;

    while (i < rule.length && rule[i] === ' ') {
        i += 1;
    }

    if (rule[i] !== NETWORK_RULE_MODIFIER_ASSIGN) {
        return [];
    }

    i += 1;

    while (i < rule.length && rule[i] === ' ') {
        i += 1;
    }

    // find next comma or the end of the string
    let end = rule.indexOf(',', i);

    if (end === -1) {
        end = rule.length;
    }

    return rule.slice(i, end).trim().split('|').map((d) => d.trim());
};

/**
 * Tokenizes an adblock rule into main parts.
 *
 * @param rule The adblock rule to tokenize.
 *
 * @returns The rule parts or null if the rule is not a network or cosmetic rule.
 */
export function tokenize(rule: string): RuleParts | null {
    // Drop rules that are too short or empty
    if (rule.length < 4) {
        return null;
    }

    // Ignore comments
    if (isAdblockComment(rule)) {
        return null;
    }

    const cosmeticSeparator = findCosmeticSeparator(rule);

    if (cosmeticSeparator !== null) {
        const offset = decodeOffset(cosmeticSeparator);
        const length = decodeLength(cosmeticSeparator);
        const pattern = rule.slice(0, offset).trim();

        return {
            type: RuleType.Cosmetic,
            pattern,
            domains: extractDomainsFromCosmeticPattern(pattern),
            cosmeticContent: rule.slice(offset + length),
            cosmeticSeparator,
            text: rule,
        };
    }

    // Check host-like comments after the cosmetic separator, to avoid false positives, like `##example.com`
    if (isHostLikeComment(rule)) {
        return null;
    }

    const networkSeparator = findNetworkRuleSeparator(rule);

    if (networkSeparator !== -1) {
        const pattern = rule.slice(0, networkSeparator).trim();
        const domains = extractDomainsFromNetworkRule(rule, networkSeparator);

        return {
            type: RuleType.Network,
            pattern,
            domains,
            text: rule,
        };
    }

    return {
        type: RuleType.Network,
        pattern: rule,
        text: rule,
    };
}
