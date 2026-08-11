import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { Lazy } from '../../../src/utils/lazy';

describe('Lazy', () => {
    it('should not invoke the producer until get() is called', () => {
        const producer = vi.fn(() => 42);
        const lazy = new Lazy(producer);

        expect(producer).not.toHaveBeenCalled();
        expect(lazy.isLoaded()).toBe(false);
    });

    it('should invoke the producer exactly once and cache the value', () => {
        const producer = vi.fn(() => 42);
        const lazy = new Lazy(producer);

        expect(lazy.get()).toBe(42);
        expect(lazy.get()).toBe(42);
        expect(lazy.get()).toBe(42);

        expect(producer).toHaveBeenCalledTimes(1);
        expect(lazy.isLoaded()).toBe(true);
    });

    it('should cache falsy values (e.g. 0, null, undefined) without rebuilding', () => {
        let calls = 0;
        const producer = (): number => {
            calls += 1;
            return 0;
        };
        const lazy = new Lazy(producer);

        expect(lazy.get()).toBe(0);
        expect(lazy.get()).toBe(0);
        expect(calls).toBe(1);
        expect(lazy.isLoaded()).toBe(true);
    });

    it('should return the same cached object reference on repeated get()', () => {
        const obj = { a: 1 };
        const producer = vi.fn(() => obj);
        const lazy = new Lazy(producer);

        expect(lazy.get()).toBe(obj);
        expect(lazy.get()).toBe(obj);
        expect(producer).toHaveBeenCalledTimes(1);
    });
});
