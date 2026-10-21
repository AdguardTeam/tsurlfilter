/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';

import { extCssInjectedApply } from '../../../../src/lib/mv3/background/extcss-apply-fn';

// Ceiling for the serialized `func` payload only (not the total executeScript
// payload — see extcss-large-ruleset.test.ts for the 1 MiB total ceiling).
// Measured value on 2026-10-20: 46 474 B (~45.4 KiB) for the Vitest-serialized
// `extCssInjectedApply`; the ceiling leaves ~2x headroom for engine growth
// while still failing long before the 1 MiB total-payload ceiling.
const APPLY_FN_MAX_BYTES = 96 * 1024;

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
});
