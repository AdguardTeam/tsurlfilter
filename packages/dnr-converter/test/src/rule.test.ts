import { describe, expect, it } from 'vitest';

import { OPTION_NAMES } from '../../src/rule/option-names';
import { Rule } from '../../src/rule/rule';

describe('Rule', () => {
    describe('createFromText', () => {
        it('creates a network rule from valid text', () => {
            const rules = Rule.createFromText(1, 0, '||example.com^');

            expect(rules).toHaveLength(1);

            const rule = rules[0];
            expect(rule.filterListId).toBe(1);
            expect(rule.index).toBe(0);
            expect(rule.getText()).toBe('||example.com^');
            expect(rule.pattern).toBe('||example.com^');
            expect(rule.allowlist).toBe(false);
        });

        it('creates allowlist rule from exception syntax', () => {
            const rules = Rule.createFromText(2, 5, '@@||example.com^');

            expect(rules).toHaveLength(1);
            expect(rules[0].allowlist).toBe(true);
        });

        it('returns empty array for cosmetic rules', () => {
            const rules = Rule.createFromText(1, 0, 'example.com##.ad-banner');

            expect(rules).toHaveLength(0);
        });

        it('returns empty array for comment rules', () => {
            const rules = Rule.createFromText(1, 0, '! This is a comment');

            expect(rules).toHaveLength(0);
        });

        it('rejects rules with spaces in pattern', () => {
            expect(() => {
                Rule.createFromText(1, 0, '127.0.0.1 example.com');
            }).toThrow();
        });

        it('rejects too general rules', () => {
            expect(() => {
                Rule.createFromText(1, 0, 'ab');
            }).toThrow();
        });
    });

    describe('getText', () => {
        it('returns original text when available', () => {
            const rules = Rule.createFromText(1, 0, '||example.com^');

            expect(rules[0].getText()).toBe('||example.com^');
        });
    });

    describe('hash', () => {
        it('returns a numeric hash', () => {
            const rules = Rule.createFromText(1, 0, '||example.com^');

            expect(typeof rules[0].hash).toBe('number');
        });

        it('returns same hash for same pattern', () => {
            const rules1 = Rule.createFromText(1, 0, '||example.com^');
            const rules2 = Rule.createFromText(2, 5, '||example.com^');

            expect(rules1[0].hash).toBe(rules2[0].hash);
        });
    });

    describe('getTextHash', () => {
        it('returns a numeric hash', () => {
            const rules = Rule.createFromText(1, 0, '||example.com^');

            expect(typeof rules[0].getTextHash()).toBe('number');
        });

        it('returns different hash with salt', () => {
            const rules = Rule.createFromText(1, 0, '||example.com^');
            const hashNoSalt = rules[0].getTextHash();
            const hashWithSalt = rules[0].getTextHash(42);

            expect(hashNoSalt).not.toBe(hashWithSalt);
        });
    });

    describe('isRegexRule', () => {
        it('returns true for regex patterns', () => {
            const rules = Rule.createFromText(1, 0, '/example\\.com/');

            expect(rules).toHaveLength(1);
            expect(rules[0].isRegexRule()).toBe(true);
        });

        it('returns false for non-regex patterns', () => {
            const rules = Rule.createFromText(1, 0, '||example.com^');

            expect(rules[0].isRegexRule()).toBe(false);
        });
    });

    describe('modifier methods', () => {
        it('isModifierEnabled returns false for modifiers not present in rule', () => {
            const rules = Rule.createFromText(1, 0, '||example.com^');
            const rule = rules[0];

            expect(rule.isModifierEnabled(OPTION_NAMES.THIRD_PARTY)).toBe(false);
            expect(rule.isModifierEnabled('')).toBe(false);
        });

        it('isModifierEnabled returns true when modifier is present', () => {
            const rules = Rule.createFromText(1, 0, '||example.com^$third-party');
            const rule = rules[0];

            expect(rule.isModifierEnabled(OPTION_NAMES.THIRD_PARTY)).toBe(true);
            expect(rule.isModifierEnabled(OPTION_NAMES.MATCH_CASE)).toBe(false);
        });

        it('isModifierDisabled returns false for modifiers not present in rule', () => {
            const rules = Rule.createFromText(1, 0, '||example.com^');
            const rule = rules[0];

            expect(rule.isModifierDisabled(OPTION_NAMES.THIRD_PARTY)).toBe(false);
            expect(rule.isModifierDisabled('')).toBe(false);
        });

        it('$first-party is normalized to disabledModifiers.third-party', () => {
            // $first-party is an alias for ~$third-party.
            // getCondition() derives DomainType.FirstParty from isModifierDisabled(THIRD_PARTY),
            // so $first-party must land in disabledModifiers, not be silently ignored.
            const [rule] = Rule.createFromText(1, 0, '||example.com^$first-party');

            expect(rule.isModifierDisabled(OPTION_NAMES.THIRD_PARTY)).toBe(true);
            expect(rule.isModifierEnabled(OPTION_NAMES.THIRD_PARTY)).toBe(false);
        });

        it('negatesBadfilter returns false for a rule without $badfilter', () => {
            const rules1 = Rule.createFromText(1, 0, '||example.com^');
            const rules2 = Rule.createFromText(1, 0, '||other.com^');

            expect(rules1[0].negatesBadfilter(rules2[0])).toBe(false);
        });

        it('negatesBadfilter returns true when badfilter rule matches target rule', () => {
            const [badfilterRule] = Rule.createFromText(1, 0, '||example.com^$badfilter');
            const [targetRule] = Rule.createFromText(1, 0, '||example.com^');

            expect(badfilterRule.negatesBadfilter(targetRule)).toBe(true);
        });

        it('negatesBadfilter: null permittedDomains on badfilter side is a wildcard', () => {
            // A $badfilter with no $domain (null permittedDomains) should be
            // treated as a wildcard and intersect with any domain list.
            // Without the fix, stringArraysHaveIntersection(null, ['x.com'])
            // returned false, preventing the badfilter from matching.
            const [badfilterRule] = Rule.createFromText(1, 0, '||example.com^$badfilter');
            const [targetRule] = Rule.createFromText(1, 0, '||example.com^$domain=x.com');

            expect(badfilterRule.negatesBadfilter(targetRule)).toBe(true);
        });

        it('negatesBadfilter returns true when both rules have matching $domain and $badfilter', () => {
            const [badfilterRule] = Rule.createFromText(1, 0, '||example.com^$domain=x.com,badfilter');
            const [targetRule] = Rule.createFromText(1, 0, '||example.com^$domain=x.com');

            expect(badfilterRule.negatesBadfilter(targetRule)).toBe(true);
        });

        it('negatesBadfilter returns false when $domain lists have no intersection', () => {
            const [badfilterRule] = Rule.createFromText(1, 0, '||example.com^$domain=x.com,badfilter');
            const [targetRule] = Rule.createFromText(1, 0, '||example.com^$domain=y.com');

            expect(badfilterRule.negatesBadfilter(targetRule)).toBe(false);
        });

        it('domain properties return null or empty for plain rule', () => {
            const rules = Rule.createFromText(1, 0, '||example.com^');
            const rule = rules[0];

            expect(rule.permittedDomains).toBeNull();
            expect(rule.restrictedDomains).toBeNull();
            expect(rule.denyAllowDomains).toBeNull();
            expect(rule.permittedResourceTypes).toEqual([]);
            expect(rule.restrictedResourceTypes).toEqual([]);
        });

        it('permittedDomains returns domains from $domain modifier', () => {
            const [rule] = Rule.createFromText(1, 0, '||example.com^$domain=foo.com|bar.com');

            expect(rule.permittedDomains).toEqual(['foo.com', 'bar.com']);
            expect(rule.restrictedDomains).toBeNull();
        });

        it('restrictedDomains returns negated domains from $domain modifier', () => {
            const [rule] = Rule.createFromText(1, 0, '||example.com^$domain=~foo.com');

            expect(rule.permittedDomains).toBeNull();
            expect(rule.restrictedDomains).toEqual(['foo.com']);
        });
    });

    describe('priority', () => {
        it('returns default priority of 1', () => {
            const rules = Rule.createFromText(1, 0, '||example.com^');

            expect(rules[0].priority).toBe(1);
        });
    });

    describe('modifier compatibility checks', () => {
        it('throws for $removeparam combined with incompatible modifier $redirect', () => {
            expect(() => {
                Rule.createFromText(1, 0, '||example.com^$removeparam=utm,redirect=noopjs');
            }).toThrow();
        });

        it('throws for $permissions combined with incompatible modifier $third-party', () => {
            expect(() => {
                Rule.createFromText(1, 0, '||example.com^$permissions=camera=(),third-party');
            }).toThrow();
        });

        it('allows $permissions combined with $domain and content types', () => {
            expect(() => {
                Rule.createFromText(
                    1,
                    0,
                    '||example.com^$permissions=geolocation=(self "https://example.com"),subdocument,domain=example.com',
                );
            }).not.toThrow();
        });

        it('throws for $header combined with request-side $removeheader', () => {
            expect(() => {
                Rule.createFromText(1, 0, '||example.com^$header=set-cookie,removeheader=request:set-cookie');
            }).toThrow();
        });

        it('allows $removeparam combined with $third-party and content types', () => {
            expect(() => {
                Rule.createFromText(1, 0, '||example.com^$removeparam=utm,third-party,script');
            }).not.toThrow();
        });

        it('allows $removeheader combined with $header (response-side)', () => {
            expect(() => {
                Rule.createFromText(1, 0, '||example.com^$removeheader=refresh,third-party');
            }).not.toThrow();
        });
    });
});
