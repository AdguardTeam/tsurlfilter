/**
 * @vitest-environment jsdom
 */

import console from 'node:console';
import { performance } from 'node:perf_hooks';

import {
    afterEach,
    describe,
    expect,
    it,
} from 'vitest';

import { applyExtCss } from '../../../../src/lib/mv3/background/extcss-apply-fn';

// NOTE: This benchmark follows the convention of the prior-art
// `packages/tsurlfilter/test/engine/start-engine-benchmark.test.ts`:
//   - `expect()` calls assert CORRECTNESS ONLY (rules are actually applied).
//   - Latency numbers are printed via `console.log` for MANUAL REVIEW only.
//   - There is NO hard wall-clock ceiling assertion.
// This avoids machine/load-dependent CI flakiness in the standard
// `pnpm test:mv3` gate, which `@adguard/tswebextension` runs in full on every
// CI invocation (there is no `test:light`-style exclude here).
//
// This is NOT a latency-target assertion (that is architectural: the new
// path injects with injectImmediately:true and no retry loop, verified
// manually in benchmark-results.md). It is a jsdom observability benchmark
// for manual review and trend tracking.

// Iterations for a stable sample in jsdom.
const ITERATIONS = 50;

// A representative rule set size (matches the "hundreds of rules" scenario).
const RULESET_SIZE = 100;

afterEach(() => {
    // eslint-disable-next-line no-underscore-dangle -- marker key inlined into applyExtCss
    const handle = (window as unknown as { __adguardExtCss?: { dispose(): void } | null }).__adguardExtCss;
    if (handle) {
        try {
            handle.dispose();
        } catch {
            // ignore
        }
    }
    // eslint-disable-next-line no-underscore-dangle -- marker key inlined into applyExtCss
    (window as unknown as { __adguardExtCss?: null }).__adguardExtCss = null;
    document.body.innerHTML = '';
});

/**
 * Builds a representative rule set with one matching element.
 *
 * @returns The rules and the matching element's class.
 */
function buildRuleset(): { rules: string[]; matchClass: string } {
    const rules: string[] = [];
    for (let i = 0; i < RULESET_SIZE; i += 1) {
        rules.push(`.ad-${i}:has(.child) { display: none !important; }`);
    }
    return { rules, matchClass: 'ad-0' };
}

describe('applyExtCss — performance benchmark (AC1, print-only timings)', () => {
    /* eslint-disable jsdoc/require-description-complete-sentence */
    /**
     * Baseline apply latency in jsdom (record the first measured values here):
     *
     * Machine: <fill in on first run>, node v<version>.
     * Rule set size: 100, iterations: 50.
     * p50: TBD ms, p95: TBD ms, max: TBD ms.
     *
     * These numbers are for MANUAL TREND REVIEW only. They are NOT asserted;
     * a regression here does not fail CI. Investigate large jumps manually.
     */
    /* eslint-enable jsdoc/require-description-complete-sentence */

    it('applies a representative rule set (correctness asserted; timings printed)', () => {
        const { rules, matchClass } = buildRuleset();
        const latencies: number[] = [];

        for (let i = 0; i < ITERATIONS; i += 1) {
            document.body.innerHTML = `<div class="${matchClass}"><span class="child"></span></div>`;

            const start = performance.now();
            applyExtCss(rules);
            const elapsed = performance.now() - start;

            const el = document.querySelector(`.${matchClass}`) as HTMLElement;
            // CORRECTNESS assertion: the rule was actually applied this
            // iteration. This is the only assertion in the benchmark.
            expect(el.style.getPropertyValue('display')).toBe('none');
            expect(el.style.getPropertyPriority('display')).toBe('important');

            latencies.push(elapsed);

            // Dispose + reset for the next iteration (no leaked observers).
            // eslint-disable-next-line no-underscore-dangle -- marker key inlined into applyExtCss
            const handle = (window as unknown as { __adguardExtCss?: { dispose(): void } | null }).__adguardExtCss;
            handle?.dispose();
            // eslint-disable-next-line no-underscore-dangle -- marker key inlined into applyExtCss
            (window as unknown as { __adguardExtCss?: null }).__adguardExtCss = null;
        }

        latencies.sort((a, b) => a - b);
        const p50 = latencies[Math.floor(latencies.length * 0.5)];
        const p95 = latencies[Math.floor(latencies.length * 0.95)];
        const max = latencies[latencies.length - 1];

        // Print-only latency report for manual review (prior-art convention).
        // Deliberately NOT asserted — wall-clock timing in jsdom is
        // machine/load-dependent and would flake the CI gate.
        // eslint-disable-next-line no-console -- benchmark report
        console.log(
            `[extcss-apply-benchmark] iterations=${ITERATIONS} `
            + `rules=${RULESET_SIZE} p50=${p50.toFixed(3)} ms `
            + `p95=${p95.toFixed(3)} ms max=${max.toFixed(3)} ms`,
        );
    });
});
