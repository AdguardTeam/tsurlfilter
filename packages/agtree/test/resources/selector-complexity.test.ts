/**
 * @file Scaling guards for cosmetic selectors (F-008, A11-11).
 *
 * These tests assert cost *ratios*, not absolute milliseconds (A08-C09): the
 * same process parses the same shape at double the size, so machine speed
 * cancels out. `hasUboCandidate()` used to rescan the rest of the body for
 * every `:not(`, which made a selector with k `:not()` wrappers cost O(k²).
 */

import { describe, expect, test } from 'vitest';

import { RuleParserPipeline } from '../../src/ast-builder/rule-parser';

const parser = new RuleParserPipeline();

/**
 * Builds a cosmetic rule whose selector contains `count` `:not(.a)` wrappers.
 *
 * @param count Number of `:not(.a)` wrappers.
 *
 * @returns Rule text.
 */
function notChain(count: number): string {
    return `example.com##div${':not(.a)'.repeat(count)} .z`;
}

/**
 * Returns the best (minimum) consumed CPU time of `runs` measurements, each of
 * them `reps` consecutive parses of `rule`.
 *
 * CPU time, unlike wall-clock time, is not inflated when the worker is
 * descheduled while parallel test files run. Minimum-of-N filters the
 * remaining noise, and repeating the parse inside a measurement keeps a single
 * GC pause from dominating a sub-millisecond shape.
 *
 * @param rule Rule text to parse.
 * @param runs Number of measurements.
 * @param reps Number of parses per measurement.
 *
 * @returns Elapsed CPU milliseconds of the fastest measurement.
 */
function bestOf(rule: string, runs = 3, reps = 1): number {
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < runs; i += 1) {
        const started = process.cpuUsage();
        for (let r = 0; r < reps; r += 1) {
            parser.parse(rule);
        }
        const { user, system } = process.cpuUsage(started);
        best = Math.min(best, (user + system) / 1_000);
    }
    return best;
}

describe('selector complexity (F-008)', () => {
    test('the `:not()` chain scan scales linearly', () => {
        // Warm up the parser and the JIT on the same shape.
        bestOf(notChain(500), 3);

        const small = bestOf(notChain(4_000), 3, 100);
        const large = bestOf(notChain(8_000), 3, 100);

        // Doubling the input must less than triple the time. The quadratic
        // scan measures ≈ 4× on the unfixed tree (A11 ratio 4.0).
        expect(large / small).toBeLessThan(3);
    }, 120_000);

    test('the `:not()` chain scan stays linear at a larger size', () => {
        // A second doubling guards against a lucky measurement at 4k/8k
        // without reaching the cap sizes, where the quadratic version needs
        // minutes and a synchronous test cannot be interrupted (A11-6).
        bestOf(notChain(1_000), 2);

        const small = bestOf(notChain(8_000), 3, 100);
        const large = bestOf(notChain(16_000), 3, 100);

        expect(large / small).toBeLessThan(3);
    }, 120_000);

    test('a nested `:not()` chain also scales linearly', () => {
        const nested = (count: number): string => `example.com##${':not('.repeat(count)}.a${')'.repeat(count)}`;
        bestOf(nested(250), 2);

        // Many parses per measurement: a nested shape costs well under a
        // millisecond, so one pause in a measurement would distort the ratio.
        const small = bestOf(nested(2_000), 3, 300);
        const large = bestOf(nested(4_000), 3, 300);

        expect(large / small).toBeLessThan(3);
    }, 120_000);

    test('a uBO candidate nested in `:not()` is still detected', () => {
        const nested = parser.parse('example.com##div:not(:matches-path(/x/))');
        expect(nested.type).toBe('ElementHidingRule');
        expect(
            (nested as { modifiers?: { children: { name: { value: string } }[] } }).modifiers?.children
                .map((modifier) => modifier.name.value),
        ).toEqual(['matches-path']);

        const doubleNested = parser.parse('example.com##div:not(:not(:matches-path(/x/)))');
        expect(
            (doubleNested as { modifiers?: { children: { name: { value: string } }[] } }).modifiers?.children
                .map((modifier) => modifier.name.value),
        ).toEqual(['matches-path']);

        const media = parser.parse('example.com##div:not(.a):not(:matches-media((min-width: 1px)))');
        expect(
            (media as { modifiers?: { children: { name: { value: string } }[] } }).modifiers?.children
                .map((modifier) => modifier.name.value),
        ).toEqual(['matches-media']);
    });
});
