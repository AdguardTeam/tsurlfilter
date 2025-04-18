import { describe, it, expect } from 'vitest';
import { ByteBuffer } from '../../src/utils/byte-buffer';
import { BinaryStringToUint32ListMap } from '../../src/utils/binary-string-to-uint32list-map';
import { fastHash } from '../../src';

describe('BinaryStringToUint32ListMap', () => {
    it('should handle an empty map', () => {
        const buffer = new ByteBuffer();
        const inputMap = new Map<string, number[]>();
        const offset = BinaryStringToUint32ListMap.create(inputMap, buffer);

        // Lookups on empty map should return undefined
        expect(BinaryStringToUint32ListMap.get('nonexistent', buffer, offset)).toBeUndefined();
    });

    it('should store and retrieve a single key-value pair', () => {
        const buffer = new ByteBuffer();
        const inputMap = new Map<string, number[]>();
        inputMap.set('hello', [42, 100]);

        const offset = BinaryStringToUint32ListMap.create(inputMap, buffer);
        const result = BinaryStringToUint32ListMap.get('hello', buffer, offset);

        expect(result).toEqual([42, 100]);

        // Check a non-existent key
        expect(BinaryStringToUint32ListMap.get('unknown', buffer, offset)).toBeUndefined();
    });

    it('should store and retrieve multiple distinct keys', () => {
        const buffer = new ByteBuffer();
        const inputMap = new Map<string, number[]>();

        inputMap.set('key1', [10, 20]);
        inputMap.set('key2', [30, 40]);
        inputMap.set('anotherKey', [999]);

        const offset = BinaryStringToUint32ListMap.create(inputMap, buffer);

        expect(BinaryStringToUint32ListMap.get('key1', buffer, offset)).toEqual([10, 20]);
        expect(BinaryStringToUint32ListMap.get('key2', buffer, offset)).toEqual([30, 40]);
        expect(BinaryStringToUint32ListMap.get('anotherKey', buffer, offset)).toEqual([999]);

        // Non-existing
        expect(BinaryStringToUint32ListMap.get('nope', buffer, offset)).toBeUndefined();
    });

    it('should handle multiple values for a single key', () => {
        const buffer = new ByteBuffer();
        const inputMap = new Map<string, number[]>();
        inputMap.set('myKey', [1, 2, 3, 4, 5]);

        const offset = BinaryStringToUint32ListMap.create(inputMap, buffer);

        const result = BinaryStringToUint32ListMap.get('myKey', buffer, offset);
        expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it('should handle unicode keys (UTF-16)', () => {
        const buffer = new ByteBuffer();
        const inputMap = new Map<string, number[]>();

        const key1 = 'こんにちは'; // Japanese
        const key2 = '你好'; // Chinese
        const key3 = '🙂 Emoji'; // Emoji + space + ASCII

        inputMap.set(key1, [1, 11, 111]);
        inputMap.set(key2, [2, 22, 222]);
        inputMap.set(key3, [3, 33, 333]);

        const offset = BinaryStringToUint32ListMap.create(inputMap, buffer);

        expect(BinaryStringToUint32ListMap.get(key1, buffer, offset)).toEqual([1, 11, 111]);
        expect(BinaryStringToUint32ListMap.get(key2, buffer, offset)).toEqual([2, 22, 222]);
        expect(BinaryStringToUint32ListMap.get(key3, buffer, offset)).toEqual([3, 33, 333]);

        // A similar but not identical string
        expect(BinaryStringToUint32ListMap.get('こんにちは!', buffer, offset)).toBeUndefined();
    });

    it('should handle hash collisions gracefully', () => {
        // This two values have the same hash, i.e. they are a collision
        const input1 = 'aaaF';
        const input2 = 'aafa';

        expect(fastHash(input1)).toEqual(fastHash(input2));

        const buffer = new ByteBuffer();
        const inputMap = new Map<string, number[]>();
        inputMap.set(input1, [100]);
        inputMap.set(input2, [200]);

        // Build
        const offset = BinaryStringToUint32ListMap.create(inputMap, buffer);

        // Verify we retrieve the correct values for both
        expect(BinaryStringToUint32ListMap.get(input1, buffer, offset)).toEqual([100]);
        expect(BinaryStringToUint32ListMap.get(input2, buffer, offset)).toEqual([200]);
    });
});
