/**
 * @vitest-environment jsdom
 */

import { test } from 'vitest';

import { extCssInjectedApply } from '../../../../src/lib/common/extcss-apply-fn';
import { EXTCSS_PROTOCOL } from '../../../../src/lib/common/message-constants';
import { resetExtCssState } from '../../common/helpers';

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
 * @param prefix Class-name prefix that keeps two rule sets distinct.
 *
 * @returns The rules and the class of the element the first rule matches.
 */
function buildRuleset(prefix: string): { rules: string[]; matchClass: string } {
    const rules: string[] = [];
    for (let i = 0; i < RULESET_SIZE; i += 1) {
        rules.push(`.${prefix}-${i}:has(.child) { display: none !important; }`);
    }
    return { rules, matchClass: `${prefix}-0` };
}

// The payload-size guard lives in `extcss-apply-fn.performance.test.ts`: it is
// deterministic and belongs to the regular test suite, while wall-clock timings
// depend on the machine and the load and are only tracked here.
test('extCssInjectedApply — apply latency (jsdom)', async ({ bench }) => {
    const first = buildRuleset('ad-first');
    const second = buildRuleset('ad-second');

    document.body.innerHTML = `<div class="${first.matchClass}"><span class="child"></span></div>`;

    // First apply outside the timed region, so every sample starts from an
    // applied instance. The two rule sets alternate: re-applying the same set
    // would hit the no-op early return instead of the re-apply path.
    extCssInjectedApply(first.rules, false, EXTCSS_PROTOCOL);

    let useSecond = false;

    try {
        await bench(`re-applies ${RULESET_SIZE} rules in the same document`, () => {
            useSecond = !useSecond;
            extCssInjectedApply(useSecond ? second.rules : first.rules, false, EXTCSS_PROTOCOL);
        }).run(BENCH_OPTIONS);
    } finally {
        resetExtCssState();
    }
});
