import { describe, it, expect } from 'vitest';
import { ByteBuffer } from '../../src/utils/byte-buffer';
import { BinaryStringMultiMap } from '../../src/utils/binary-string-multimap';
import { fastHash } from '../../src';

describe('BinaryStringMultiMap', () => {
    it('should handle an empty map', () => {
        const buffer = new ByteBuffer();
        const inputMap = new Map<string, number[]>();
        const offset = BinaryStringMultiMap.create(inputMap, buffer);

        // Lookups on empty map should return undefined
        expect(BinaryStringMultiMap.get('nonexistent', buffer, offset)).toBeUndefined();
    });

    it('should store and retrieve a single key-value pair', () => {
        const buffer = new ByteBuffer();
        const inputMap = new Map<string, number[]>();
        inputMap.set('hello', [42, 100]);

        const offset = BinaryStringMultiMap.create(inputMap, buffer);
        const result = BinaryStringMultiMap.get('hello', buffer, offset);

        expect(result).toEqual([42, 100]);

        // Check a non-existent key
        expect(BinaryStringMultiMap.get('unknown', buffer, offset)).toBeUndefined();
    });

    it('should store and retrieve multiple distinct keys', () => {
        const buffer = new ByteBuffer();
        const inputMap = new Map<string, number[]>();

        inputMap.set('key1', [10, 20]);
        inputMap.set('key2', [30, 40]);
        inputMap.set('anotherKey', [999]);

        const offset = BinaryStringMultiMap.create(inputMap, buffer);

        expect(BinaryStringMultiMap.get('key1', buffer, offset)).toEqual([10, 20]);
        expect(BinaryStringMultiMap.get('key2', buffer, offset)).toEqual([30, 40]);
        expect(BinaryStringMultiMap.get('anotherKey', buffer, offset)).toEqual([999]);

        // Non-existing
        expect(BinaryStringMultiMap.get('nope', buffer, offset)).toBeUndefined();
    });

    it('should handle multiple values for a single key', () => {
        const buffer = new ByteBuffer();
        const inputMap = new Map<string, number[]>();
        inputMap.set('myKey', [1, 2, 3, 4, 5]);

        const offset = BinaryStringMultiMap.create(inputMap, buffer);

        const result = BinaryStringMultiMap.get('myKey', buffer, offset);
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

        const offset = BinaryStringMultiMap.create(inputMap, buffer);

        expect(BinaryStringMultiMap.get(key1, buffer, offset)).toEqual([1, 11, 111]);
        expect(BinaryStringMultiMap.get(key2, buffer, offset)).toEqual([2, 22, 222]);
        expect(BinaryStringMultiMap.get(key3, buffer, offset)).toEqual([3, 33, 333]);

        // A similar but not identical string
        expect(BinaryStringMultiMap.get('こんにちは!', buffer, offset)).toBeUndefined();
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
        const offset = BinaryStringMultiMap.create(inputMap, buffer);

        // Verify we retrieve the correct values for both
        expect(BinaryStringMultiMap.get(input1, buffer, offset)).toEqual([100]);
        expect(BinaryStringMultiMap.get(input2, buffer, offset)).toEqual([200]);
    });
});
