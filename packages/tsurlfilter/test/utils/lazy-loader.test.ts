import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { LazyLoader } from '../../src/utils/lazy-loader';

describe('LazyLoader', () => {
    describe('Basic loading', () => {
        it('loads value on first get() call', async () => {
            const mockValue = { data: 'test' };
            const loader = vi.fn(async () => mockValue);
            const lazyLoader = new LazyLoader(loader);

            const result = await lazyLoader.get();

            expect(result).toBe(mockValue);
            expect(loader).toHaveBeenCalledTimes(1);
        });

        it('returns cached value on subsequent get() calls', async () => {
            const mockValue = { data: 'test' };
            const loader = vi.fn(async () => mockValue);
            const lazyLoader = new LazyLoader(loader);

            const result1 = await lazyLoader.get();
            const result2 = await lazyLoader.get();
            const result3 = await lazyLoader.get();

            expect(result1).toBe(mockValue);
            expect(result2).toBe(mockValue);
            expect(result3).toBe(mockValue);
            expect(loader).toHaveBeenCalledTimes(1);
        });

        it('reports correct isLoaded() state', async () => {
            const mockValue = { data: 'test' };
            const loader = vi.fn(async () => mockValue);
            const lazyLoader = new LazyLoader(loader);

            expect(lazyLoader.isLoaded()).toBe(false);

            await lazyLoader.get();

            expect(lazyLoader.isLoaded()).toBe(true);
        });
    });

    describe('Concurrent loading', () => {
        it('deduplicates concurrent get() calls', async () => {
            let resolveLoad: (value: { data: string }) => void;
            const loadPromise = new Promise<{ data: string }>((resolve) => {
                resolveLoad = resolve;
            });
            const loader = vi.fn(() => loadPromise);
            const lazyLoader = new LazyLoader(loader);

            // Start multiple concurrent get() calls
            const promise1 = lazyLoader.get();
            const promise2 = lazyLoader.get();
            const promise3 = lazyLoader.get();

            // Loader should only be called once
            expect(loader).toHaveBeenCalledTimes(1);

            // Resolve the load
            const mockValue = { data: 'test' };
            resolveLoad!(mockValue);

            // All promises should resolve to the same value
            const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);

            expect(result1).toBe(mockValue);
            expect(result2).toBe(mockValue);
            expect(result3).toBe(mockValue);
            expect(loader).toHaveBeenCalledTimes(1);
        });

        it('handles new get() calls after concurrent load completes', async () => {
            const mockValue = { data: 'test' };
            const loader = vi.fn(async () => mockValue);
            const lazyLoader = new LazyLoader(loader);

            // Concurrent calls
            const [result1, result2] = await Promise.all([
                lazyLoader.get(),
                lazyLoader.get(),
            ]);

            // New call after load completes
            const result3 = await lazyLoader.get();

            expect(result1).toBe(mockValue);
            expect(result2).toBe(mockValue);
            expect(result3).toBe(mockValue);
            expect(loader).toHaveBeenCalledTimes(1);
        });
    });

    describe('Unload functionality', () => {
        it('unloads value and resets state', async () => {
            const mockValue = { data: 'test' };
            const loader = vi.fn(async () => mockValue);
            const lazyLoader = new LazyLoader(loader);

            await lazyLoader.get();
            expect(lazyLoader.isLoaded()).toBe(true);

            lazyLoader.unload();

            expect(lazyLoader.isLoaded()).toBe(false);
        });

        it('allows reloading after unload', async () => {
            const mockValue1 = { data: 'first' };
            const mockValue2 = { data: 'second' };
            const loader = vi.fn()
                .mockResolvedValueOnce(mockValue1)
                .mockResolvedValueOnce(mockValue2);
            const lazyLoader = new LazyLoader(loader);

            // First load
            const result1 = await lazyLoader.get();
            expect(result1).toBe(mockValue1);
            expect(loader).toHaveBeenCalledTimes(1);

            // Unload
            lazyLoader.unload();
            expect(lazyLoader.isLoaded()).toBe(false);

            // Reload
            const result2 = await lazyLoader.get();
            expect(result2).toBe(mockValue2);
            expect(loader).toHaveBeenCalledTimes(2);
        });

        it('handles multiple load/unload cycles', async () => {
            const loader = vi.fn()
                .mockResolvedValueOnce({ cycle: 1 })
                .mockResolvedValueOnce({ cycle: 2 })
                .mockResolvedValueOnce({ cycle: 3 });
            const lazyLoader = new LazyLoader(loader);

            // Cycle 1
            const result1 = await lazyLoader.get();
            expect(result1).toEqual({ cycle: 1 });
            lazyLoader.unload();

            // Cycle 2
            const result2 = await lazyLoader.get();
            expect(result2).toEqual({ cycle: 2 });
            lazyLoader.unload();

            // Cycle 3
            const result3 = await lazyLoader.get();
            expect(result3).toEqual({ cycle: 3 });

            expect(loader).toHaveBeenCalledTimes(3);
        });

        it('is a no-op when nothing is loaded', () => {
            const loader = vi.fn(async () => ({ data: 'test' }));
            const lazyLoader = new LazyLoader(loader);

            // Unload without loading
            expect(() => lazyLoader.unload()).not.toThrow();
            expect(lazyLoader.isLoaded()).toBe(false);
            expect(loader).not.toHaveBeenCalled();
        });
    });

    describe('Unload during loading', () => {
        it('defers unload until loading completes', async () => {
            let resolveLoad!: (value: { data: string }) => void;
            const loadPromise = new Promise<{ data: string }>((resolve) => {
                resolveLoad = resolve;
            });
            const loader = vi.fn(() => loadPromise);
            const lazyLoader = new LazyLoader(loader);

            // Start loading
            const getPromise = lazyLoader.get();

            // Try to unload while loading is in progress
            lazyLoader.unload();

            // Loading should still be in progress
            expect(loader).toHaveBeenCalledTimes(1);

            // Resolve the load
            const mockValue = { data: 'test' };
            resolveLoad!(mockValue);

            // Wait for get to complete
            await getPromise;

            // Allow microtasks to process the deferred unload
            await new Promise((resolve) => { setImmediate(resolve); });

            // After load completes, unload should have been applied
            expect(lazyLoader.isLoaded()).toBe(false);
        });

        it('can reload after deferred unload', async () => {
            let resolveLoad!: (value: { data: string }) => void;
            const loadPromise = new Promise<{ data: string }>((resolve) => {
                resolveLoad = resolve;
            });
            const loader = vi.fn()
                .mockImplementationOnce(() => loadPromise)
                .mockResolvedValueOnce({ data: 'reloaded' });
            const lazyLoader = new LazyLoader(loader);

            // Start loading
            const getPromise = lazyLoader.get();

            // Unload while loading
            lazyLoader.unload();

            // Resolve the load
            resolveLoad!({ data: 'first' });
            await getPromise;

            // Allow deferred unload to complete
            await new Promise((resolve) => { setImmediate(resolve); });

            // Reload
            const result = await lazyLoader.get();
            expect(result).toEqual({ data: 'reloaded' });
            expect(loader).toHaveBeenCalledTimes(2);
        });
    });

    describe('onUnload callback', () => {
        it('invokes onUnload callback with current value', async () => {
            const mockValue = { data: 'test', nested: { items: [1, 2, 3] } };
            const loader = vi.fn(async () => mockValue);
            const onUnload = vi.fn();
            const lazyLoader = new LazyLoader(loader);

            await lazyLoader.get();
            lazyLoader.unload(onUnload);

            expect(onUnload).toHaveBeenCalledTimes(1);
            expect(onUnload).toHaveBeenCalledWith(mockValue);
        });

        it('does not invoke onUnload if nothing is loaded', () => {
            const loader = vi.fn(async () => ({ data: 'test' }));
            const onUnload = vi.fn();
            const lazyLoader = new LazyLoader(loader);

            lazyLoader.unload(onUnload);

            expect(onUnload).not.toHaveBeenCalled();
        });

        it('can use onUnload for cascading cleanup', async () => {
            interface Resource {
                id: string;
                cleanup: () => void;
            }

            const mockResource: Resource = {
                id: 'test-resource',
                cleanup: vi.fn(),
            };

            const loader = vi.fn(async () => mockResource);
            const lazyLoader = new LazyLoader(loader);

            await lazyLoader.get();
            lazyLoader.unload((resource) => {
                resource.cleanup();
            });

            expect(mockResource.cleanup).toHaveBeenCalledTimes(1);
        });

        it('invokes onUnload before clearing the value', async () => {
            const mockValue = { data: 'test' };
            const loader = vi.fn(async () => mockValue);
            const lazyLoader = new LazyLoader(loader);

            await lazyLoader.get();

            let capturedValue: typeof mockValue | undefined;
            lazyLoader.unload((value) => {
                capturedValue = value;
                // Value should still be accessible in the callback
                expect(lazyLoader.isLoaded()).toBe(true);
            });

            expect(capturedValue).toBe(mockValue);
            // After callback, value should be cleared
            expect(lazyLoader.isLoaded()).toBe(false);
        });
    });

    describe('Error handling', () => {
        it('propagates loader errors', async () => {
            const error = new Error('Load failed');
            const loader = vi.fn(async () => {
                throw error;
            });
            const lazyLoader = new LazyLoader(loader);

            await expect(lazyLoader.get()).rejects.toThrow('Load failed');
            expect(loader).toHaveBeenCalledTimes(1);
        });

        it('retries loading after error', async () => {
            const error = new Error('First load failed');
            const mockValue = { data: 'success' };
            const loader = vi.fn()
                .mockRejectedValueOnce(error)
                .mockResolvedValueOnce(mockValue);
            const lazyLoader = new LazyLoader(loader);

            // First call fails
            await expect(lazyLoader.get()).rejects.toThrow('First load failed');
            expect(lazyLoader.isLoaded()).toBe(false);

            // Second call succeeds
            const result = await lazyLoader.get();
            expect(result).toBe(mockValue);
            expect(lazyLoader.isLoaded()).toBe(true);
            expect(loader).toHaveBeenCalledTimes(2);
        });

        it('handles concurrent calls when loader fails', async () => {
            const error = new Error('Load failed');
            const loader = vi.fn(async () => {
                throw error;
            });
            const lazyLoader = new LazyLoader(loader);

            const promise1 = lazyLoader.get();
            const promise2 = lazyLoader.get();
            const promise3 = lazyLoader.get();

            await expect(promise1).rejects.toThrow('Load failed');
            await expect(promise2).rejects.toThrow('Load failed');
            await expect(promise3).rejects.toThrow('Load failed');

            expect(loader).toHaveBeenCalledTimes(1);
            expect(lazyLoader.isLoaded()).toBe(false);
        });
    });

    describe('Type safety', () => {
        it('preserves type information for loaded values', async () => {
            interface TestData {
                id: number;
                name: string;
                tags: string[];
            }

            const mockValue: TestData = {
                id: 1,
                name: 'test',
                tags: ['a', 'b', 'c'],
            };

            const loader = async (): Promise<TestData> => mockValue;
            const lazyLoader = new LazyLoader(loader);

            const result = await lazyLoader.get();

            // TypeScript should infer the correct type
            expect(result.id).toBe(1);
            expect(result.name).toBe('test');
            expect(result.tags).toEqual(['a', 'b', 'c']);
        });
    });

    describe('Edge cases', () => {
        it('handles loader returning undefined', async () => {
            const loader = vi.fn(async () => undefined);
            const lazyLoader = new LazyLoader<undefined>(loader);

            const result = await lazyLoader.get();

            expect(result).toBeUndefined();
            expect(lazyLoader.isLoaded()).toBe(true);
        });

        it('handles loader returning null', async () => {
            const loader = vi.fn(async () => null);
            const lazyLoader = new LazyLoader<null>(loader);

            const result = await lazyLoader.get();

            expect(result).toBeNull();
            expect(lazyLoader.isLoaded()).toBe(true);
        });

        it('handles rapid load/unload cycles', async () => {
            const loader = vi.fn()
                .mockResolvedValue({ data: 'value1' })
                .mockResolvedValue({ data: 'value2' })
                .mockResolvedValue({ data: 'value3' })
                .mockResolvedValue({ data: 'value4' })
                .mockResolvedValue({ data: 'value5' });
            const lazyLoader = new LazyLoader(loader);

            // eslint-disable-next-line no-plusplus
            for (let i = 0; i < 5; i += 1) {
                // eslint-disable-next-line no-await-in-loop
                await lazyLoader.get();
                expect(lazyLoader.isLoaded()).toBe(true);
                lazyLoader.unload();
                expect(lazyLoader.isLoaded()).toBe(false);
            }

            expect(loader).toHaveBeenCalledTimes(5);
        });

        it('handles onUnload callback throwing error', async () => {
            const mockValue = { data: 'test' };
            const loader = vi.fn(async () => mockValue);
            const onUnload = vi.fn(() => {
                throw new Error('Cleanup failed');
            });
            const lazyLoader = new LazyLoader(loader);

            await lazyLoader.get();

            // Should not throw, but log or handle error gracefully
            // (current implementation lets it throw, which is acceptable)
            expect(() => lazyLoader.unload(onUnload)).toThrow('Cleanup failed');
        });
    });
});
