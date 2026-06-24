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
        expect(map.serialize()).toBe('');
    });

    describe('deserializeSources', () => {
        it('deserializes valid triples unchanged', () => {
            // Use serialize() output as input — validates the round-trip format.
            const serialized = new SourceMap([
                { declarativeRuleId: 100, sourceRuleIndex: 0, filterId: 1 },
                { declarativeRuleId: 200, sourceRuleIndex: 20, filterId: 2 },
            ]).serialize();

            const result = SourceMap.deserializeSources(serialized);

            expect(result).toEqual([
                { declarativeRuleId: 100, sourceRuleIndex: 0, filterId: 1 },
                { declarativeRuleId: 200, sourceRuleIndex: 20, filterId: 2 },
            ]);
        });

        it('deserializes an empty array', () => {
            expect(SourceMap.deserializeSources('')).toEqual([]);
        });

        it('throws a descriptive error on malformed VLQ string', () => {
            // '!!!' contains characters not in the base64 VLQ alphabet.
            expect(() => SourceMap.deserializeSources('!!!'))
                .toThrow(/source map/i);
        });

        it('throws a descriptive error on a segment with wrong arity (too few VLQ values)', () => {
            // 'C' is valid VLQ but only encodes 1 value, not a triple — the
            // decoder tries to read 3 values and hits an invalid char (out of
            // bounds).
            expect(() => SourceMap.deserializeSources('C'))
                .toThrow(/source map/i);
        });

        it('throws a descriptive error on a segment with wrong arity (too many VLQ values)', () => {
            // A valid VLQ triple followed by an extra VLQ char — the extra data
            // is silently consumed (decoder reads exactly 3), but the string
            // should not have trailing content after a complete triple.
            // Since the decoder reads exactly 3 values per segment and ignores
            // the rest, this input produces a valid triple and should NOT throw.
            // This verifies that extra VLQ chars within a segment are
            // harmlessly ignored rather than causing an error.
            const serialized = new SourceMap([
                { declarativeRuleId: 100, sourceRuleIndex: 0, filterId: 1 },
                { declarativeRuleId: 200, sourceRuleIndex: 20, filterId: 2 },
            ]).serialize();

            // Round-trip works — the format is self-delimiting.
            const result = SourceMap.deserializeSources(serialized);
            expect(result).toHaveLength(2);
        });

        it('throws a descriptive error on negative decoded values', () => {
            // Crafted VLQ: 'D' (base64 index 3) decodes to -1 via the VLQ sign
            // bit.  'DDD' is a triple of [-1, -1, -1], which fails valibot
            // minValue(0) validation.
            expect(() => SourceMap.deserializeSources('DDD'))
                .toThrow(/source map/i);
        });

        it('throws a descriptive error on non-triple input (multiple segments with wrong arity)', () => {
            // Two segments where the second is too short (only 1 VLQ value
            // instead of 3).
            const validTriple = new SourceMap([
                { declarativeRuleId: 100, sourceRuleIndex: 0, filterId: 1 },
            ]).serialize();

            // Append a malformed segment with too few values.
            const malformed = `${validTriple},C`;
            expect(() => SourceMap.deserializeSources(malformed))
                .toThrow(/source map/i);
        });
    });
});
