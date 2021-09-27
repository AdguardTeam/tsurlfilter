import { TrieNode } from '../../src/utils/trie';

describe('Trie tests', () => {
    it('checks simple logic', () => {
        const trie = new TrieNode(0);

        expect(trie.traverse('test', 0)).toHaveLength(0);

        trie.add('test-1', 0);
        expect(trie.traverse('test-1', 0)).toHaveLength(1);
        expect(trie.traverse('test-1', 0)).toContain(0);
        expect(trie.traverse('another', 0)).toHaveLength(0);

        trie.add('test-2', 1);
        expect(trie.traverse('test-1', 0)).toHaveLength(1);
        expect(trie.traverse('test-1', 0)).toContain(0);
        expect(trie.traverse('test-2', 0)).toHaveLength(1);
        expect(trie.traverse('test-2', 0)).toContain(1);
        expect(trie.traverse('another', 0)).toHaveLength(0);

        trie.add('test-1-1', 11);
        const numbers = trie.traverse('test-1-1', 0);
        expect(numbers).toHaveLength(2);
        expect(numbers).toContain(0);
        expect(numbers).toContain(11);

        expect(trie.traverse('another', 0)).toHaveLength(0);
    });

    it('check traverse all logic', () => {
        const trie = new TrieNode(0);

        expect(trie.traverseAll('test', 0)).toHaveLength(0);
        expect(trie.traverseAll('test', 1)).toHaveLength(0);

        trie.add('test-1', 0);
        expect(trie.traverseAll('test-1', 0)).toStrictEqual([0]);
        expect(trie.traverseAll('test-1', 1)).toStrictEqual([0]);
        expect(trie.traverseAll('test-1', 2)).toStrictEqual([0]);
        expect(trie.traverseAll('test-1', 10)).toStrictEqual([0]);

        trie.add('test-2', 1);
        expect(trie.traverseAll('test-1', 0)).toStrictEqual([0]);
        expect(trie.traverseAll('test-1', 1)).toStrictEqual([0]);
        expect(trie.traverseAll('test-1', 2)).toStrictEqual([0]);
        expect(trie.traverseAll('test-1', 10)).toStrictEqual([0]);
        expect(trie.traverseAll('test-2', 0)).toStrictEqual([1]);
        expect(trie.traverseAll('test-2', 1)).toStrictEqual([1]);
        expect(trie.traverseAll('test-2', 2)).toStrictEqual([1]);
        expect(trie.traverseAll('test-2', 10)).toStrictEqual([1]);

        trie.add('test-1-1', 11);
        expect(trie.traverseAll('test-1-1', 0)).toStrictEqual([0, 11]);
        expect(trie.traverseAll('test-1-1', 1)).toStrictEqual([0, 11]);
        expect(trie.traverseAll('test-1-1', 2)).toStrictEqual([0, 11]);
        expect(trie.traverseAll('test-1-1', 10)).toStrictEqual([0, 11]);

        expect(trie.traverseAll('another', 0)).toHaveLength(0);
        expect(trie.traverseAll('another', 10)).toHaveLength(0);
    });
});
