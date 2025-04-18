/* eslint-disable @typescript-eslint/no-loop-func */
// pnpm vitest bench binary-map
import { bench, describe } from 'vitest';

import { ByteBuffer } from '../../src/utils/byte-buffer';
import { getRandomNumber, getRandomString } from './helpers';
import { BinaryStringToUint32ListMap } from '../../src/utils/binary-string-to-uint32list-map';
import { BinaryUint32ToUint32Map } from '../../src/utils/binary-uint32-to-uint32-map';

describe('uint32 to uint32 map', () => {
    // generate a map with random strings keys and uint32 arrays as values
    const map: Map<number, number> = new Map();

    for (let i = 0; i < 100; i += 1) {
        const key = getRandomNumber(2 ** 31);
        const value = getRandomNumber(2 ** 31);
        map.set(key, value);
    }

    // pick 10 random keys to test
    const keys = Array.from(map.keys()).sort(() => Math.random() - 0.5).slice(0, 10);

    // build binary map
    const buffer = new ByteBuffer();
    const offset = BinaryUint32ToUint32Map.create(map, buffer);

    bench('Binary uint32 to uint32 map', () => {
        for (const key of keys) {
            BinaryUint32ToUint32Map.get(key, buffer, offset);
        }
    });

    bench('Native map', () => {
        for (const key of keys) {
            map.get(key);
        }
    });
});

describe('string to uint32list map', () => {
    // generate a map with random strings keys and uint32 arrays as values
    const map: Map<string, number[]> = new Map();

    for (let i = 0; i < 100; i += 1) {
        const key = getRandomString(10);
        const values = new Array(getRandomNumber(5)).fill(getRandomNumber(2 ** 31));
        map.set(key, values);
    }

    // pick 10 random keys to test
    const keys = Array.from(map.keys()).sort(() => Math.random() - 0.5).slice(0, 10);

    // build binary map
    const buffer = new ByteBuffer();
    const offset = BinaryStringToUint32ListMap.create(map, buffer);

    bench('Binary string to uint32list map', () => {
        for (const key of keys) {
            BinaryStringToUint32ListMap.get(key, buffer, offset);
        }
    });

    bench('Native map', () => {
        for (const key of keys) {
            map.get(key);
        }
    });
});
