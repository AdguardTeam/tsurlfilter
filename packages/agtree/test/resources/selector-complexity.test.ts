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
 * Returns the best (minimum) wall-clock time of `runs` parses of `rule`.
 *
 * Minimum-of-N is stable under background load: noise only adds time, so the
 * fastest run is the closest estimate of the real cost.
 *
 * @param rule Rule text to parse.
 * @param runs Number of repetitions.
 *
 * @returns Elapsed milliseconds of the fastest run.
 */
function bestOf(rule: string, runs = 3): number {
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < runs; i += 1) {
        const started = performance.now();
        parser.parse(rule);
        best = Math.min(best, performance.now() - started);
    }
    return best;
}

describe('selector complexity (F-008)', () => {
    test('the `:not()` chain scan scales linearly', () => {
        // Warm up the parser and the JIT on the same shape.
        bestOf(notChain(500), 3);

        const small = bestOf(notChain(4_000));
        const large = bestOf(notChain(8_000));

        // Doubling the input must less than triple the time. The quadratic
        // scan measures ≈ 4× on the unfixed tree (A11 ratio 4.0).
        expect(large / small).toBeLessThan(3);
    }, 120_000);

    test('the `:not()` chain scan stays linear at a larger size', () => {
        // A second doubling guards against a lucky measurement at 4k/8k
        // without reaching the cap sizes, where the quadratic version needs
        // minutes and a synchronous test cannot be interrupted (A11-6).
        bestOf(notChain(1_000), 2);

        const small = bestOf(notChain(8_000), 2);
        const large = bestOf(notChain(16_000), 2);

        expect(large / small).toBeLessThan(3);
    }, 120_000);

    test('a nested `:not()` chain also scales linearly', () => {
        const nested = (count: number): string => `example.com##${':not('.repeat(count)}.a${')'.repeat(count)}`;
        bestOf(nested(250), 2);

        const small = bestOf(nested(2_000), 2);
        const large = bestOf(nested(4_000), 2);

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
