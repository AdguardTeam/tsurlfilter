import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { METADATA_RULESET_ID, MetadataRuleset } from '../../src/ruleset/metadata-ruleset';

describe('MetadataRuleset', () => {
    describe('constructor', () => {
        it('creates an instance with empty checksums and additional properties by default', () => {
            const ruleSet = new MetadataRuleset();

            expect(ruleSet.getRuleSetIds()).toEqual([]);
            expect(ruleSet.getChecksum('ruleset_1')).toBeUndefined();
            expect(ruleSet.getAdditionalProperty('any')).toBeUndefined();
            expect(ruleSet.hasAdditionalProperty('any')).toBe(false);
        });

        it('accepts initial checksums', () => {
            const ruleSet = new MetadataRuleset({
                ruleset_1: 'hash1',
                ruleset_2: 'hash2',
            });

            expect(ruleSet.getRuleSetIds()).toEqual(['ruleset_1', 'ruleset_2']);
            expect(ruleSet.getChecksum('ruleset_1')).toBe('hash1');
            expect(ruleSet.getChecksum('ruleset_2')).toBe('hash2');
        });

        it('accepts initial additional properties', () => {
            const ruleSet = new MetadataRuleset({}, {
                version: '1.0',
                metadata: { filters: 42 },
            });

            expect(ruleSet.getAdditionalProperty('version')).toBe('1.0');
            expect(ruleSet.getAdditionalProperty('metadata')).toEqual({ filters: 42 });
        });

        it('shallow-clones constructor inputs so mutations do not affect the instance', () => {
            const checksums: Record<string, string> = { ruleset_1: 'original' };
            const additional: Record<string, string> = { key: 'value' };

            const ruleSet = new MetadataRuleset(checksums, additional);

            // Mutate original inputs
            checksums.ruleset_1 = 'mutated';
            additional.key = 'mutated';
            checksums.ruleset_2 = 'added-later';
            additional.newKey = 'added-later';

            // Instance should be unaffected
            expect(ruleSet.getChecksum('ruleset_1')).toBe('original');
            expect(ruleSet.getChecksum('ruleset_2')).toBeUndefined();
            expect(ruleSet.getAdditionalProperty('key')).toBe('value');
            expect(ruleSet.getAdditionalProperty('newKey')).toBeUndefined();
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

        it('returns consistent id regardless of checksums or properties', () => {
            const ruleSet = new MetadataRuleset(
                { ruleset_1: 'abc', ruleset_2: 'def' },
                { version: '1.0' },
            );

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

        it('handles empty string checksum', () => {
            const ruleSet = new MetadataRuleset();

            ruleSet.setChecksum('ruleset_1', '');

            expect(ruleSet.getChecksum('ruleset_1')).toBe('');
        });

        it('handles MD5-like hex checksums', () => {
            const ruleSet = new MetadataRuleset();

            ruleSet.setChecksum('ruleset_1', 'd41d8cd98f00b204e9800998ecf8427e');

            expect(ruleSet.getChecksum('ruleset_1')).toBe('d41d8cd98f00b204e9800998ecf8427e');
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

        it('preserves insertion order', () => {
            const ruleSet = new MetadataRuleset();

            ruleSet.setChecksum('ruleset_3', 'c');
            ruleSet.setChecksum('ruleset_1', 'a');
            ruleSet.setChecksum('ruleset_2', 'b');

            expect(ruleSet.getRuleSetIds()).toEqual(['ruleset_3', 'ruleset_1', 'ruleset_2']);
        });

        it('returns a new array each call (not a reference to internal state)', () => {
            const ruleSet = new MetadataRuleset();
            ruleSet.setChecksum('ruleset_1', 'aaa');

            const ids = ruleSet.getRuleSetIds();
            ids.push('ruleset_injected');

            expect(ruleSet.getRuleSetIds()).toEqual(['ruleset_1']);
        });
    });

    describe('additional properties', () => {
        it('sets and gets an additional property', () => {
            const ruleSet = new MetadataRuleset();

            ruleSet.setAdditionalProperty('version', '1.0');

            expect(ruleSet.getAdditionalProperty('version')).toBe('1.0');
        });

        it('overwrites an existing additional property', () => {
            const ruleSet = new MetadataRuleset();

            ruleSet.setAdditionalProperty('version', '1.0');
            ruleSet.setAdditionalProperty('version', '2.0');

            expect(ruleSet.getAdditionalProperty('version')).toBe('2.0');
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

        it('hasAdditionalProperty returns false for inherited Object.prototype keys', () => {
            const ruleSet = new MetadataRuleset();

            // '__proto__', 'toString', 'hasOwnProperty' should not leak
            expect(ruleSet.hasAdditionalProperty('toString')).toBe(false);
            expect(ruleSet.hasAdditionalProperty('__proto__')).toBe(false);
            expect(ruleSet.hasAdditionalProperty('hasOwnProperty')).toBe(false);
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

        it('supports complex nested values', () => {
            const ruleSet = new MetadataRuleset();
            const nested = { a: [1, 2, 3], b: { c: true } };

            ruleSet.setAdditionalProperty('nested', nested);

            expect(ruleSet.getAdditionalProperty('nested')).toEqual(nested);
        });

        it('supports array values', () => {
            const ruleSet = new MetadataRuleset();

            ruleSet.setAdditionalProperty('list', [1, 'two', { three: true }]);

            expect(ruleSet.getAdditionalProperty('list')).toEqual([1, 'two', { three: true }]);
        });

        it('supports null and boolean values', () => {
            const ruleSet = new MetadataRuleset();

            ruleSet.setAdditionalProperty('nullVal', null);
            ruleSet.setAdditionalProperty('boolVal', true);
            ruleSet.setAdditionalProperty('numVal', 0);

            expect(ruleSet.getAdditionalProperty('nullVal')).toBeNull();
            expect(ruleSet.getAdditionalProperty('boolVal')).toBe(true);
            expect(ruleSet.getAdditionalProperty('numVal')).toBe(0);
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

        it('includes additional properties in serialized output', () => {
            const ruleSet = new MetadataRuleset();
            ruleSet.setAdditionalProperty('version', '2.5');
            ruleSet.setAdditionalProperty('metadata', { filterCount: 10 });

            const json = ruleSet.serialize();
            const parsed = JSON.parse(json);

            expect(parsed[0].metadata.additionalProperties).toEqual({
                version: '2.5',
                metadata: { filterCount: 10 },
            });
        });

        it('includes the dummy rule fields (id, action, condition)', () => {
            const ruleSet = new MetadataRuleset();
            const json = ruleSet.serialize();
            const parsed = JSON.parse(json);

            expect(parsed[0].id).toBe(1);
            expect(parsed[0].action).toEqual({ type: 'block' });
            expect(parsed[0].condition).toEqual({
                urlFilter: 'dummy.rule.adguard.com',
                resourceTypes: ['xmlhttprequest'],
            });
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

        it('round-trips complex nested additional properties', () => {
            const original = new MetadataRuleset({}, {
                metadata: {
                    filters: [
                        { filterId: 1, name: 'English Filter' },
                        { filterId: 2, name: 'Russian Filter' },
                    ],
                    groups: [1, 2, 3],
                },
                version: '4.0.0',
                versionTimestampMs: 1717545600000,
            });

            const json = original.serialize();
            const restored = MetadataRuleset.deserialize(json);

            expect(restored.getAdditionalProperty('version')).toBe('4.0.0');
            expect(restored.getAdditionalProperty('versionTimestampMs')).toBe(1717545600000);
            expect(restored.getAdditionalProperty('metadata')).toEqual({
                filters: [
                    { filterId: 1, name: 'English Filter' },
                    { filterId: 2, name: 'Russian Filter' },
                ],
                groups: [1, 2, 3],
            });
        });

        it('allows extra Chrome DNR top-level fields (loose object at rule level)', () => {
            const json = JSON.stringify([{
                id: 1,
                priority: 2,
                action: { type: 'block' },
                condition: {
                    urlFilter: 'dummy.rule.adguard.com',
                    resourceTypes: ['xmlhttprequest'],
                },
                metadata: {
                    checksums: { ruleset_1: 'abc' },
                    additionalProperties: {},
                },
            }]);

            const restored = MetadataRuleset.deserialize(json);

            expect(restored.getChecksum('ruleset_1')).toBe('abc');
        });

        it('throws on unknown top-level metadata key (strict object at metadata level)', () => {
            const json = JSON.stringify([{
                id: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: 'dummy.rule.adguard.com',
                    resourceTypes: ['xmlhttprequest'],
                },
                metadata: {
                    checksums: {},
                    additionalProperties: {},
                    byteRangeMapsCollection: {},
                },
            }]);

            expect(() => MetadataRuleset.deserialize(json)).toThrow();
        });

        it('throws on empty string input', () => {
            expect(() => MetadataRuleset.deserialize('')).toThrow();
        });

        it('throws on non-JSON input', () => {
            expect(() => MetadataRuleset.deserialize('not valid json')).toThrow();
        });

        it('throws on non-array JSON input', () => {
            expect(() => MetadataRuleset.deserialize('{"key":"value"}')).toThrow(
                'Invalid input: expected a single-element array.',
            );
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

        it('throws on array element without metadata field', () => {
            const json = JSON.stringify([{ id: 1, action: { type: 'block' } }]);

            expect(() => MetadataRuleset.deserialize(json)).toThrow();
        });

        it('throws on metadata.checksums with wrong value type', () => {
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

        it('throws on non-object metadata value', () => {
            const badJson = JSON.stringify([{
                id: 1,
                action: { type: 'block' },
                metadata: 'not-an-object',
            }]);

            expect(() => MetadataRuleset.deserialize(badJson)).toThrow();
        });

        it('throws when metadata key is missing entirely', () => {
            const json = JSON.stringify([{
                id: 1,
                action: { type: 'block' },
            }]);

            expect(() => MetadataRuleset.deserialize(json)).toThrow();
        });

        it('throws when checksums key is missing from metadata', () => {
            const json = JSON.stringify([{
                id: 1,
                action: { type: 'block' },
                metadata: {
                    additionalProperties: {},
                },
            }]);

            expect(() => MetadataRuleset.deserialize(json)).toThrow();
        });

        it('throws when additionalProperties key is missing from metadata', () => {
            const json = JSON.stringify([{
                id: 1,
                action: { type: 'block' },
                metadata: {
                    checksums: {},
                },
            }]);

            expect(() => MetadataRuleset.deserialize(json)).toThrow();
        });

        it('deserializes real-world metadata files (chromium-mv3)', () => {
            // Read a real checked-in ruleset_0.json from the test fixtures
            const fixturePath = path.resolve(
                __dirname,
                '../fixtures',
                'ruleset_0.json',
            );
            const rawJson = readFileSync(fixturePath, 'utf8');

            const ruleSet = MetadataRuleset.deserialize(rawJson);

            // Should have many checksums (one per ruleset)
            const ids = ruleSet.getRuleSetIds();
            expect(ids.length).toBeGreaterThan(0);

            // Every checksum should be a 32-char hex string
            for (const id of ids) {
                const checksum = ruleSet.getChecksum(id);
                expect(checksum).toMatch(/^[a-f0-9]{32}$/);
            }

            // Should have metadata, version, and versionTimestampMs in additional properties
            expect(ruleSet.hasAdditionalProperty('metadata')).toBe(true);
            expect(ruleSet.hasAdditionalProperty('version')).toBe(true);
            expect(ruleSet.hasAdditionalProperty('versionTimestampMs')).toBe(true);

            // Metadata should contain filter info
            const filtersMeta = ruleSet.getAdditionalProperty('metadata') as Record<string, unknown>;
            expect(filtersMeta).toBeDefined();
            expect(filtersMeta.filters).toBeDefined();
            expect(filtersMeta.groups).toBeDefined();
        });
    });

    describe('integration: update pattern from dnr-rulesets', () => {
        it('deserialize → update checksums → serialize produces valid output', () => {
            // Simulates the updateMetadataRuleset flow in dnr-rulesets
            // 1. Create initial ruleset
            const original = new MetadataRuleset(
                { ruleset_1: 'oldhash1', ruleset_2: 'oldhash2' },
                { version: '1.0', metadata: { filters: [] } },
            );
            const json = original.serialize();

            // 2. Deserialize
            const restored = MetadataRuleset.deserialize(json);

            // 3. Update checksums (keeping additional properties intact)
            restored.setChecksum('ruleset_1', 'newhash1');
            restored.setChecksum('ruleset_2', 'newhash2');

            // 4. Serialize back
            const updatedJson = restored.serialize();
            const reRestored = MetadataRuleset.deserialize(updatedJson);

            // Checksums should be updated
            expect(reRestored.getChecksum('ruleset_1')).toBe('newhash1');
            expect(reRestored.getChecksum('ruleset_2')).toBe('newhash2');

            // Additional properties should be preserved
            expect(reRestored.getAdditionalProperty('version')).toBe('1.0');
            expect(reRestored.getAdditionalProperty('metadata')).toEqual({ filters: [] });
        });

        it('additional properties survive round-trip through serialize/deserialize unchanged', () => {
            const original = new MetadataRuleset(
                { ruleset_1: 'hash1' },
                {
                    version: '5.0.0',
                    versionTimestampMs: 1700000000000,
                    metadata: {
                        filters: [
                            { filterId: 1, name: 'Filter A' },
                        ],
                    },
                },
            );

            const json = original.serialize();
            const restored = MetadataRuleset.deserialize(json);

            // All additional properties should be intact
            expect(restored.getAdditionalProperty('version')).toBe('5.0.0');
            expect(restored.getAdditionalProperty('versionTimestampMs')).toBe(1700000000000);

            const meta = restored.getAdditionalProperty('metadata') as Record<string, unknown>;
            expect(meta.filters).toEqual([{ filterId: 1, name: 'Filter A' }]);

            // Checksum should also survive
            expect(restored.getChecksum('ruleset_1')).toBe('hash1');
        });
    });
});
