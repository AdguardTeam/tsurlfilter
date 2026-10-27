import { describe, expect, it } from 'vitest';

import { OPTION_NAMES } from '../../src/rule/option-names';
import { Rule } from '../../src/rule/rule';
import { BadfilterNegationKind, RuleBadfilter } from '../../src/rule/rule-badfilter';

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

        it('rejects rules with unknown modifiers', () => {
            expect(() => {
                Rule.createFromText(1, 0, 'test$whatever,domain=example.org');
            }).toThrow('Unknown modifier: whatever');
        });

        it('accepts noop modifiers made only of underscores', () => {
            expect(() => {
                Rule.createFromText(1, 0, 'test$_,___,domain=example.org');
            }).not.toThrow();
        });

        it('rejects modifier names that only start with the noop marker', () => {
            expect(() => {
                Rule.createFromText(1, 0, 'test$_whatever,domain=example.org');
            }).toThrow('Unknown modifier: _whatever');
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
            // treated as a wildcard and intersect with any domain list, in both
            // directions.
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

        it('negatesBadfilter compares the value of the advanced modifier', () => {
            const [badfilterRule] = Rule.createFromText(1, 0, '||example.com^$removeparam=foo,badfilter');
            const [sameValue] = Rule.createFromText(1, 0, '||example.com^$removeparam=foo');
            const [otherValue] = Rule.createFromText(1, 0, '||example.com^$removeparam=bar');
            const [noValue] = Rule.createFromText(1, 0, '||example.com^$removeparam');

            expect(badfilterRule.negatesBadfilter(sameValue)).toBe(true);
            expect(badfilterRule.negatesBadfilter(otherValue)).toBe(false);
            expect(badfilterRule.negatesBadfilter(noValue)).toBe(false);
        });

        it('negatesBadfilter compares the value of the $csp modifier', () => {
            const [badfilterRule] = Rule.createFromText(1, 0, "||example.com^$csp=script-src 'self',badfilter");
            const [sameValue] = Rule.createFromText(1, 0, "||example.com^$csp=script-src 'self'");
            const [otherValue] = Rule.createFromText(1, 0, "||example.com^$csp=script-src 'none'");

            expect(badfilterRule.negatesBadfilter(sameValue)).toBe(true);
            expect(badfilterRule.negatesBadfilter(otherValue)).toBe(false);
        });

        it('negatesBadfilter distinguishes $redirect from $redirect-rule', () => {
            const [badfilterRule] = Rule.createFromText(1, 0, '||example.com^$redirect-rule=nooptext,badfilter');
            const [redirectRule] = Rule.createFromText(1, 0, '||example.com^$redirect=nooptext');
            const [redirectRuleModifier] = Rule.createFromText(1, 0, '||example.com^$redirect-rule=nooptext');

            expect(badfilterRule.negatesBadfilter(redirectRule)).toBe(false);
            expect(badfilterRule.negatesBadfilter(redirectRuleModifier)).toBe(true);
        });

        it('negatesBadfilter compares $header values', () => {
            const [badfilterRule] = Rule.createFromText(1, 0, '||example.com^$header=set-cookie:/a/,badfilter');
            const [sameValue] = Rule.createFromText(1, 0, '||example.com^$header=set-cookie:/a/');
            const [otherValue] = Rule.createFromText(1, 0, '||example.com^$header=set-cookie:/b/');
            const [otherHeader] = Rule.createFromText(1, 0, '||example.com^$header=referer');

            expect(badfilterRule.negatesBadfilter(sameValue)).toBe(true);
            expect(badfilterRule.negatesBadfilter(otherValue)).toBe(false);
            expect(badfilterRule.negatesBadfilter(otherHeader)).toBe(false);
        });

        it('negatesBadfilter compares $method values', () => {
            const [badfilterRule] = Rule.createFromText(1, 0, '||example.com^$method=GET,badfilter');
            const [sameValue] = Rule.createFromText(1, 0, '||example.com^$method=GET');
            const [otherValue] = Rule.createFromText(1, 0, '||example.com^$method=POST');

            expect(badfilterRule.negatesBadfilter(sameValue)).toBe(true);
            expect(badfilterRule.negatesBadfilter(otherValue)).toBe(false);
        });

        it('negatesBadfilter compares $to values', () => {
            const [badfilterRule] = Rule.createFromText(1, 0, '||example.com^$to=a.com,badfilter');
            const [sameValue] = Rule.createFromText(1, 0, '||example.com^$to=a.com');
            const [otherValue] = Rule.createFromText(1, 0, '||example.com^$to=b.com');

            expect(badfilterRule.negatesBadfilter(sameValue)).toBe(true);
            expect(badfilterRule.negatesBadfilter(otherValue)).toBe(false);
        });

        it('negatesBadfilter compares $permissions values', () => {
            const [badfilterRule] = Rule.createFromText(1, 0, '||example.com^$permissions=fullscreen=(),badfilter');
            const [sameValue] = Rule.createFromText(1, 0, '||example.com^$permissions=fullscreen=()');
            const [otherValue] = Rule.createFromText(1, 0, '||example.com^$permissions=document-domain=()');

            expect(badfilterRule.negatesBadfilter(sameValue)).toBe(true);
            expect(badfilterRule.negatesBadfilter(otherValue)).toBe(false);
        });

        it('negatesBadfilter compares values as written, without normalizing them', () => {
            const cases: [string, string][] = [
                ['||example.com^$removeheader=Set-Cookie', '||example.com^$removeheader=set-cookie,badfilter'],
                ['||example.com^$to=Example.com', '||example.com^$to=example.com,badfilter'],
                ['||example.com^$method=GET', '||example.com^$method=get,badfilter'],
                ['||example.com^$method=GET|POST', '||example.com^$method=POST|GET,badfilter'],
                ['||example.com^$to=a.com|b.com', '||example.com^$to=b.com|a.com,badfilter'],
                [
                    '||example.com^$permissions=fullscreen=()\\,document-domain=()',
                    '||example.com^$permissions=fullscreen=()|document-domain=(),badfilter',
                ],
            ];

            for (const [targetText, badfilterText] of cases) {
                const [badfilterRule] = Rule.createFromText(1, 0, badfilterText);
                const [targetRule] = Rule.createFromText(1, 0, targetText);
                expect(badfilterRule.negatesBadfilter(targetRule)).toBe(false);
            }
        });

        describe('negationScope', () => {
            it('returns Full when the rule texts match', () => {
                const [badfilterRule] = Rule.createFromText(1, 0, '||example.com^$badfilter');
                const [targetRule] = Rule.createFromText(1, 0, '||example.com^');

                expect(RuleBadfilter.negationScope(badfilterRule, targetRule))
                    .toEqual({ kind: BadfilterNegationKind.Full });
            });

            it('returns None when the badfilter rule has no $badfilter modifier', () => {
                const [badfilterRule] = Rule.createFromText(1, 0, '||example.com^');
                const [targetRule] = Rule.createFromText(1, 0, '||example.com^');

                expect(RuleBadfilter.negationScope(badfilterRule, targetRule))
                    .toEqual({ kind: BadfilterNegationKind.None });
            });

            it('returns Partial with the domains that the badfilter does not cover', () => {
                const [badfilterRule] = Rule.createFromText(1, 0, '||example.com^$domain=foo.com,badfilter');
                const [targetRule] = Rule.createFromText(1, 0, '||example.com^$domain=foo.com|bar.com');

                expect(RuleBadfilter.negationScope(badfilterRule, targetRule)).toEqual({
                    kind: BadfilterNegationKind.Partial,
                    permittedDomains: ['bar.com'],
                });
            });

            it('returns Partial for a wildcard-TLD entry that both rules name', () => {
                const [badfilterRule] = Rule.createFromText(1, 0, '||example.com^$domain=example.*,badfilter');
                const [targetRule] = Rule.createFromText(1, 0, '||example.com^$domain=example.*|bar.com');

                expect(RuleBadfilter.negationScope(badfilterRule, targetRule)).toEqual({
                    kind: BadfilterNegationKind.Partial,
                    permittedDomains: ['bar.com'],
                });
            });

            it('compares domain names case-insensitively', () => {
                const [badfilterRule] = Rule.createFromText(1, 0, '||example.com^$domain=FOO.com,badfilter');
                const [targetRule] = Rule.createFromText(1, 0, '||example.com^$domain=foo.com|bar.com');

                expect(RuleBadfilter.negationScope(badfilterRule, targetRule)).toEqual({
                    kind: BadfilterNegationKind.Partial,
                    permittedDomains: ['bar.com'],
                });
            });

            it('returns Full when the badfilter covers every target domain', () => {
                const [badfilterRule] = Rule.createFromText(1, 0, '||example.com^$domain=foo.com|bar.com,badfilter');
                const [targetRule] = Rule.createFromText(1, 0, '||example.com^$domain=foo.com');

                expect(RuleBadfilter.negationScope(badfilterRule, targetRule))
                    .toEqual({ kind: BadfilterNegationKind.Full });
            });

            it('returns Full when the target rule has no $domain', () => {
                // A rule without `$domain` applies everywhere, so the badfilter
                // covers its whole domain scope.
                const [badfilterRule] = Rule.createFromText(1, 0, '||example.com^$domain=foo.com,badfilter');
                const [targetRule] = Rule.createFromText(1, 0, '||example.com^');

                expect(RuleBadfilter.negationScope(badfilterRule, targetRule))
                    .toEqual({ kind: BadfilterNegationKind.Full });
            });

            it('returns None when the $domain lists do not overlap', () => {
                const [badfilterRule] = Rule.createFromText(1, 0, '||example.com^$domain=foo.com,badfilter');
                const [targetRule] = Rule.createFromText(1, 0, '||example.com^$domain=bar.com');

                expect(RuleBadfilter.negationScope(badfilterRule, targetRule))
                    .toEqual({ kind: BadfilterNegationKind.None });
            });

            it('returns None when a value-bearing modifier differs', () => {
                const [badfilterRule] = Rule.createFromText(
                    1,
                    0,
                    '||example.com^$removeparam=foo,domain=foo.com,badfilter',
                );
                const [targetRule] = Rule.createFromText(1, 0, '||example.com^$removeparam=bar,domain=foo.com|bar.com');

                expect(RuleBadfilter.negationScope(badfilterRule, targetRule))
                    .toEqual({ kind: BadfilterNegationKind.None });
            });

            it('returns None when a rule has a negated $domain', () => {
                const [badfilterRule] = Rule.createFromText(1, 0, '||example.com^$domain=foo.com|~bar.com,badfilter');
                const [targetRule] = Rule.createFromText(1, 0, '||example.com^$domain=foo.com|bar.com');

                expect(RuleBadfilter.negationScope(badfilterRule, targetRule))
                    .toEqual({ kind: BadfilterNegationKind.None });
            });
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

    describe('withPermittedDomains', () => {
        it('narrows the permitted domains and keeps the written text and hash', () => {
            const [targetRule] = Rule.createFromText(1, 0, '||example.com^$domain=foo.com|bar.com');
            const narrowed = targetRule.withPermittedDomains(['bar.com']);

            expect(narrowed).not.toBe(targetRule);
            expect(narrowed.permittedDomains).toEqual(['bar.com']);
            expect(narrowed.restrictedDomains).toBeNull();
            expect(narrowed.originalText).toBe(targetRule.originalText);
            expect(narrowed.hash).toBe(targetRule.hash);
            expect(narrowed.pattern).toBe(targetRule.pattern);
        });

        it('keeps the priority of the rule that the badfilter narrows', () => {
            const [targetRule] = Rule.createFromText(1, 0, '||example.com^$domain=foo.com|bar.com');
            const [singleDomainRule] = Rule.createFromText(1, 0, '||example.com^$domain=bar.com');

            // A narrower list would get a higher priority on its own, but MV2
            // does not change the weight of a badfiltered rule.
            expect(singleDomainRule.priority).toBeGreaterThan(targetRule.priority);
            expect(targetRule.withPermittedDomains(['bar.com']).priority)
                .toBe(targetRule.priority);
        });

        it('throws when the rule has no permitted $domain list', () => {
            const [targetRule] = Rule.createFromText(1, 0, '||example.com^');

            expect(() => targetRule.withPermittedDomains(['bar.com'])).toThrow();
        });

        it('throws when the new permitted $domain list is empty', () => {
            const [targetRule] = Rule.createFromText(1, 0, '||example.com^$domain=foo.com|bar.com');

            expect(() => targetRule.withPermittedDomains([])).toThrow();
        });

        it('keeps a second badfilter matching the narrowed rule', () => {
            const [secondBadfilter] = Rule.createFromText(1, 0, '||example.com^$domain=baz.com,badfilter');
            const [targetRule] = Rule.createFromText(1, 0, '||example.com^$domain=foo.com|bar.com|baz.com');

            const narrowed = targetRule.withPermittedDomains(['bar.com', 'baz.com']);

            expect(secondBadfilter.negatesBadfilter(narrowed)).toBe(true);
        });
    });

    describe('applyBadfilters', () => {
        it('returns null when a badfilter cancels the rule completely', () => {
            const [badfilterRule] = Rule.createFromText(1, 0, '||example.com^$badfilter');
            const [targetRule] = Rule.createFromText(1, 0, '||example.com^');

            expect(Rule.applyBadfilters(targetRule, [badfilterRule])).toBeNull();
        });

        it('returns the unchanged rule when no badfilter matches', () => {
            const [badfilterRule] = Rule.createFromText(1, 0, '||other.com^$badfilter');
            const [targetRule] = Rule.createFromText(1, 0, '||example.com^');

            expect(Rule.applyBadfilters(targetRule, [badfilterRule])).toBe(targetRule);
        });

        it('narrows the rule when a badfilter cancels it partly', () => {
            const [badfilterRule] = Rule.createFromText(1, 0, '||example.com^$domain=foo.com,badfilter');
            const [targetRule] = Rule.createFromText(1, 0, '||example.com^$domain=foo.com|bar.com');

            const result = Rule.applyBadfilters(targetRule, [badfilterRule]);

            expect(result?.permittedDomains).toEqual(['bar.com']);
        });

        it('applies several partial badfilters one after another', () => {
            const [firstBadfilter] = Rule.createFromText(1, 0, '||example.com^$domain=foo.com,badfilter');
            const [secondBadfilter] = Rule.createFromText(1, 0, '||example.com^$domain=baz.com,badfilter');
            const [targetRule] = Rule.createFromText(1, 0, '||example.com^$domain=foo.com|bar.com|baz.com');

            const result = Rule.applyBadfilters(targetRule, [firstBadfilter, secondBadfilter]);

            expect(result?.permittedDomains).toEqual(['bar.com']);
        });

        it('drops the rule when a later badfilter covers the remaining domains', () => {
            const [firstBadfilter] = Rule.createFromText(1, 0, '||example.com^$domain=foo.com,badfilter');
            const [secondBadfilter] = Rule.createFromText(1, 0, '||example.com^$domain=bar.com,badfilter');
            const [targetRule] = Rule.createFromText(1, 0, '||example.com^$domain=foo.com|bar.com');

            expect(Rule.applyBadfilters(targetRule, [firstBadfilter, secondBadfilter])).toBeNull();
        });
    });

    describe('advancedModifierValue', () => {
        it('keeps an empty string for value-less $removeparam (remove all query parameters)', () => {
            const [rule] = Rule.createFromText(1, 0, '||example.com^$removeparam');

            expect(rule.isModifierEnabled(OPTION_NAMES.REMOVEPARAM)).toBe(true);
            expect(rule.advancedModifierValue).toBe('');
        });

        it('stores the value of $removeparam', () => {
            const [rule] = Rule.createFromText(1, 0, '||example.com^$removeparam=utm_source');

            expect(rule.advancedModifierValue).toBe('utm_source');
        });

        it('keeps null for other value-less advanced modifiers (only $removeparam keeps an empty string)', () => {
            const [rule] = Rule.createFromText(1, 0, '||example.com^$cookie');

            expect(rule.isModifierEnabled(OPTION_NAMES.COOKIE)).toBe(true);
            expect(rule.advancedModifierValue).toBeNull();
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
