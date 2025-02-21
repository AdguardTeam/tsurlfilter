import { describe, expect, it } from 'vitest';

import { deepFreeze } from '../../src/utils/deep-freeze';

// Sample interface for better type checking in tests
interface SampleObject {
    a: number;
    b: {
        c: number;
        d: {
            e: number;
        };
    };
    f: () => void;
    g: number[];
}

describe('deepFreeze', () => {
    it('should freeze a simple object', () => {
        const obj = { a: 1, b: 2 };
        const frozenObj = deepFreeze(obj);

        expect(Object.isFrozen(frozenObj)).toBe(true);
        expect(Object.isFrozen(frozenObj.a)).toBe(true);
        expect(Object.isFrozen(frozenObj.b)).toBe(true);
    });

    it('should freeze a nested object', () => {
        const nestedObj: SampleObject = {
            a: 1,
            b: {
                c: 2,
                d: {
                    e: 3,
                },
            },
            f: () => 1,
            g: [1, 2, 3],
        };
        const frozenObj = deepFreeze(nestedObj);

        expect(Object.isFrozen(frozenObj)).toBe(true);
        expect(Object.isFrozen(frozenObj.b)).toBe(true);
        expect(Object.isFrozen(frozenObj.b.d)).toBe(true);
    });

    it('should make the object immutable after freezing', () => {
        const obj = { a: 1, b: { c: 2 } };
        const frozenObj = deepFreeze(obj);

        expect(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (frozenObj as any).a = 10;
        }).toThrow(TypeError);

        expect(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (frozenObj.b as any).c = 20;
        }).toThrow(TypeError);
    });

    it('should handle functions within the object', () => {
        const obj = {
            a: 1,
            b: () => 1,
        };
        const frozenObj = deepFreeze(obj);

        expect(Object.isFrozen(frozenObj)).toBe(true);
        expect(Object.isFrozen(frozenObj.b)).toBe(true);
    });

    it('should freeze arrays within the object', () => {
        const obj = { a: [1, 2, 3] };
        const frozenObj = deepFreeze(obj);

        expect(Object.isFrozen(frozenObj)).toBe(true);
        expect(Object.isFrozen(frozenObj.a)).toBe(true);
    });
});
