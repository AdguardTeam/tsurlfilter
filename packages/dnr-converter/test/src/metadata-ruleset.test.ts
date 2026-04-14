import { describe, expect, it } from 'vitest';

import { METADATA_RULESET_ID, MetadataRuleset } from '../../src/ruleset/metadata-ruleset';

describe('MetadataRuleset', () => {
    describe('constructor defaults', () => {
        it('creates an instance with empty checksums and additional properties', () => {
            const ruleSet = new MetadataRuleset();

            expect(ruleSet.getRuleSetIds()).toEqual([]);
            expect(ruleSet.getChecksum('ruleset_1')).toBeUndefined();
        });
    });

    describe('getId()', () => {
        it(`returns "ruleset_${METADATA_RULESET_ID}"`, () => {
            const ruleSet = new MetadataRuleset();

            expect(ruleSet.getId()).toBe(`ruleset_${METADATA_RULESET_ID}`);
        });

        it('returns "ruleset_0"', () => {
            const ruleSet = new MetadataRuleset();

            expect(ruleSet.getId()).toBe('ruleset_0');
        });
    });

    describe('setChecksum / getChecksum', () => {
        it('sets and gets a checksum', () => {
            const ruleSet = new MetadataRuleset();

            ruleSet.setChecksum('ruleset_1', 'abc123');

            expect(ruleSet.getChecksum('ruleset_1')).toBe('abc123');
        });

        it('overwrites an existing checksum', () => {
            const ruleSet = new MetadataRuleset();

            ruleSet.setChecksum('ruleset_1', 'abc123');
            ruleSet.setChecksum('ruleset_1', 'xyz789');

            expect(ruleSet.getChecksum('ruleset_1')).toBe('xyz789');
        });

        it('returns undefined for a non-existent ruleset id', () => {
            const ruleSet = new MetadataRuleset();

            expect(ruleSet.getChecksum('ruleset_999')).toBeUndefined();
        });
    });

    describe('getRuleSetIds()', () => {
        it('returns empty array when no checksums set', () => {
            const ruleSet = new MetadataRuleset();

            expect(ruleSet.getRuleSetIds()).toEqual([]);
        });

        it('returns correct keys after setting checksums', () => {
            const ruleSet = new MetadataRuleset();

            ruleSet.setChecksum('ruleset_1', 'aaa');
            ruleSet.setChecksum('ruleset_2', 'bbb');

            expect(ruleSet.getRuleSetIds()).toEqual(['ruleset_1', 'ruleset_2']);
        });
    });

    describe('additional properties', () => {
        it('sets and gets an additional property', () => {
            const ruleSet = new MetadataRuleset();

            ruleSet.setAdditionalProperty('version', '1.0');

            expect(ruleSet.getAdditionalProperty('version')).toBe('1.0');
        });

        it('hasAdditionalProperty returns true for existing key', () => {
            const ruleSet = new MetadataRuleset();

            ruleSet.setAdditionalProperty('key', 42);

            expect(ruleSet.hasAdditionalProperty('key')).toBe(true);
        });

        it('hasAdditionalProperty returns false for missing key', () => {
            const ruleSet = new MetadataRuleset();

            expect(ruleSet.hasAdditionalProperty('missing')).toBe(false);
        });

        it('removeAdditionalProperty removes the key', () => {
            const ruleSet = new MetadataRuleset();

            ruleSet.setAdditionalProperty('toRemove', 'value');
            ruleSet.removeAdditionalProperty('toRemove');

            expect(ruleSet.hasAdditionalProperty('toRemove')).toBe(false);
            expect(ruleSet.getAdditionalProperty('toRemove')).toBeUndefined();
        });

        it('removeAdditionalProperty is a no-op for a missing key', () => {
            const ruleSet = new MetadataRuleset();

            expect(() => ruleSet.removeAdditionalProperty('nonexistent')).not.toThrow();
        });

        it('getAdditionalProperty returns undefined for missing key', () => {
            const ruleSet = new MetadataRuleset();

            expect(ruleSet.getAdditionalProperty('nonexistent')).toBeUndefined();
        });

        it('supports complex values', () => {
            const ruleSet = new MetadataRuleset();
            const nested = { a: [1, 2, 3], b: { c: true } };

            ruleSet.setAdditionalProperty('nested', nested);

            expect(ruleSet.getAdditionalProperty('nested')).toEqual(nested);
        });
    });

    describe('serialize()', () => {
        it('produces valid JSON array with a metadata rule', () => {
            const ruleSet = new MetadataRuleset();
            ruleSet.setChecksum('ruleset_1', 'abc123');

            const json = ruleSet.serialize();
            const parsed = JSON.parse(json);

            expect(Array.isArray(parsed)).toBe(true);
            expect(parsed).toHaveLength(1);
            expect(parsed[0]).toHaveProperty('metadata');
            expect(parsed[0].metadata.checksums).toEqual({ ruleset_1: 'abc123' });
        });

        it('produces compact JSON by default', () => {
            const ruleSet = new MetadataRuleset();
            const json = ruleSet.serialize();

            expect(json).not.toContain('\n');
        });

        it('produces pretty-printed JSON when pretty=true', () => {
            const ruleSet = new MetadataRuleset();
            const json = ruleSet.serialize(true);

            expect(json).toContain('\n');
        });
    });

    describe('deserialize()', () => {
        it('round-trips correctly with checksums and additional properties', () => {
            const original = new MetadataRuleset();
            original.setChecksum('ruleset_1', 'hash1');
            original.setChecksum('ruleset_2', 'hash2');
            original.setAdditionalProperty('version', '2.0');
            original.setAdditionalProperty('count', 42);

            const json = original.serialize();
            const restored = MetadataRuleset.deserialize(json);

            expect(restored.getChecksum('ruleset_1')).toBe('hash1');
            expect(restored.getChecksum('ruleset_2')).toBe('hash2');
            expect(restored.getAdditionalProperty('version')).toBe('2.0');
            expect(restored.getAdditionalProperty('count')).toBe(42);
            expect(restored.getRuleSetIds()).toEqual(['ruleset_1', 'ruleset_2']);
        });

        it('round-trips an empty MetadataRuleset', () => {
            const original = new MetadataRuleset();
            const json = original.serialize();
            const restored = MetadataRuleset.deserialize(json);

            expect(restored.getRuleSetIds()).toEqual([]);
        });

        it('throws on empty string input', () => {
            expect(() => MetadataRuleset.deserialize('')).toThrow();
        });

        it('throws on "[]" (empty array)', () => {
            expect(() => MetadataRuleset.deserialize('[]')).toThrow(
                'Invalid input: expected a single-element array.',
            );
        });

        it('throws on array with more than one element', () => {
            const valid = JSON.parse(new MetadataRuleset().serialize())[0];
            const json = JSON.stringify([valid, valid]);

            expect(() => MetadataRuleset.deserialize(json)).toThrow(
                'Invalid input: expected a single-element array.',
            );
        });

        it('throws on valid JSON missing metadata field', () => {
            const json = JSON.stringify([{ id: 1, action: { type: 'block' } }]);

            expect(() => MetadataRuleset.deserialize(json)).toThrow();
        });

        it('throws on metadata.checksums with wrong type (string values expected)', () => {
            const badJson = JSON.stringify([{
                id: 1,
                action: { type: 'block' },
                metadata: {
                    checksums: { ruleset_1: 123 }, // should be string
                    additionalProperties: {},
                },
            }]);

            expect(() => MetadataRuleset.deserialize(badJson)).toThrow();
        });
    });
});
