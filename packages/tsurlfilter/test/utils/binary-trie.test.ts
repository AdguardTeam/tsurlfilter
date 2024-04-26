import { TrieNode } from '../../src/utils/trie';
import { BinaryTrie } from '../../src/utils/binary-trie';
import { ByteBuffer } from '../../src/utils/byte-buffer';
import { createRandomStringArray, getAverageValue, getRandomElement } from './helpers';

/**
 * Last benchmark result:
 *
 * Env: MacOS, i7, 16GB ram.
 * 10000 rounds.
 * ┌──────────────┬─────────────┬─────────────────┐
 * │ dataset size │   trie (ms) │ binary trie (ms)│
 * ├──────────────┼─────────────┼─────────────────┤
 * │ 100          │ 0.001761    │  0.003528       │
 * │ 1000         │ 0.001774    │  0.004162       │
 * │ 10000        │ 0.003436    │  0.006571       │
 * │ 100000       │ 0.008       │  0.012558       │
 * └──────────────┴─────────────┴─────────────────┘
 */
describe('Performance benchmark', () => {
    const ROUNDS = 10_000;

    const MIN_SIZE_EXPONENT = 2;
    const MAX_SIZE_EXPONENT = 5;

    it('should be fast', () => {
        const res: { [size: number]: { [structure: string]: number } } = {};

        for (let i = MIN_SIZE_EXPONENT; i <= MAX_SIZE_EXPONENT; i += 1) {
            const size = 10 ** i;
            const data = createRandomStringArray(size);

            const trie = new TrieNode(0);

            for (let j = 0; j < size; j += 1) {
                trie.add(data[j], j);
            }

            const buffer = new ByteBuffer();

            const binaryTriePosition = BinaryTrie.create(trie, buffer);

            const trieMeasurements: number[] = [];
            const binaryTrieMeasurements: number[] = [];

            for (let k = 0; k < ROUNDS; k += 1) {
                const word = getRandomElement(data);

                let start = performance.now();
                trie.traverseAll(word, word.length);
                trieMeasurements.push(performance.now() - start);

                start = performance.now();
                BinaryTrie.traverseAll(word, word.length, buffer, binaryTriePosition);
                binaryTrieMeasurements.push(performance.now() - start);
            }

            res[size] = {
                trie: getAverageValue(trieMeasurements),
                'binary trie': getAverageValue(binaryTrieMeasurements),
            };
        }

        // eslint-disable-next-line no-console
        console.table(res);

        expect(true).toBe(true);
    });
});
