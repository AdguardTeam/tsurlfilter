import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { splitSelectorList, validateSelectors } from '../../../../src/lib/common/utils/selector-validator';

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

describe('splitSelectorList', () => {
    it('returns single-element array for selector without commas', () => {
        expect(splitSelectorList('.foo')).toEqual(['.foo']);
    });

    it('splits simple comma-separated selectors', () => {
        expect(splitSelectorList('.foo, .bar')).toEqual(['.foo', '.bar']);
    });

    it('splits multiple comma-separated selectors', () => {
        expect(splitSelectorList('.a, .b, .c')).toEqual(['.a', '.b', '.c']);
    });

    it('does not split commas inside attribute selectors (quoted)', () => {
        expect(splitSelectorList('[data-value="a,b"]')).toEqual(['[data-value="a,b"]']);
    });

    it('does not split commas inside single-quoted attribute selectors', () => {
        expect(splitSelectorList("[data-value='a,b']")).toEqual(["[data-value='a,b']"]);
    });

    it('does not split commas inside :is()', () => {
        expect(splitSelectorList(':is(.a, .b)')).toEqual([':is(.a, .b)']);
    });

    it('does not split commas inside :not()', () => {
        expect(splitSelectorList(':not(.a, .b)')).toEqual([':not(.a, .b)']);
    });

    it('does not split commas inside :has()', () => {
        expect(splitSelectorList(':has(.a, .b)')).toEqual([':has(.a, .b)']);
    });

    it('splits at top-level comma with nested parens containing commas', () => {
        expect(splitSelectorList(':has(:is(.a, .b)), .c')).toEqual([':has(:is(.a, .b))', '.c']);
    });

    it('handles mixed quoted commas and real commas', () => {
        expect(splitSelectorList('IMG[alt="Reklama"], .l-box--99.l-box > .text-center'))
            .toEqual(['IMG[alt="Reklama"]', '.l-box--99.l-box > .text-center']);
    });

    it('trims whitespace from parts', () => {
        expect(splitSelectorList('  .foo  ,  .bar  ')).toEqual(['.foo', '.bar']);
    });

    it('handles selector with no spaces around comma', () => {
        expect(splitSelectorList('.foo,.bar')).toEqual(['.foo', '.bar']);
    });

    it('does not split commas inside brackets', () => {
        expect(splitSelectorList('[attr*="a,b"], .foo')).toEqual(['[attr*="a,b"]', '.foo']);
    });

    it('handles escaped quotes inside attribute selectors', () => {
        expect(splitSelectorList('[attr="a\\"b,c"], .foo')).toEqual(['[attr="a\\"b,c"]', '.foo']);
    });
});

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

    describe('comma-containing selectors', () => {
        /**
         * Mock that simulates real browser behavior: CSS.supports('selector(A, B)')
         * fails when there's a top-level comma in the selector (outside parens/brackets/quotes).
         * Commas inside :is(), :has(), :not(), or attribute selectors are fine.
         *
         * @param validParts Set of individual selector parts that are valid.
         */
        function mockBrowserCssSupports(validParts: Set<string>): void {
            global.CSS = {
                supports: vi.fn((condition: string) => {
                    const match = condition.match(/^selector\((.+)\)$/);
                    if (!match) {
                        return false;
                    }

                    const selector = match[1];

                    // Simulate browser behavior: top-level commas cause failure.
                    // Commas inside parens (e.g., :is(.a, .b)) are OK.
                    if (selector.includes(',')) {
                        let depth = 0;
                        for (let i = 0; i < selector.length; i += 1) {
                            const ch = selector[i];
                            if (ch === '(' || ch === '[') {
                                depth += 1;
                            } else if (ch === ')' || ch === ']') {
                                depth -= 1;
                            } else if (ch === ',' && depth === 0) {
                                return false;
                            }
                        }
                    }

                    return validParts.has(selector);
                }),
            } as unknown as typeof CSS;
        }

        it('validates comma-containing selector by checking each part', () => {
            mockBrowserCssSupports(new Set([
                'IMG[alt="Reklama"]',
                '.l-box--99.l-box > .text-center',
            ]));

            const result = validateSelectors(['IMG[alt="Reklama"], .l-box--99.l-box > .text-center']);

            expect(result.valid).toEqual(['IMG[alt="Reklama"], .l-box--99.l-box > .text-center']);
            expect(result.invalid).toEqual([]);
        });

        it('marks comma-containing selector as invalid when one part is invalid', () => {
            mockBrowserCssSupports(new Set(['.valid-part']));

            const result = validateSelectors(['.valid-part, #.broken-part']);

            expect(result.valid).toEqual([]);
            expect(result.invalid).toEqual(['.valid-part, #.broken-part']);
        });

        it('handles mix of comma-containing and simple selectors', () => {
            mockBrowserCssSupports(new Set([
                'IMG[alt="Ad"]',
                '.sidebar-ad',
                '.banner',
            ]));

            const result = validateSelectors([
                'IMG[alt="Ad"], .sidebar-ad',
                '#.invalid',
                '.banner',
            ]);

            expect(result.valid).toEqual(['IMG[alt="Ad"], .sidebar-ad', '.banner']);
            expect(result.invalid).toEqual(['#.invalid']);
        });

        it('fast path still works when no selectors contain commas', () => {
            global.CSS = {
                supports: vi.fn(() => true),
            } as unknown as typeof CSS;

            const result = validateSelectors(['.foo', '#bar', 'div']);

            expect(result.valid).toEqual(['.foo', '#bar', 'div']);
            expect(result.invalid).toEqual([]);
            expect((global.CSS.supports as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
        });

        it('validates selector with commas inside :is() as single selector', () => {
            mockBrowserCssSupports(new Set([':is(.a, .b)']));

            const result = validateSelectors([':is(.a, .b)']);

            expect(result.valid).toEqual([':is(.a, .b)']);
            expect(result.invalid).toEqual([]);
            expect((global.CSS.supports as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
        });

        it('validates selector with top-level comma and nested paren commas', () => {
            mockBrowserCssSupports(new Set([':has(:is(.a, .b))', '.c']));

            const result = validateSelectors([':has(:is(.a, .b)), .c']);

            expect(result.valid).toEqual([':has(:is(.a, .b)), .c']);
            expect(result.invalid).toEqual([]);
        });
    });
});
