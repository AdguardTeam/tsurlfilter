import { describe, it, expect } from 'vitest';
import { BinaryMultiMap } from '../../src/utils/binary-multimap';
import { ByteBuffer } from '../../src/utils/byte-buffer';

describe('BinaryMultiMap', () => {
    it('should handle an empty map correctly', () => {
        const buffer = new ByteBuffer();
        const map = new Map<number, number[]>();

        const offset = BinaryMultiMap.create(map, buffer);

        // No keys exist, so any lookup should return undefined
        expect(BinaryMultiMap.get(0, buffer, offset)).toBeUndefined();
        expect(BinaryMultiMap.get(123, buffer, offset)).toBeUndefined();
    });

    it('should store and retrieve a single key with multiple values', () => {
        const buffer = new ByteBuffer();
        const map = new Map<number, number[]>();

        map.set(42, [1, 2, 3]);

        const offset = BinaryMultiMap.create(map, buffer);

        const result = BinaryMultiMap.get(42, buffer, offset);
        expect(result).toEqual([1, 2, 3]);

        // Non-existing
        expect(BinaryMultiMap.get(41, buffer, offset)).toBeUndefined();
    });

    it('should store and retrieve multiple keys', () => {
        const buffer = new ByteBuffer();
        const map = new Map<number, number[]>();

        map.set(10, [100]);
        map.set(20, [200, 201]);
        map.set(30, [300, 301, 302]);
        map.set(999, [909, 919]);

        const offset = BinaryMultiMap.create(map, buffer);

        expect(BinaryMultiMap.get(10, buffer, offset)).toEqual([100]);
        expect(BinaryMultiMap.get(20, buffer, offset)).toEqual([200, 201]);
        expect(BinaryMultiMap.get(30, buffer, offset)).toEqual([300, 301, 302]);
        expect(BinaryMultiMap.get(999, buffer, offset)).toEqual([909, 919]);

        // Non-existing
        expect(BinaryMultiMap.get(0, buffer, offset)).toBeUndefined();
        expect(BinaryMultiMap.get(1000, buffer, offset)).toBeUndefined();
    });

    it('should handle a larger map with various values', () => {
        const buffer = new ByteBuffer();
        const map = new Map<number, number[]>();

        map.set(0, [0]);
        map.set(1, [10]);
        map.set(2, [20, 21, 22]);
        map.set(100, [1000, 1001]);
        map.set(9999, [9999, 10000, 12345]);

        const offset = BinaryMultiMap.create(map, buffer);

        expect(BinaryMultiMap.get(0, buffer, offset)).toEqual([0]);
        expect(BinaryMultiMap.get(1, buffer, offset)).toEqual([10]);
        expect(BinaryMultiMap.get(2, buffer, offset)).toEqual([20, 21, 22]);
        expect(BinaryMultiMap.get(100, buffer, offset)).toEqual([1000, 1001]);
        expect(BinaryMultiMap.get(9999, buffer, offset)).toEqual([9999, 10000, 12345]);

        // Non-existing
        expect(BinaryMultiMap.get(1234, buffer, offset)).toBeUndefined();
    });
});
