import { describe, expect, it } from 'vitest';

import {
    isArray,
    isNonEmptyArray,
    isNull,
    isUndefined,
} from '../../src/utils/guards';

describe('Type Guards', () => {
    describe('isUndefined', () => {
        it('should return true when the value is undefined', () => {
            expect(isUndefined(undefined)).toBe(true);
        });

        it('should return false when the value is null', () => {
            expect(isUndefined(null)).toBe(false);
        });

        it('should return false for other values', () => {
            expect(isUndefined(0)).toBe(false);
            expect(isUndefined('')).toBe(false);
            expect(isUndefined(false)).toBe(false);
            expect(isUndefined({})).toBe(false);
            expect(isUndefined([])).toBe(false);
        });
    });

    describe('isNull', () => {
        it('should return true when the value is null', () => {
            expect(isNull(null)).toBe(true);
        });

        it('should return false when the value is undefined', () => {
            expect(isNull(undefined)).toBe(false);
        });

        it('should return false for other values', () => {
            expect(isNull(0)).toBe(false);
            expect(isNull('')).toBe(false);
            expect(isNull(false)).toBe(false);
            expect(isNull({})).toBe(false);
            expect(isNull([])).toBe(false);
        });
    });

    describe('isArray', () => {
        it('should return true for an empty array', () => {
            expect(isArray([])).toBe(true);
        });

        it('should return true for a non-empty array', () => {
            expect(isArray([1, 2, 3])).toBe(true);
            expect(isArray(['a', 'b', 'c'])).toBe(true);
        });

        it('should return false for non-array values', () => {
            expect(isArray(undefined)).toBe(false);
            expect(isArray(null)).toBe(false);
            expect(isArray(123)).toBe(false);
            expect(isArray('string')).toBe(false);
            expect(isArray({})).toBe(false);
            expect(isArray(() => {})).toBe(false);
        });
    });

    describe('isNonEmptyArray', () => {
        it('should return true for a non-empty array', () => {
            expect(isNonEmptyArray([1])).toBe(true);
            expect(isNonEmptyArray(['item'])).toBe(true);
            expect(isNonEmptyArray([{}, {}])).toBe(true);
        });

        it('should return false for an empty array', () => {
            expect(isNonEmptyArray([])).toBe(false);
        });

        it('should return false for non-array values', () => {
            expect(isNonEmptyArray(undefined)).toBe(false);
            expect(isNonEmptyArray(null)).toBe(false);
            expect(isNonEmptyArray(0)).toBe(false);
            expect(isNonEmptyArray('')).toBe(false);
            expect(isNonEmptyArray({})).toBe(false);
            expect(isNonEmptyArray(() => {})).toBe(false);
        });
    });
});
