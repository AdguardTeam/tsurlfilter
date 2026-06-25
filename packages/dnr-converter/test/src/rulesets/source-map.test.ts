import { describe, expect, it } from 'vitest';

import { type Source, SourceMap } from '../../../src/ruleset/source-map';

describe('SourceMap', () => {
    const sources: Source[] = [
        { declarativeRuleId: 100, sourceRuleIndex: 0, filterId: 1 },
        { declarativeRuleId: 100, sourceRuleIndex: 10, filterId: 2 },
        { declarativeRuleId: 200, sourceRuleIndex: 20, filterId: 1 },
    ];

    it('returns source pairs by declarative rule id', () => {
        const map = new SourceMap(sources);

        const result = map.getByDeclarativeRuleId(100);
        expect(result).toHaveLength(2);
        expect(result).toEqual([
            { sourceRuleIndex: 0, filterId: 1 },
            { sourceRuleIndex: 10, filterId: 2 },
        ]);
    });

    it('returns empty array for unknown declarative rule id', () => {
        const map = new SourceMap(sources);

        expect(map.getByDeclarativeRuleId(999)).toEqual([]);
    });

    it('returns declarative rule ids by source rule index', () => {
        const map = new SourceMap(sources);

        const result = map.getBySourceRuleIndex({ sourceRuleIndex: 0, filterId: 1 });
        expect(result).toEqual([100]);
    });

    it('returns empty array for unknown source rule', () => {
        const map = new SourceMap(sources);

        expect(map.getBySourceRuleIndex({ sourceRuleIndex: 99, filterId: 1 })).toEqual([]);
    });

    it('serializes and deserializes', () => {
        const map = new SourceMap(sources);
        const serialized = map.serialize();

        expect(serialized).toBeTruthy();
        expect(typeof serialized).toBe('string');

        const deserialized = SourceMap.deserializeSources(serialized);
        expect(deserialized).toHaveLength(sources.length);

        const map2 = new SourceMap(deserialized);

        // Verify round-trip preserves data
        expect(map2.getByDeclarativeRuleId(100)).toEqual(map.getByDeclarativeRuleId(100));
        expect(map2.getByDeclarativeRuleId(200)).toEqual(map.getByDeclarativeRuleId(200));
    });

    it('handles empty sources', () => {
        const map = new SourceMap([]);

        expect(map.getByDeclarativeRuleId(1)).toEqual([]);
        expect(map.serialize()).toBe('[]');
    });
});
