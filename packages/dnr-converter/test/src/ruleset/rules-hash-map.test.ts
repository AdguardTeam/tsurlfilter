import { describe, expect, it } from 'vitest';

import { type HashWithSource, RulesHashMap } from '../../../src/ruleset/rules-hash-map';

describe('RulesHashMap', () => {
    const entries: HashWithSource[] = [
        { hash: 111, source: { filterId: 1, sourceRuleIndex: 0 } },
        { hash: 111, source: { filterId: 2, sourceRuleIndex: 10 } },
        { hash: 222, source: { filterId: 1, sourceRuleIndex: 20 } },
    ];

    it('finds rules by hash', () => {
        const map = new RulesHashMap(entries);

        const result = map.findRules(111);
        expect(result).toHaveLength(2);
        expect(result).toEqual([
            { filterId: 1, sourceRuleIndex: 0 },
            { filterId: 2, sourceRuleIndex: 10 },
        ]);
    });

    it('returns empty array for unknown hash', () => {
        const map = new RulesHashMap(entries);

        expect(map.findRules(999)).toEqual([]);
    });

    it('serializes and deserializes', () => {
        const map = new RulesHashMap(entries);
        const serialized = map.serialize();

        expect(serialized).toBeTruthy();
        expect(typeof serialized).toBe('string');

        const deserialized = RulesHashMap.deserializeSources(serialized);
        expect(deserialized).toHaveLength(entries.length);

        const map2 = new RulesHashMap(deserialized);

        // Verify round-trip preserves data
        expect(map2.findRules(111)).toEqual(map.findRules(111));
        expect(map2.findRules(222)).toEqual(map.findRules(222));
    });

    it('handles empty entries', () => {
        const map = new RulesHashMap([]);

        expect(map.findRules(1)).toEqual([]);
        expect(map.serialize()).toBe('[]');
    });
});
