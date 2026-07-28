import { describe, expect, it } from 'vitest';

import { UnavailableFilterSourceError } from '../../../src/errors/unavailable-sources-errors';
import { Filter } from '../../../src/filter/filter';

describe('Filter', () => {
    describe('getId()', () => {
        it('returns the filter id passed to the constructor (lazy)', () => {
            const filter = new Filter(42, async () => 'content');
            expect(filter.getId()).toBe(42);
        });

        it('returns the filter id passed to the constructor (pre-loaded)', () => {
            const filter = new Filter(2, '||example.org^');
            expect(filter.getId()).toBe(2);
        });
    });

    describe('getContent()', () => {
        it('loads and returns content from the source (lazy)', async () => {
            const filter = new Filter(1, async () => '||example.com^');
            expect(await filter.getContent()).toBe('||example.com^');
        });

        it('returns pre-loaded content immediately', async () => {
            const filter = new Filter(2, '||example.org^');
            expect(await filter.getContent()).toBe('||example.org^');
        });

        it('returns empty string content without throwing (lazy)', async () => {
            const filter = new Filter(1, async () => '');
            expect(await filter.getContent()).toBe('');
        });

        it('returns empty string content without throwing (pre-loaded)', async () => {
            const filter = new Filter(2, '');
            expect(await filter.getContent()).toBe('');
        });

        it('caches content so the source is called only once', async () => {
            let callCount = 0;
            const filter = new Filter(1, async () => {
                callCount += 1;
                return 'content';
            });
            await filter.getContent();
            await filter.getContent();
            expect(callCount).toBe(1);
        });

        it('deduplicates concurrent calls — source is called exactly once', async () => {
            let callCount = 0;
            const filter = new Filter(1, async () => {
                callCount += 1;
                return 'content';
            });
            const [r1, r2] = await Promise.all([
                filter.getContent(),
                filter.getContent(),
            ]);
            expect(r1).toBe('content');
            expect(r2).toBe('content');
            expect(callCount).toBe(1);
        });

        it('throws UnavailableFilterSourceError when source rejects', async () => {
            const cause = new Error('network failure');
            const filter = new Filter(7, async () => { throw cause; });
            await expect(filter.getContent()).rejects.toThrow(UnavailableFilterSourceError);
        });

        it('UnavailableFilterSourceError carries the correct filterId', async () => {
            const filter = new Filter(7, async () => { throw new Error('fail'); });
            const err = await filter.getContent().catch((e) => e);
            expect(err).toBeInstanceOf(UnavailableFilterSourceError);
            expect(err.filterId).toBe(7);
        });

        it('allows retry after the source rejects', async () => {
            let callCount = 0;
            const filter = new Filter(1, async () => {
                callCount += 1;
                if (callCount === 1) { throw new Error('transient error'); }
                return 'content';
            });
            await expect(filter.getContent()).rejects.toThrow(UnavailableFilterSourceError);
            expect(await filter.getContent()).toBe('content');
            expect(callCount).toBe(2);
        });
    });

    describe('unloadContent()', () => {
        it('is a no-op for pre-loaded filters', async () => {
            const filter = new Filter(1, 'content');
            expect(() => filter.unloadContent()).not.toThrow();
            // Content remains accessible after no-op unload
            expect(await filter.getContent()).toBe('content');
        });

        it('is a no-op when nothing is loaded (lazy)', () => {
            const filter = new Filter(1, async () => 'content');
            expect(() => filter.unloadContent()).not.toThrow();
        });

        it('allows reloading content after unload', async () => {
            let callCount = 0;
            const filter = new Filter(1, async () => {
                callCount += 1;
                return 'content';
            });
            await filter.getContent();
            expect(callCount).toBe(1);
            filter.unloadContent();
            await filter.getContent();
            expect(callCount).toBe(2);
        });

        it('schedules unload after an in-progress load settles', async () => {
            let resolveLoad!: (s: string) => void;
            let callCount = 0;

            const filter = new Filter(1, () => {
                callCount += 1;
                if (callCount === 1) {
                    return new Promise<string>((r) => { resolveLoad = r; });
                }
                return Promise.resolve('second');
            });

            // Start first load, then immediately request unload
            const firstLoadPromise = filter.getContent();
            filter.unloadContent();

            // Settle the first load
            resolveLoad('first');
            expect(await firstLoadPromise).toBe('first');

            // Yield to let the .finally() microtask (deferred unload) run
            await Promise.resolve();

            // Content should be unloaded; getContent() must call source again
            const secondResult = await filter.getContent();
            expect(secondResult).toBe('second');
            expect(callCount).toBe(2);
        });
    });

    describe('getRuleByIndex()', () => {
        it('returns the first line at character offset 0', async () => {
            const filter = new Filter(1, async () => '||a.com^\n||b.com^');
            expect(await filter.getRuleByIndex(0)).toBe('||a.com^');
        });

        it('returns the second line at its correct character offset', async () => {
            // '||a.com^' = 8 chars, '\n' at offset 8, '||b.com^' starts at offset 9.
            const filter = new Filter(1, async () => '||a.com^\n||b.com^');
            expect(await filter.getRuleByIndex(9)).toBe('||b.com^');
        });

        it('throws for an out-of-range offset', async () => {
            const filter = new Filter(1, async () => '||a.com^');
            await expect(filter.getRuleByIndex(9999)).rejects.toThrow('Rule not found at offset 9999 in filter 1');
        });

        it('throws for a mid-line (non-start) offset', async () => {
            const filter = new Filter(1, async () => '||a.com^');
            await expect(filter.getRuleByIndex(5)).rejects.toThrow('Rule not found at offset 5 in filter 1');
        });

        it('works on pre-loaded content', async () => {
            const filter = new Filter(1, '||a.com^\n||b.com^');
            expect(await filter.getRuleByIndex(0)).toBe('||a.com^');
            expect(await filter.getRuleByIndex(9)).toBe('||b.com^');
        });

        it('strips trailing \\r from \\r\\n line endings', async () => {
            const filter = new Filter(1, async () => '||a.com^\r\n||b.com^');
            expect(await filter.getRuleByIndex(0)).toBe('||a.com^');
        });

        it('returns the second line at correct offset with \\r\\n endings', async () => {
            // '||a.com^' = 8 chars, '\r\n' at offsets 8-9, '||b.com^' starts at offset 10.
            const filter = new Filter(1, async () => '||a.com^\r\n||b.com^');
            expect(await filter.getRuleByIndex(10)).toBe('||b.com^');
        });

        it('handles mixed \\r\\n and \\n line endings', async () => {
            const filter = new Filter(1, async () => '||a.com^\r\n||b.com^\n||c.com^');
            expect(await filter.getRuleByIndex(0)).toBe('||a.com^');
            // '||a.com^'=8 + '\r\n'=2 → next starts at 10
            expect(await filter.getRuleByIndex(10)).toBe('||b.com^');
            // '||b.com^'=8 + '\n'=1 → next starts at 19
            expect(await filter.getRuleByIndex(19)).toBe('||c.com^');
        });

        it('does not strip standalone \\r not followed by \\n', async () => {
            // Standalone \r (not part of \r\n) should remain in the rule text.
            const filter = new Filter(1, async () => '||a.com^\r\nrule with \r standalone');
            expect(await filter.getRuleByIndex(0)).toBe('||a.com^');
            // offset: 8 for first line + 2 for \r\n = 10
            expect(await filter.getRuleByIndex(10)).toBe('rule with \r standalone');
        });
    });
});
