import { describe, expect, it } from 'vitest';

import { type DeclarativeRule, HeaderOperation, RuleActionType } from '../../../src/declarative-rule';
import { Ruleset } from '../../../src/ruleset/ruleset';

/**
 * Creates a minimal declarative rule for testing.
 *
 * @param id Rule id.
 * @param urlFilter URL filter pattern.
 *
 * @returns DeclarativeRule.
 */
const makeRule = (id: number, urlFilter: string): DeclarativeRule => ({
    id,
    priority: 1,
    action: { type: RuleActionType.Block },
    condition: { urlFilter },
});

/**
 * Creates a minimal regexp declarative rule for testing.
 *
 * @param id Rule id.
 * @param regexFilter Regex filter pattern.
 *
 * @returns DeclarativeRule.
 */
const makeRegexRule = (id: number, regexFilter: string): DeclarativeRule => ({
    id,
    priority: 1,
    action: { type: RuleActionType.Block },
    condition: { regexFilter },
});

describe('Ruleset (simple)', () => {
    describe('constructor + getters', () => {
        it('returns id', () => {
            const rs = new Ruleset('rs-1', []);
            expect(rs.getId()).toBe('rs-1');
        });

        it('returns rules count from declarativeRules length', () => {
            const rules = [makeRule(1, '||example.com^'), makeRule(2, '||example.net^')];
            const rs = new Ruleset('rs-1', rules);
            expect(rs.getRulesCount()).toBe(2);
        });

        it('returns unsafe rules count from declarative rules', () => {
            const unsafeRule = {
                id: 10,
                priority: 1,
                action: {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [{ header: 'x-frame-options', operation: HeaderOperation.Remove }],
                },
                condition: { urlFilter: '||unsafe.com^' },
            };
            const rs = new Ruleset('rs-1', [unsafeRule]);
            expect(rs.getUnsafeRulesCount()).toBe(1);
        });

        it('returns regexp rules count', () => {
            const rules = [makeRegexRule(1, '/ads/'), makeRegexRule(2, '/tracking/'), makeRegexRule(3, '/banner/')];
            const rs = new Ruleset('rs-1', rules);
            expect(rs.getRegexpRulesCount()).toBe(3);
        });

        it('returns declarative rules array', () => {
            const rules = [makeRule(1, '||example.com^')];
            const rs = new Ruleset('rs-1', rules);
            expect(rs.getDeclarativeRules()).toStrictEqual(rules);
        });
    });

    describe('serialize', () => {
        it('serializes declarative rules to JSON string', () => {
            const rules = [makeRule(1, '||example.com^'), makeRule(2, '||example.net^')];
            const rs = new Ruleset('rs-1', rules);
            const serialized = rs.serialize();

            const parsed = JSON.parse(serialized) as DeclarativeRule[];
            expect(parsed).toStrictEqual(rules);
        });

        it('serializes empty ruleset', () => {
            const rs = new Ruleset('rs-empty', []);
            expect(rs.serialize()).toBe('[]');
        });
    });

    describe('deserialize', () => {
        it('round-trips through serialize + deserialize', () => {
            const rules = [makeRule(1, '||example.com^'), makeRule(2, '||example.net^')];
            const rs = new Ruleset('rs-1', rules);

            const json = rs.serialize();
            const restored = Ruleset.deserialize('rs-1', json);

            expect(restored.getId()).toBe('rs-1');
            expect(restored.getRulesCount()).toBe(2);
            expect(restored.getDeclarativeRules()).toStrictEqual(rules);
        });

        it('recomputes regexp rules count on deserialization', () => {
            const rules = [
                makeRule(1, '||example.com^'),
                makeRegexRule(2, '.*\\.ads\\..*'),
            ];
            const rs = new Ruleset('rs-1', rules);
            const restored = Ruleset.deserialize('rs-1', rs.serialize());

            expect(restored.getRegexpRulesCount()).toBe(1);
        });

        it('throws on invalid JSON', () => {
            expect(() => Ruleset.deserialize('rs-bad', 'not-json{{')).toThrow();
        });

        it('throws when JSON is not an array of rules', () => {
            expect(() => Ruleset.deserialize('rs-bad', '"just a string"')).toThrow();
        });

        it('throws when a rule is missing required fields', () => {
            const badRules = [{ id: 1 }]; // missing action and condition
            expect(() => Ruleset.deserialize('rs-bad', JSON.stringify(badRules))).toThrow();
        });
    });
});
