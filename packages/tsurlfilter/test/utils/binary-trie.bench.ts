/* eslint-disable @typescript-eslint/no-loop-func */
// pnpm vitest bench binary-trie
import { bench, describe } from 'vitest';
// @ts-ignore
import doublearray from 'doublearray';

import { TrieNode } from '../../src/utils/trie';
import { BinaryTrie } from '../../src/utils/binary-trie';
import { BinaryTrie as BinaryTrieOld } from '../../src/utils/binary-trie.old';
import { BinaryDoubleArrayTrie } from '../../src/utils/binary-double-array-trie';
import { ByteBuffer } from '../../src/utils/byte-buffer';
import { createRandomStringArray, getRandomNumber, getRandomString } from './helpers';

const MIN_SIZE_EXPONENT = 2;
const MAX_SIZE_EXPONENT = 3;
const WORD_LENGTH_GROUPS = [1, 5, 30];

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

        bench(`Binary double-array trie build - 10^${i}`, () => {
            BinaryDoubleArrayTrie.create(trie, buffer);
        }, {
            setup,
        });

        bench(`doublearray.js build - 10^${i}`, () => {
            doublearray.builder().build(data.map((k, v) => ({ k, v })));
        });
    }
});

for (const lengthGroup of WORD_LENGTH_GROUPS) {
    describe(`Trie lookup - word length ${lengthGroup}`, () => {
        for (let i = MIN_SIZE_EXPONENT; i <= MAX_SIZE_EXPONENT; i += 1) {
            const size = 10 ** i;
            const data = createRandomStringArray(size);

            // insert a word with the correct length to the data array at a random index
            const randomIndex = getRandomNumber(size - 1);
            const word = getRandomString(lengthGroup, lengthGroup);

            data[randomIndex] = word;

            const trie = new TrieNode(0);
            for (let j = 0; j < size; j += 1) {
                trie.add(data[j], j);
            }

            bench(`Trie lookup - 10^${i}`, () => {
                trie.traverseAll(word, word.length);
            });

            const buffer = new ByteBuffer();

            let binaryTriePosition = -1;
            let binaryTrieOldPosition = -1;
            let binaryDoubleArrayPosition = -1;
            let doubleArrayTrie: any = null;

            bench(`Binary trie lookup - 10^${i}`, () => {
                BinaryTrie.traverseAll(word, word.length, buffer, binaryTriePosition);
            }, {
                setup: () => {
                    if (binaryTriePosition === -1) {
                        binaryTriePosition = BinaryTrie.create(trie, buffer);
                    }
                },
            });

            bench(`Binary trie (old) lookup - 10^${i}`, () => {
                BinaryTrieOld.traverseAll(word, word.length, buffer, binaryTrieOldPosition);
            }, {
                setup: () => {
                    if (binaryTrieOldPosition === -1) {
                        binaryTrieOldPosition = BinaryTrieOld.create(trie, buffer);
                    }
                },
            });

            bench(`Binary double-array trie lookup - 10^${i}`, () => {
                BinaryDoubleArrayTrie.traverseAll(word, word.length, buffer, binaryDoubleArrayPosition);
            }, {
                setup: () => {
                    if (binaryDoubleArrayPosition === -1) {
                        binaryDoubleArrayPosition = BinaryDoubleArrayTrie.create(trie, buffer);
                    }
                },
            });

            bench(`doublearray.js lookup - 10^${i}`, () => {
                doubleArrayTrie.lookup(word);
            }, {
                setup: () => {
                    if (doubleArrayTrie === null) {
                        doubleArrayTrie = doublearray.builder().build(data.map((k, v) => ({ k, v })));
                    }
                },
            });
        }
    });
}
