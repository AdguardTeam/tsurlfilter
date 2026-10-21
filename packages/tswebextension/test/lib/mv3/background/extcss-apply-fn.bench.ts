/**
 * @vitest-environment jsdom
 */

import { test } from 'vitest';

import { EXTCSS_PROTOCOL } from '../../../../src/lib/common/message-constants';
import { extCssInjectedApply } from '../../../../src/lib/mv3/background/extcss-apply-fn';
import { resetExtCssState } from '../helpers';

// A representative rule set size (matches the "hundreds of rules" scenario).
const RULESET_SIZE = 100;

// One apply is fast in jsdom, so a small iteration budget keeps the run quick
// while still producing a stable sample.
const BENCH_OPTIONS = {
    iterations: 20,
    warmupIterations: 5,
};

/**
 * Builds a representative rule set with one matching element.
 *
 * @returns The rules and the class of the element the first rule matches.
 */
function buildRuleset(): { rules: string[]; matchClass: string } {
    const rules: string[] = [];
    for (let i = 0; i < RULESET_SIZE; i += 1) {
        rules.push(`.ad-${i}:has(.child) { display: none !important; }`);
    }
    return { rules, matchClass: 'ad-0' };
}

// The payload-size guard lives in `extcss-apply-fn.performance.test.ts`: it is
// deterministic and belongs to the regular test suite, while wall-clock timings
// depend on the machine and the load and are only tracked here.
test('extCssInjectedApply — apply latency (jsdom)', async ({ bench }) => {
    const { rules, matchClass } = buildRuleset();

    document.body.innerHTML = `<div class="${matchClass}"><span class="child"></span></div>`;

    // First apply outside the timed region, so every sample measures the same
    // re-apply path: dispose the previous instance, then build and apply a new
    // one. That is the steady state after the first `onCommitted` injection.
    extCssInjectedApply(rules, false, EXTCSS_PROTOCOL);

    try {
        await bench(`re-applies ${RULESET_SIZE} rules in the same document`, () => {
            extCssInjectedApply(rules, false, EXTCSS_PROTOCOL);
        }).run(BENCH_OPTIONS);
    } finally {
        resetExtCssState();
    }
});
