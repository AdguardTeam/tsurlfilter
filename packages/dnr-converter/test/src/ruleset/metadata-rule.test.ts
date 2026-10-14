import { describe, expect, it } from 'vitest';

import { ResourceType, RuleActionType } from '../../../src/declarative-rule';
import { InvalidMetadataChunksError } from '../../../src/errors/metadata-errors';
import { MetadataRules } from '../../../src/ruleset/metadata-rule';
import { createMetadataRuleMock, expectMetadataValuesWithinBound } from '../../mocks/metadata-rule';

describe('MetadataRules.create', () => {
    it('creates one rule for a small payload', () => {
        const rules = MetadataRules.create({ a: 1 }, new Set(), false);

        expect(rules).toEqual([{
            id: 1,
            action: { type: RuleActionType.Block },
            condition: {
                urlFilter: 'dummy.rule.adguard.com',
                resourceTypes: [ResourceType.XmlHttpRequest],
            },
            metadata: { chunk: '{"a":1}' },
        }]);
    });

    it('splits a large payload into ordered rules whose chunks rebuild the payload', () => {
        const payload = { text: 'x'.repeat(150_000) };
        const rules = MetadataRules.create(payload, new Set(), false);

        expect(rules.length).toBeGreaterThan(2);
        expect(rules.map((rule) => rule.id)).toEqual(rules.map((_, i) => i + 1));
        expect(JSON.parse(rules.map((rule) => rule.metadata.chunk).join(''))).toEqual(payload);
        expectMetadataValuesWithinBound(JSON.stringify(rules), false);
    });

    it('skips ids used by other rules', () => {
        const rules = MetadataRules.create({ text: 'x'.repeat(150_000) }, new Set([1, 3]), false);

        expect(rules.slice(0, 3).map((rule) => rule.id)).toEqual([2, 4, 5]);
    });

    it('marks every created rule as a metadata rule', () => {
        for (const rule of MetadataRules.create({}, new Set(), false)) {
            expect(MetadataRules.isMetadataRule(rule)).toBe(true);
        }
    });
});

/**
 * Ordinary rule converted from the filter rule `dummy.rule.adguard.com`: it
 * has the marker url but no `metadata` key.
 */
const markerHostRule = {
    id: 101,
    action: { type: 'block' },
    condition: { urlFilter: 'dummy.rule.adguard.com' },
};

describe('MetadataRules.isMetadataRule', () => {
    it('recognizes the dummy url marker', () => {
        const rule = { condition: { urlFilter: 'dummy.rule.adguard.com' }, metadata: { chunk: '' } };
        expect(MetadataRules.isMetadataRule(rule)).toBe(true);
    });

    it('treats a rule with the marker url but no metadata key as an ordinary rule', () => {
        expect(MetadataRules.isMetadataRule(markerHostRule)).toBe(false);
    });

    it('rejects ordinary rules and non-objects', () => {
        expect(MetadataRules.isMetadataRule({ id: 1, condition: { urlFilter: '||example.com^' } })).toBe(false);
        expect(MetadataRules.isMetadataRule({ id: 1 })).toBe(false);
        expect(MetadataRules.isMetadataRule(null)).toBe(false);
        expect(MetadataRules.isMetadataRule('dummy.rule.adguard.com')).toBe(false);
    });
});

describe('MetadataRules.read', () => {
    const ordinary = {
        id: 100,
        action: { type: 'block' },
        condition: { urlFilter: '||example.com^' },
    };

    it('joins leading chunks, parses once and returns the remaining rules', () => {
        const result = MetadataRules.read('ruleset_1', [
            createMetadataRuleMock({ chunk: '{"a":' }),
            createMetadataRuleMock({ chunk: '1}' }, 2),
            ordinary,
        ]);

        expect(result).toEqual({
            payload: { a: 1 },
            declarativeRules: [ordinary],
            metadataRulesCount: 2,
        });
    });

    it('round-trips rules produced by MetadataRules.create', () => {
        const payload = { text: 'x'.repeat(150_000), nested: { list: [1, 2, 3] } };
        const rules = MetadataRules.create(payload, new Set(), false);

        const result = MetadataRules.read('ruleset_1', [...rules, ordinary]);

        expect(result.payload).toEqual(payload);
        expect(result.metadataRulesCount).toBe(rules.length);
        expect(result.declarativeRules).toEqual([ordinary]);
    });

    it('accepts a ruleset with only metadata rules', () => {
        const result = MetadataRules.read('ruleset_0', [createMetadataRuleMock({ chunk: '{}' })]);

        expect(result).toEqual({ payload: {}, declarativeRules: [], metadataRulesCount: 1 });
    });

    it('treats a rule with the marker url but no metadata key as an ordinary rule', () => {
        expect(() => MetadataRules.read('ruleset_1', [markerHostRule])).toThrow('no metadata rules found');

        const chunk = createMetadataRuleMock({ chunk: '{}' });

        expect(MetadataRules.read('ruleset_1', [chunk, markerHostRule, ordinary])).toEqual({
            payload: {},
            declarativeRules: [markerHostRule, ordinary],
            metadataRulesCount: 1,
        });
        expect(MetadataRules.read('ruleset_1', [chunk, ordinary, markerHostRule])).toEqual({
            payload: {},
            declarativeRules: [ordinary, markerHostRule],
            metadataRulesCount: 1,
        });
    });

    it('ignores metadata rule ids', () => {
        const result = MetadataRules.read('ruleset_1', [
            createMetadataRuleMock({ chunk: '{}' }, 999),
            createMetadataRuleMock({ chunk: '' }, 5),
        ]);

        expect(result.metadataRulesCount).toBe(2);
        expect(result.payload).toEqual({});
    });

    it.each<[string, unknown, string]>([
        ['input that is not an array', { id: 1 }, 'expected an array'],
        ['an empty array', [], 'no metadata rules found'],
        ['no leading metadata rule', [ordinary], 'no metadata rules found'],
        ['a chunk that is not a string', [createMetadataRuleMock({ chunk: 5 })], 'is not a string'],
        ['a truncated chunk sequence', [createMetadataRuleMock({ chunk: '{"a":' })], 'do not form valid JSON'],
    ])('rejects %s', (_, input, message) => {
        expect(() => MetadataRules.read('ruleset_7', input)).toThrow(InvalidMetadataChunksError);
        expect(() => MetadataRules.read('ruleset_7', input)).toThrow(message);
        expect(() => MetadataRules.read('ruleset_7', input)).toThrow('ruleset_7');
    });

    it('sets rulesetId and cause on the error', () => {
        let error: unknown;
        try {
            MetadataRules.read('ruleset_7', [createMetadataRuleMock({ chunk: '{"a":' })]);
        } catch (e) {
            error = e;
        }

        expect(error).toBeInstanceOf(InvalidMetadataChunksError);
        expect((error as InvalidMetadataChunksError).rulesetId).toBe('ruleset_7');
        expect((error as InvalidMetadataChunksError).cause).toBeInstanceOf(SyntaxError);
    });
});
