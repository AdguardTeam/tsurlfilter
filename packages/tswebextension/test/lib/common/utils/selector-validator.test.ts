import {
    describe,
    it,
    expect,
    beforeEach,
    vi,
} from 'vitest';

import { validateSelectors } from '../../../../src/lib/common/utils/selector-validator';

/**
 * Helper that sets up the global CSS.supports mock.
 *
 * @param validSelectors Set of selectors that should be considered valid.
 */
function mockCssSupports(validSelectors: Set<string>): void {
    global.CSS = {
        supports: vi.fn((condition: string) => {
            // Extract selector from selector(...) syntax
            const match = condition.match(/^selector\((.+)\)$/);
            if (!match) {
                return false;
            }

            const selector = match[1];

            // Check if it's a single selector from the valid set
            if (validSelectors.has(selector)) {
                return true;
            }

            // Check for known invalid patterns
            const invalidPatterns = [
                '#.',
                '.#',
                'div.',
                'div#',
                'example#.',
            ];

            for (const pattern of invalidPatterns) {
                if (selector.includes(pattern)) {
                    return false;
                }
            }

            // For space-separated batch of valid selectors, return true
            return true;
        }),
    } as unknown as typeof CSS;
}

describe('validateSelectors', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('returns empty arrays for empty input', () => {
        global.CSS = { supports: vi.fn() } as unknown as typeof CSS;

        const result = validateSelectors([]);

        expect(result).toEqual({ valid: [], invalid: [] });
        expect((global.CSS.supports as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    });

    it('fast path: returns all valid when batch check passes', () => {
        const selectors = ['.foo', '#bar', 'div'];

        // With space separator, valid selectors still form a valid descendant selector
        // e.g., ".foo #bar div" is syntactically valid even if elements don't exist
        global.CSS = {
            supports: vi.fn((condition: string) => {
                const match = condition.match(/^selector\((.+)\)$/);
                if (!match) {
                    return false;
                }
                const selector = match[1];

                // Space-separated valid selectors form a valid descendant selector
                // Individual selectors are also valid
                return !selector.includes('#.');
            }),
        } as unknown as typeof CSS;

        const result = validateSelectors(selectors);

        expect(result.valid).toEqual(selectors);
        expect(result.invalid).toEqual([]);
        // Should have called supports exactly once (batch check passes)
        expect((global.CSS.supports as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    });

    it('slow path: filters out one invalid selector', () => {
        const valid = ['.foo', '#bar'];
        mockCssSupports(new Set(valid));

        const result = validateSelectors([...valid, '#.broken']);

        expect(result.valid).toEqual(valid);
        expect(result.invalid).toEqual(['#.broken']);
        // 1 batch call + 3 individual calls
        expect((global.CSS.supports as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(4);
    });

    it('slow path: filters out all invalid selectors', () => {
        mockCssSupports(new Set());

        const result = validateSelectors(['#.broken', 'example#.', 'div.']);

        expect(result.valid).toEqual([]);
        expect(result.invalid).toEqual(['#.broken', 'example#.', 'div.']);
    });

    it('slow path: handles mix of valid and invalid selectors', () => {
        const valid = new Set(['.ad', 'div > span', '#banner']);
        mockCssSupports(valid);

        const result = validateSelectors([
            '.ad',
            '#.example',
            'div > span',
            'example#.',
            '#banner',
            'example#.example',
        ]);

        expect(result.valid).toEqual(['.ad', 'div > span', '#banner']);
        expect(result.invalid).toEqual(['#.example', 'example#.', 'example#.example']);
    });

    it('handles a single valid selector', () => {
        mockCssSupports(new Set(['.foo']));

        const result = validateSelectors(['.foo']);

        expect(result.valid).toEqual(['.foo']);
        expect(result.invalid).toEqual([]);
        // Only the batch call — it passes, so no individual checks
        expect((global.CSS.supports as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    });

    it('handles a single invalid selector', () => {
        mockCssSupports(new Set());

        const result = validateSelectors(['div.']);

        expect(result.valid).toEqual([]);
        expect(result.invalid).toEqual(['div.']);
    });

    describe('known invalid selector patterns', () => {
        it.each([
            ['#.example'],
            ['example#.'],
            ['example#.example'],
            ['.#foo'],
            ['div.'],
            ['div#'],
        ])('identifies "%s" as invalid', (selector) => {
            mockCssSupports(new Set());

            const result = validateSelectors([selector]);

            expect(result.invalid).toContain(selector);
            expect(result.valid).toEqual([]);
        });
    });
});
