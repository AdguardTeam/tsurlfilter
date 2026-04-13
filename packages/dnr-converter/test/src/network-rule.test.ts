import { describe, expect, it } from 'vitest';

import { NetworkRule, NetworkRuleOption } from '../../src/network-rule';

describe('NetworkRule', () => {
    describe('createFromText', () => {
        it('creates a network rule from valid text', () => {
            const rules = NetworkRule.createFromText(1, 0, '||example.com^');

            expect(rules).toHaveLength(1);

            const rule = rules[0];
            expect(rule.getFilterListId()).toBe(1);
            expect(rule.getIndex()).toBe(0);
            expect(rule.text).toBe('||example.com^');
            expect(rule.getPattern()).toBe('||example.com^');
            expect(rule.isAllowlist()).toBe(false);
        });

        it('creates allowlist rule from exception syntax', () => {
            const rules = NetworkRule.createFromText(2, 5, '@@||example.com^');

            expect(rules).toHaveLength(1);
            expect(rules[0].isAllowlist()).toBe(true);
        });

        it('returns empty array for cosmetic rules', () => {
            const rules = NetworkRule.createFromText(1, 0, 'example.com##.ad-banner');

            expect(rules).toHaveLength(0);
        });

        it('returns empty array for comment rules', () => {
            const rules = NetworkRule.createFromText(1, 0, '! This is a comment');

            expect(rules).toHaveLength(0);
        });

        it('rejects rules with spaces in pattern', () => {
            expect(() => {
                NetworkRule.createFromText(1, 0, '127.0.0.1 example.com');
            }).toThrow();
        });

        it('rejects too general rules', () => {
            expect(() => {
                NetworkRule.createFromText(1, 0, 'ab');
            }).toThrow();
        });
    });

    describe('getText', () => {
        it('returns original text when available', () => {
            const rules = NetworkRule.createFromText(1, 0, '||example.com^');

            expect(rules[0].text).toBe('||example.com^');
        });
    });

    describe('getHash', () => {
        it('returns a numeric hash', () => {
            const rules = NetworkRule.createFromText(1, 0, '||example.com^');

            expect(typeof rules[0].getHash()).toBe('number');
        });

        it('returns same hash for same pattern', () => {
            const rules1 = NetworkRule.createFromText(1, 0, '||example.com^');
            const rules2 = NetworkRule.createFromText(2, 5, '||example.com^');

            expect(rules1[0].getHash()).toBe(rules2[0].getHash());
        });
    });

    describe('getRuleTextHash', () => {
        it('returns a numeric hash', () => {
            const rules = NetworkRule.createFromText(1, 0, '||example.com^');

            expect(typeof rules[0].getRuleTextHash()).toBe('number');
        });

        it('returns different hash with salt', () => {
            const rules = NetworkRule.createFromText(1, 0, '||example.com^');
            const hashNoSalt = rules[0].getRuleTextHash();
            const hashWithSalt = rules[0].getRuleTextHash(42);

            expect(hashNoSalt).not.toBe(hashWithSalt);
        });
    });

    describe('isRegexRule', () => {
        it('returns true for regex patterns', () => {
            const rules = NetworkRule.createFromText(1, 0, '/example\\.com/');

            expect(rules).toHaveLength(1);
            expect(rules[0].isRegexRule()).toBe(true);
        });

        it('returns false for non-regex patterns', () => {
            const rules = NetworkRule.createFromText(1, 0, '||example.com^');

            expect(rules[0].isRegexRule()).toBe(false);
        });
    });

    describe('stub methods (AG-47697)', () => {
        it('isOptionEnabled returns true for non-zero options', () => {
            const rules = NetworkRule.createFromText(1, 0, '||example.com^');
            const rule = rules[0];

            expect(rule.isOptionEnabled(NetworkRuleOption.ThirdParty)).toBe(true);
            expect(rule.isOptionEnabled(NetworkRuleOption.NotSet)).toBe(false);
        });

        it('isOptionDisabled returns false for non-zero options', () => {
            const rules = NetworkRule.createFromText(1, 0, '||example.com^');
            const rule = rules[0];

            expect(rule.isOptionDisabled(NetworkRuleOption.ThirdParty)).toBe(false);
            expect(rule.isOptionDisabled(NetworkRuleOption.NotSet)).toBe(true);
        });

        it('negatesBadfilter returns true for any rule', () => {
            const rules1 = NetworkRule.createFromText(1, 0, '||example.com^');
            const rules2 = NetworkRule.createFromText(1, 0, '||other.com^');

            expect(rules1[0].negatesBadfilter(rules2[0])).toBe(true);
        });

        it('domain getters return null or empty', () => {
            const rules = NetworkRule.createFromText(1, 0, '||example.com^');
            const rule = rules[0];

            expect(rule.getPermittedDomains()).toBeNull();
            expect(rule.getRestrictedDomains()).toBeNull();
            expect(rule.getDenyAllowDomains()).toBeNull();
            expect(rule.getPermittedResourceTypes()).toEqual([]);
            expect(rule.getRestrictedResourceTypes()).toEqual([]);
        });
    });

    describe('getPriority', () => {
        it('returns default priority of 1', () => {
            const rules = NetworkRule.createFromText(1, 0, '||example.com^');

            expect(rules[0].getPriority()).toBe(1);
        });
    });
});
