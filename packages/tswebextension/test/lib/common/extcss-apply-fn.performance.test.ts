/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';

import { extCssInjectedApply } from '../../../src/lib/common/extcss-apply-fn';
import { EXTCSS_PROTOCOL } from '../../../src/lib/common/message-constants';
import { serializeExtCssForCode } from '../../../src/lib/mv2/background/extcss-code';

import { APPLY_FN_MAX_BYTES } from './extcss-payload-size';

// A representative rule set size (matches the "hundreds of rules" scenario).
const RULESET_SIZE = 100;

/**
 * Builds a representative ExtendedCSS rule set.
 *
 * @returns ExtendedCSS rule strings.
 */
const buildRuleset = (): string[] => {
    const rules: string[] = [];
    for (let i = 0; i < RULESET_SIZE; i += 1) {
        rules.push(`.ad-${i}:has(.child) { display: none !important; }`);
    }
    return rules;
};

describe('extCssInjectedApply — serialized payload size', () => {
    it('stays under the size ceiling', () => {
        // Deterministic guard: it fails on an accidental growth of the inlined
        // engine, not on machine speed. Apply latency is tracked separately by
        // `extcss-apply-fn.bench.ts` (`pnpm bench`), because wall-clock timings
        // in jsdom depend on the machine and the load and would flake this
        // suite. `func` is exactly what Chrome serializes via
        // Function.toString().
        const funcBytes = Buffer.byteLength(String(extCssInjectedApply), 'utf8');

        // eslint-disable-next-line no-console -- size report
        console.log(
            `[extcss-apply-fn] func=${funcBytes} B `
            + `(ceiling=${APPLY_FN_MAX_BYTES} B)`,
        );

        expect(funcBytes).toBeLessThan(APPLY_FN_MAX_BYTES);
    });

    it('serialized MV2 apply code stays under the size ceiling', () => {
        // The MV2 code string is the same payload source plus the rule JSON.
        // It must stay under the same ceiling as the MV3 `func` payload.
        const code = serializeExtCssForCode(buildRuleset(), false, EXTCSS_PROTOCOL);
        const codeBytes = Buffer.byteLength(code, 'utf8');

        // eslint-disable-next-line no-console -- size report
        console.log(
            `[extcss-apply-fn] mv2Code=${codeBytes} B `
            + `(ceiling=${APPLY_FN_MAX_BYTES} B)`,
        );

        expect(codeBytes).toBeLessThan(APPLY_FN_MAX_BYTES);
    });
});
