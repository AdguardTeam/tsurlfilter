import { describe, expect, test } from 'vitest';

import { growInt32, growUint32, growUint8 } from '../src/buffer-growth';

describe('buffer-growth', () => {
    test('growUint8 returns a same-typed array of the new length with prefix copied', () => {
        const src = new Uint8Array([1, 2, 3]);
        const out = growUint8(src, 6);
        expect(out).toBeInstanceOf(Uint8Array);
        expect(out.length).toBe(6);
        expect(Array.from(out.subarray(0, 3))).toEqual([1, 2, 3]);
        expect(out[3]).toBe(0);
    });

    test('growUint32 copies the prefix', () => {
        const src = new Uint32Array([10, 20, 30]);
        const out = growUint32(src, 5);
        expect(out.length).toBe(5);
        expect(out[0]).toBe(10);
        expect(out[2]).toBe(30);
    });

    test('growInt32 supports shrinking too (truncates the tail)', () => {
        const src = new Int32Array([1, 2, 3, 4, 5]);
        const out = growInt32(src, 2);
        expect(out.length).toBe(2);
        expect(out[0]).toBe(1);
        expect(out[1]).toBe(2);
    });

    test('growUint8 with newLength === current length returns a same-length array', () => {
        const src = new Uint8Array([7, 8, 9]);
        const out = growUint8(src, 3);
        expect(out.length).toBe(3);
        expect(Array.from(out)).toEqual([7, 8, 9]);
    });
});
