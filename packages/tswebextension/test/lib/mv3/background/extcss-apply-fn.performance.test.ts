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

import { EXTCSS_PROTOCOL } from '../../../../src/lib/common/message-constants';
import { extCssInjectedApply } from '../../../../src/lib/mv3/background/extcss-apply-fn';

// NOTE: This benchmark follows the convention of the prior-art
// `packages/tsurlfilter/test/engine/start-engine-benchmark.test.ts`:
//   - Latency numbers are printed via `console.log` for MANUAL REVIEW only.
//   - There is NO hard wall-clock ceiling assertion.
// The one additional deterministic guard is the payload-size check below
// (`APPLY_FN_MAX_BYTES`): it fails on an accidental growth of the inlined
// engine, not on machine speed.
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

// Ceiling for the serialized `func` payload only (not the total executeScript
// payload — see extcss-large-ruleset.test.ts for the 1 MiB total ceiling).
// Measured value on 2026-10-20: 46 474 B (~45.4 KiB) for the Vitest-serialized
// `extCssInjectedApply`; the ceiling leaves ~2x headroom for engine growth
// while still failing long before the 1 MiB total-payload ceiling.
const APPLY_FN_MAX_BYTES = 96 * 1024;

afterEach(() => {
    // eslint-disable-next-line no-underscore-dangle -- marker key inlined into extCssInjectedApply
    const handle = (window as unknown as { __adguardExtCss?: { dispose(): void } | null }).__adguardExtCss;
    if (handle) {
        try {
            handle.dispose();
        } catch {
            // ignore
        }
    }
    // eslint-disable-next-line no-underscore-dangle -- marker key inlined into extCssInjectedApply
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

describe('extCssInjectedApply — performance benchmark (AC1, print-only timings)', () => {
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
            extCssInjectedApply(rules, false, EXTCSS_PROTOCOL);
            const elapsed = performance.now() - start;

            const el = document.querySelector(`.${matchClass}`) as HTMLElement;
            // CORRECTNESS assertion: the rule was actually applied this
            // iteration. Latency itself is never asserted.
            expect(el.style.getPropertyValue('display')).toBe('none');
            expect(el.style.getPropertyPriority('display')).toBe('important');

            latencies.push(elapsed);

            // Dispose + reset for the next iteration (no leaked observers).
            // eslint-disable-next-line no-underscore-dangle -- marker key inlined into extCssInjectedApply
            const handle = (window as unknown as { __adguardExtCss?: { dispose(): void } | null }).__adguardExtCss;
            handle?.dispose();
            // eslint-disable-next-line no-underscore-dangle -- marker key inlined into extCssInjectedApply
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

    it('serialized apply func stays under the size ceiling', () => {
        // Deterministic regression guard: wall-clock timings above are
        // print-only, so this is the only check that fails CI on a real
        // regression. `func` is exactly what Chrome serializes via
        // Function.toString(); the ceiling is func-only and much tighter than
        // the 1 MiB total-payload ceiling in extcss-large-ruleset.test.ts.
        const funcBytes = Buffer.byteLength(String(extCssInjectedApply), 'utf8');

        // eslint-disable-next-line no-console -- benchmark/validation report
        console.log(
            `[extcss-apply-benchmark] func=${funcBytes} B `
            + `(ceiling=${APPLY_FN_MAX_BYTES} B)`,
        );

        expect(funcBytes).toBeLessThan(APPLY_FN_MAX_BYTES);
    });
});
