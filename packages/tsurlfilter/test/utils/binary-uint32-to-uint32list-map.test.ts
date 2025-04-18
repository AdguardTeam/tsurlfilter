import { describe, it, expect } from 'vitest';
import { BinaryUint32ToUint32ListMap } from '../../src/utils/binary-uint32-to-uint32list-map';
import { ByteBuffer } from '../../src/utils/byte-buffer';

describe('BinaryUint32ToUint32ListMap', () => {
    it('should handle an empty map correctly', () => {
        const buffer = new ByteBuffer();
        const map = new Map<number, number[]>();

        const offset = BinaryUint32ToUint32ListMap.create(map, buffer);

        // No keys exist, so any lookup should return undefined
        expect(BinaryUint32ToUint32ListMap.get(0, buffer, offset)).toBeUndefined();
        expect(BinaryUint32ToUint32ListMap.get(123, buffer, offset)).toBeUndefined();
    });

    it('should store and retrieve a single key with multiple values', () => {
        const buffer = new ByteBuffer();
        const map = new Map<number, number[]>();

        map.set(42, [1, 2, 3]);

        const offset = BinaryUint32ToUint32ListMap.create(map, buffer);

        const result = BinaryUint32ToUint32ListMap.get(42, buffer, offset);
        expect(result).toEqual([1, 2, 3]);

        // Non-existing
        expect(BinaryUint32ToUint32ListMap.get(41, buffer, offset)).toBeUndefined();
    });

    it('should store and retrieve multiple keys', () => {
        const buffer = new ByteBuffer();
        const map = new Map<number, number[]>();

        map.set(10, [100]);
        map.set(20, [200, 201]);
        map.set(30, [300, 301, 302]);
        map.set(999, [909, 919]);

        const offset = BinaryUint32ToUint32ListMap.create(map, buffer);

        expect(BinaryUint32ToUint32ListMap.get(10, buffer, offset)).toEqual([100]);
        expect(BinaryUint32ToUint32ListMap.get(20, buffer, offset)).toEqual([200, 201]);
        expect(BinaryUint32ToUint32ListMap.get(30, buffer, offset)).toEqual([300, 301, 302]);
        expect(BinaryUint32ToUint32ListMap.get(999, buffer, offset)).toEqual([909, 919]);

        // Non-existing
        expect(BinaryUint32ToUint32ListMap.get(0, buffer, offset)).toBeUndefined();
        expect(BinaryUint32ToUint32ListMap.get(1000, buffer, offset)).toBeUndefined();
    });

    it('should handle a larger map with various values', () => {
        const buffer = new ByteBuffer();
        const map = new Map<number, number[]>();

        map.set(0, [0]);
        map.set(1, [10]);
        map.set(2, [20, 21, 22]);
        map.set(100, [1000, 1001]);
        map.set(9999, [9999, 10000, 12345]);

        const offset = BinaryUint32ToUint32ListMap.create(map, buffer);

        expect(BinaryUint32ToUint32ListMap.get(0, buffer, offset)).toEqual([0]);
        expect(BinaryUint32ToUint32ListMap.get(1, buffer, offset)).toEqual([10]);
        expect(BinaryUint32ToUint32ListMap.get(2, buffer, offset)).toEqual([20, 21, 22]);
        expect(BinaryUint32ToUint32ListMap.get(100, buffer, offset)).toEqual([1000, 1001]);
        expect(BinaryUint32ToUint32ListMap.get(9999, buffer, offset)).toEqual([9999, 10000, 12345]);

        // Non-existing
        expect(BinaryUint32ToUint32ListMap.get(1234, buffer, offset)).toBeUndefined();
    });
});
