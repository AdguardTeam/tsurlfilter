const enum RuleType {
    Network,
    Cosmetic,
}

type RuleParts = {
    type: RuleType
    pattern?: string,
    domains?: string[],
    cosmeticContent?: string
}

const NETWORK_RULE_SEPARATOR = '$';
const NETWORK_RULE_MODIFIER_ASSIGN = '=';
const REGEX_MARKER = '/';
const DOMAIN_MODIFIER = 'domain';
const DOMAIN_MODIFIER_LENGTH = DOMAIN_MODIFIER.length;

const COSMETIC_SEPARATOR_OFFSET_MASK = 0x1FFFFFFF;
const COSMETIC_SEPARATOR_LEN_SHIFT = 29;

const encodeOffsetAndLength = (offset: number, length: number): number => {
    return (offset & COSMETIC_SEPARATOR_OFFSET_MASK) | (length << COSMETIC_SEPARATOR_LEN_SHIFT);
};

const decodeLength = (value: number): number => {
    return (value >> COSMETIC_SEPARATOR_LEN_SHIFT) & 0x7;
};

const decodeOffset = (value: number): number => {
    return value & COSMETIC_SEPARATOR_OFFSET_MASK;
};

const findCosmeticSeparator = (rule: string): number | null => {
    let i = rule.indexOf('#');
    
    if (i !== -1) {
        if (rule[i + 1] === '#' && rule[i - 1] !== ' ') {
            // ##
            return encodeOffsetAndLength(i, 2);
        }

        if (rule[i + 1] === '?' && rule[i + 2] === '#') {
            // #?#
            return encodeOffsetAndLength(i, 3);
        }

        if (rule[i + 1] === '%' && rule[i + 2] === '#') {
            // #%#
            return encodeOffsetAndLength(i, 3);
        }

        if (rule[i + 1] === '$') {
            if (rule[i + 2] === '#') {
                // #$#
                return encodeOffsetAndLength(i, 3);
            }

            if (rule[i + 2] === '?' && rule[i + 3] === '#') {
                // #$?#
                return encodeOffsetAndLength(i, 4);
            }
        }

        // Exceptions
        if (rule[i + 1] === '@') {
            if (rule[i + 2] === '#' && rule[i - 1] !== ' ') {
                // #@#
                return encodeOffsetAndLength(i, 3);
            }

            if (rule[i + 2] === '?' && rule[i + 3] === '#') {
                // #@?#
                return encodeOffsetAndLength(i, 4);
            }

            if (rule[i + 2] === '%' && rule[i + 3] === '#') {
                // #@%#
                return encodeOffsetAndLength(i, 4);
            }

            if (rule[i + 2] === '$') {
                if (rule[i + 3] === '#') {
                    // #@$#
                    return encodeOffsetAndLength(i, 4);
                }

                if (rule[i + 3] === '?' && rule[i + 4] === '#') {
                    // #@$?#
                    return encodeOffsetAndLength(i, 5);
                }
            }
        }
    }

    i = rule.indexOf('$');

    if (i !== -1) {
        if (rule[i + 1] === '$') {
            // $$
            return encodeOffsetAndLength(i, 2);
        }

        if (rule[i + 1] === '@' && rule[i + 2] === '$') {
            // $@$
            return encodeOffsetAndLength(i, 3);
        }
    }

    return null;
}

const isAdblockComment = (rule: string): boolean => {
    return rule.startsWith('!');
};

const isHostLikeComment = (rule: string): boolean => {
    return rule.startsWith('#');
};

const extractDomainsFromCosmeticPattern = (pattern: string): string[] => {
    if (pattern.startsWith('[')) {
        // Right part already trimmed
        return pattern.slice(pattern.lastIndexOf(']') + 1).trimStart().split(',').map(d => d.trim());
    }

    return pattern.split(',').map(d => d.trim());
}

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

    return rule.slice(i, end).trim().split('|').map(d => d.trim());
};

export function tokenize(rule: string): RuleParts | null {
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
        };
    }

    return {
        type: RuleType.Network,
        pattern: rule,
    };
}
