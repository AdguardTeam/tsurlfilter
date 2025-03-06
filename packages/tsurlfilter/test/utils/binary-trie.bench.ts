// pnpm vitest bench binary-trie
import { bench, describe } from 'vitest';
import { TrieNode } from '../../src/utils/trie';
import { BinaryTrie } from '../../src/utils/binary-trie';
import { BinaryTrie as BinaryTrieOld } from '../../src/utils/binary-trie.old';
import { ByteBuffer } from '../../src/utils/byte-buffer';
import { createRandomStringArray, getRandomElement } from './helpers';

const MIN_SIZE_EXPONENT = 2;
const MAX_SIZE_EXPONENT = 5;

describe('Trie build', () => {
    for (let i = MIN_SIZE_EXPONENT; i <= MAX_SIZE_EXPONENT; i += 1) {
        const size = 10 ** i;
        const data = createRandomStringArray(size);

        bench(`Trie build - 10^${i}`, () => {
            const trie = new TrieNode(0);
            for (let j = 0; j < size; j += 1) {
                trie.add(data[j], j);
            }
        });

        const trie = new TrieNode(0);
        for (let j = 0; j < size; j += 1) {
            trie.add(data[j], j);
        }

        let buffer: ByteBuffer;

        const setup = () => {
            buffer = new ByteBuffer();
        };

        bench(`Binary trie build - 10^${i}`, () => {
            BinaryTrie.create(trie, buffer);
        }, {
            setup,
        });

        bench(`Binary trie (old) build - 10^${i}`, () => {
            BinaryTrieOld.create(trie, buffer);
        }, {
            setup,
        });
    }
});

describe('Trie lookup', () => {
    for (let i = MIN_SIZE_EXPONENT; i <= MAX_SIZE_EXPONENT; i += 1) {
        const size = 10 ** i;
        const data = createRandomStringArray(size);

        const trie = new TrieNode(0);
        for (let j = 0; j < size; j += 1) {
            trie.add(data[j], j);
        }

        let word: string;

        const setup = () => {
            word = getRandomElement(data);
        };

        bench(`Trie lookup - 10^${i}`, () => {
            trie.traverseAll(word, word.length);
        }, {
            setup,
        });

        const buffer = new ByteBuffer();
        const binaryTriePosition = BinaryTrie.create(trie, buffer);

        bench(`Binary trie lookup - 10^${i}`, () => {
            BinaryTrie.traverseAll(word, word.length, buffer, binaryTriePosition);
        }, {
            setup,
        });

        bench(`Binary trie (old) lookup - 10^${i}`, () => {
            BinaryTrieOld.traverseAll(word, word.length, buffer, binaryTriePosition);
        }, {
            setup,
        });
    }
});
