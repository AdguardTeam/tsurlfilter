import { describe, expect, it } from 'vitest';

import { TrieNode } from '../../src/compatibility-tables/trie';

describe('TrieNode', () => {
    describe('insert and get', () => {
        it('should insert and retrieve data at a path', () => {
            const trie = new TrieNode<string>();

            trie.insert(['adg', 'os', 'windows'], 'Windows Data');
            const result = trie.get(['adg', 'os', 'windows']);

            expect(result).toBe('Windows Data');
        });

        it('should insert multiple paths without conflicts', () => {
            const trie = new TrieNode<string>();

            trie.insert(['adg', 'os', 'windows'], 'Windows');
            trie.insert(['adg', 'os', 'mac'], 'Mac');
            trie.insert(['adg', 'ext', 'chrome'], 'Chrome');

            expect(trie.get(['adg', 'os', 'windows'])).toBe('Windows');
            expect(trie.get(['adg', 'os', 'mac'])).toBe('Mac');
            expect(trie.get(['adg', 'ext', 'chrome'])).toBe('Chrome');
        });

        it('should handle empty path', () => {
            const trie = new TrieNode<string>();

            trie.insert([], 'Root Data');
            const result = trie.get([]);

            expect(result).toBe('Root Data');
        });

        it('should handle single segment path', () => {
            const trie = new TrieNode<number>();

            trie.insert(['root'], 42);
            expect(trie.get(['root'])).toBe(42);
        });

        it('should overwrite existing data at the same path', () => {
            const trie = new TrieNode<string>();

            trie.insert(['path'], 'original');
            trie.insert(['path'], 'updated');

            expect(trie.get(['path'])).toBe('updated');
        });

        it('should return undefined for non-existent path', () => {
            const trie = new TrieNode<string>();

            trie.insert(['adg', 'os'], 'data');

            expect(trie.get(['adg', 'os', 'windows'])).toBeUndefined();
            expect(trie.get(['ubo', 'ext'])).toBeUndefined();
            expect(trie.get(['nonexistent'])).toBeUndefined();
        });

        it('should handle deep paths', () => {
            const trie = new TrieNode<string>();

            const deepPath = ['level1', 'level2', 'level3', 'level4', 'level5'];
            trie.insert(deepPath, 'deep data');

            expect(trie.get(deepPath)).toBe('deep data');
        });

        it('should store different data types', () => {
            const numberTrie = new TrieNode<number>();
            numberTrie.insert(['num'], 123);
            expect(numberTrie.get(['num'])).toBe(123);

            const objectTrie = new TrieNode<{ id: number; name: string }>();
            const obj = { id: 1, name: 'test' };
            objectTrie.insert(['obj'], obj);
            expect(objectTrie.get(['obj'])).toBe(obj);

            const arrayTrie = new TrieNode<string[]>();
            const arr = ['a', 'b', 'c'];
            arrayTrie.insert(['arr'], arr);
            expect(arrayTrie.get(['arr'])).toBe(arr);
        });

        it('should allow data at intermediate nodes', () => {
            const trie = new TrieNode<string>();

            // Insert data at intermediate node
            trie.insert(['adg', 'os'], 'OS wildcard');
            // Insert data at deeper node
            trie.insert(['adg', 'os', 'windows'], 'Windows');

            expect(trie.get(['adg', 'os'])).toBe('OS wildcard');
            expect(trie.get(['adg', 'os', 'windows'])).toBe('Windows');
        });
    });

    describe('query', () => {
        it('should query all data under a prefix', () => {
            const trie = new TrieNode<string>();

            trie.insert(['adg', 'os', 'windows'], 'Windows');
            trie.insert(['adg', 'os', 'mac'], 'Mac');
            trie.insert(['adg', 'os', 'linux'], 'Linux');
            trie.insert(['adg', 'ext', 'chrome'], 'Chrome');

            const results = trie.query(['adg', 'os']);

            expect(results).toHaveLength(3);
            expect(results).toContain('Windows');
            expect(results).toContain('Mac');
            expect(results).toContain('Linux');
            expect(results).not.toContain('Chrome');
        });

        it('should include intermediate node data in query results', () => {
            const trie = new TrieNode<string>();

            trie.insert(['adg', 'os'], 'OS Any');
            trie.insert(['adg', 'os', 'windows'], 'Windows');
            trie.insert(['adg', 'os', 'mac'], 'Mac');

            const results = trie.query(['adg', 'os']);

            expect(results).toHaveLength(3);
            expect(results).toContain('OS Any');
            expect(results).toContain('Windows');
            expect(results).toContain('Mac');
        });

        it('should return empty array for non-existent prefix', () => {
            const trie = new TrieNode<string>();

            trie.insert(['adg', 'os', 'windows'], 'Windows');

            const results = trie.query(['ubo', 'ext']);

            expect(results).toHaveLength(0);
        });

        it('should query entire trie with empty path', () => {
            const trie = new TrieNode<string>();

            trie.insert(['adg', 'os', 'windows'], 'Windows');
            trie.insert(['ubo', 'ext', 'chrome'], 'Chrome');
            trie.insert(['abp', 'ext', 'firefox'], 'Firefox');

            const results = trie.query([]);

            expect(results).toHaveLength(3);
            expect(results).toContain('Windows');
            expect(results).toContain('Chrome');
            expect(results).toContain('Firefox');
        });

        it('should return single item when querying exact leaf path', () => {
            const trie = new TrieNode<string>();

            trie.insert(['adg', 'os', 'windows'], 'Windows');

            const results = trie.query(['adg', 'os', 'windows']);

            expect(results).toHaveLength(1);
            expect(results[0]).toBe('Windows');
        });

        it('should handle complex tree structure', () => {
            const trie = new TrieNode<string>();

            // Build a complex tree
            trie.insert(['adg', 'os', 'windows'], 'ADG OS Windows');
            trie.insert(['adg', 'os', 'mac'], 'ADG OS Mac');
            trie.insert(['adg', 'ext', 'chrome'], 'ADG Ext Chrome');
            trie.insert(['adg', 'ext', 'firefox'], 'ADG Ext Firefox');
            trie.insert(['ubo', 'ext', 'chrome'], 'UBO Ext Chrome');
            trie.insert(['ubo', 'ext', 'firefox'], 'UBO Ext Firefox');

            // Query at different levels
            const adgResults = trie.query(['adg']);
            expect(adgResults).toHaveLength(4);

            const adgOsResults = trie.query(['adg', 'os']);
            expect(adgOsResults).toHaveLength(2);

            const uboResults = trie.query(['ubo']);
            expect(uboResults).toHaveLength(2);
        });

        it('should use cache for repeated queries', () => {
            const trie = new TrieNode<string>();

            trie.insert(['adg', 'os', 'windows'], 'Windows');
            trie.insert(['adg', 'os', 'mac'], 'Mac');

            // First query - builds cache
            const results1 = trie.query(['adg', 'os']);
            // Second query - uses cache
            const results2 = trie.query(['adg', 'os']);

            // Results should be identical
            expect(results1).toEqual(results2);
            // Should be the same array instance (cache hit)
            expect(results1).toBe(results2);
        });

        it('should invalidate root cache after insert', () => {
            const trie = new TrieNode<string>();

            trie.insert(['adg', 'os', 'windows'], 'Windows');

            // Query from root
            const results1 = trie.query([]);
            expect(results1).toHaveLength(1);

            // Insert new data
            trie.insert(['ubo', 'ext', 'chrome'], 'Chrome');

            // Root query should reflect new data (root cache is invalidated)
            const results2 = trie.query([]);
            expect(results2).toHaveLength(2);
            expect(results2).toContain('Chrome');
        });
    });

    describe('has', () => {
        it('should return true when data exists at exact path', () => {
            const trie = new TrieNode<string>();

            trie.insert(['adg', 'os', 'windows'], 'Windows');

            expect(trie.has(['adg', 'os', 'windows'])).toBe(true);
        });

        it('should return true when data exists under prefix', () => {
            const trie = new TrieNode<string>();

            trie.insert(['adg', 'os', 'windows'], 'Windows');

            expect(trie.has(['adg'])).toBe(true);
            expect(trie.has(['adg', 'os'])).toBe(true);
        });

        it('should return false when no data exists', () => {
            const trie = new TrieNode<string>();

            trie.insert(['adg', 'os', 'windows'], 'Windows');

            expect(trie.has(['ubo'])).toBe(false);
            expect(trie.has(['adg', 'ext'])).toBe(false);
        });

        it('should return true for intermediate nodes with data', () => {
            const trie = new TrieNode<string>();

            trie.insert(['adg', 'os'], 'OS Any');
            trie.insert(['adg', 'os', 'windows'], 'Windows');

            expect(trie.has(['adg', 'os'])).toBe(true);
        });

        it('should return true for intermediate nodes even without direct data', () => {
            const trie = new TrieNode<string>();

            trie.insert(['adg', 'os', 'windows'], 'Windows');

            // 'adg' and ['adg', 'os'] have no direct data, but have children with data
            expect(trie.has(['adg'])).toBe(true);
            expect(trie.has(['adg', 'os'])).toBe(true);
        });

        it('should return false for empty trie', () => {
            const trie = new TrieNode<string>();

            expect(trie.has([])).toBe(false);
            expect(trie.has(['any'])).toBe(false);
        });

        it('should handle empty path on trie with root data', () => {
            const trie = new TrieNode<string>();

            trie.insert([], 'Root');
            expect(trie.has([])).toBe(true);
        });
    });

    describe('toJSON and fromJSON', () => {
        it('should serialize and deserialize a simple trie', () => {
            const trie = new TrieNode<string>();

            trie.insert(['adg', 'os', 'windows'], 'Windows');
            trie.insert(['adg', 'os', 'mac'], 'Mac');

            const json = trie.toJSON();
            const restored = TrieNode.fromJSON<string>(json);

            expect(restored.get(['adg', 'os', 'windows'])).toBe('Windows');
            expect(restored.get(['adg', 'os', 'mac'])).toBe('Mac');
        });

        it('should serialize empty trie', () => {
            const trie = new TrieNode<string>();

            const json = trie.toJSON();
            expect(json).toEqual({});

            const restored = TrieNode.fromJSON<string>(json);
            expect(restored.get(['any'])).toBeUndefined();
        });

        it('should serialize trie with root data', () => {
            const trie = new TrieNode<string>();

            trie.insert([], 'Root Data');

            const json = trie.toJSON();
            const restored = TrieNode.fromJSON<string>(json);

            expect(restored.get([])).toBe('Root Data');
        });

        it('should serialize trie with intermediate node data', () => {
            const trie = new TrieNode<string>();

            trie.insert(['adg'], 'Product Level');
            trie.insert(['adg', 'os'], 'Type Level');
            trie.insert(['adg', 'os', 'windows'], 'Specific Level');

            const json = trie.toJSON();
            const restored = TrieNode.fromJSON<string>(json);

            expect(restored.get(['adg'])).toBe('Product Level');
            expect(restored.get(['adg', 'os'])).toBe('Type Level');
            expect(restored.get(['adg', 'os', 'windows'])).toBe('Specific Level');
        });

        it('should preserve complex tree structure', () => {
            const trie = new TrieNode<number>();

            trie.insert(['a', 'b', 'c'], 1);
            trie.insert(['a', 'b', 'd'], 2);
            trie.insert(['a', 'e'], 3);
            trie.insert(['f'], 4);

            const json = trie.toJSON();
            const restored = TrieNode.fromJSON<number>(json);

            expect(restored.get(['a', 'b', 'c'])).toBe(1);
            expect(restored.get(['a', 'b', 'd'])).toBe(2);
            expect(restored.get(['a', 'e'])).toBe(3);
            expect(restored.get(['f'])).toBe(4);
        });

        it('should handle objects as data', () => {
            const trie = new TrieNode<{ name: string; value: number }>();

            const data1 = { name: 'first', value: 100 };
            const data2 = { name: 'second', value: 200 };

            trie.insert(['path1'], data1);
            trie.insert(['path2'], data2);

            const json = trie.toJSON();
            const restored = TrieNode.fromJSON<{ name: string; value: number }>(json);

            expect(restored.get(['path1'])).toEqual(data1);
            expect(restored.get(['path2'])).toEqual(data2);
        });

        it('should query work correctly on deserialized trie', () => {
            const trie = new TrieNode<string>();

            trie.insert(['adg', 'os', 'windows'], 'Windows');
            trie.insert(['adg', 'os', 'mac'], 'Mac');
            trie.insert(['adg', 'ext', 'chrome'], 'Chrome');

            const json = trie.toJSON();
            const restored = TrieNode.fromJSON<string>(json);

            const results = restored.query(['adg', 'os']);
            expect(results).toHaveLength(2);
            expect(results).toContain('Windows');
            expect(results).toContain('Mac');
        });

        it('should has work correctly on deserialized trie', () => {
            const trie = new TrieNode<string>();

            trie.insert(['adg', 'os', 'windows'], 'Windows');

            const json = trie.toJSON();
            const restored = TrieNode.fromJSON<string>(json);

            expect(restored.has(['adg'])).toBe(true);
            expect(restored.has(['adg', 'os'])).toBe(true);
            expect(restored.has(['ubo'])).toBe(false);
        });
    });

    describe('edge cases', () => {
        it('should handle large number of children at same level', () => {
            const trie = new TrieNode<string>();

            // Insert 100 siblings
            for (let i = 0; i < 100; i += 1) {
                trie.insert(['parent', `child${i}`], `data${i}`);
            }

            // Verify all can be retrieved
            for (let i = 0; i < 100; i += 1) {
                expect(trie.get(['parent', `child${i}`])).toBe(`data${i}`);
            }

            // Query should return all 100
            const results = trie.query(['parent']);
            expect(results).toHaveLength(100);
        });

        it('should handle very deep paths', () => {
            const trie = new TrieNode<string>();

            const depth = 50;
            const deepPath = Array.from({ length: depth }, (_, i) => `level${i}`);

            trie.insert(deepPath, 'deep value');

            expect(trie.get(deepPath)).toBe('deep value');
            expect(trie.has(deepPath)).toBe(true);
        });

        it('should handle overwrite with different type-compatible data', () => {
            const trie = new TrieNode<string | number>();

            trie.insert(['path'], 'string value');
            expect(trie.get(['path'])).toBe('string value');

            trie.insert(['path'], 42);
            expect(trie.get(['path'])).toBe(42);
        });

        it('should handle null and undefined as valid data', () => {
            const trie = new TrieNode<string | null | undefined>();

            trie.insert(['null-path'], null);
            trie.insert(['undefined-path'], undefined);

            expect(trie.get(['null-path'])).toBeNull();
            expect(trie.get(['undefined-path'])).toBeUndefined();
        });

        it('should maintain separate instances for different tries', () => {
            const trie1 = new TrieNode<string>();
            const trie2 = new TrieNode<string>();

            trie1.insert(['path'], 'trie1 data');
            trie2.insert(['path'], 'trie2 data');

            expect(trie1.get(['path'])).toBe('trie1 data');
            expect(trie2.get(['path'])).toBe('trie2 data');
        });

        it('should handle special characters in path segments', () => {
            const trie = new TrieNode<string>();

            trie.insert(['path', 'with spaces'], 'data1');
            trie.insert(['path', 'with-dashes'], 'data2');
            trie.insert(['path', 'with_underscores'], 'data3');
            trie.insert(['path', 'with.dots'], 'data4');

            expect(trie.get(['path', 'with spaces'])).toBe('data1');
            expect(trie.get(['path', 'with-dashes'])).toBe('data2');
            expect(trie.get(['path', 'with_underscores'])).toBe('data3');
            expect(trie.get(['path', 'with.dots'])).toBe('data4');
        });
    });
});
