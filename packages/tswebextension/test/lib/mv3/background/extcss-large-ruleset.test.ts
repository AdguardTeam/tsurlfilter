/**
 * @vitest-environment jsdom
 */

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest';

import { applyExtCss } from '../../../../src/lib/mv3/background/extcss-apply-fn';

// US4 scenario 2 / AC2: "hundreds of ExtCSS rules". 500 is well above
// "hundreds" and exercises the args serialization path heavily.
const LARGE_RULESET_SIZE = 500;

// Conservative ceiling for the total executeScript({ func, args }) payload.
// Chrome has no published hard byte limit; this ceiling is deliberately
// generous (1 MiB) so a passing test gives strong confidence that hundreds of
// rules will not approach any realistic argument-size limit. The actual
// measured size is printed by the test for the record.
const SAFE_PAYLOAD_BYTES = 1024 * 1024;

// Shared jsdom cleanup (same pattern as extcss-apply-fn.test.ts): dispose the
// retained instance and reset the DOM between tests.
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
 * Builds a large set of ExtCSS rules and a DOM that matches one representative
 * rule per "class bucket", so we can assert application without checking all
 * 500 elements.
 *
 * @returns The generated rules and the matching element selectors.
 */
function buildLargeRuleset(): {
    rules: string[];
    sampleSelectors: string[];
} {
    const rules: string[] = [];
    const sampleSelectors: string[] = [];

    for (let i = 0; i < LARGE_RULESET_SIZE; i += 1) {
        const cls = `ad-slot-${i}`;
        rules.push(`.${cls}:has(.child) { display: none !important; }`);
        // Keep a few representative selectors to place matching elements for.
        if (i % 100 === 0) {
            sampleSelectors.push(cls);
        }
    }

    return { rules, sampleSelectors };
}

describe('applyExtCss — large rule set (AC2 / US4 scenario 2)', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('applies 500 ExtendedCSS rules and hides matching elements', () => {
        const { rules, sampleSelectors } = buildLargeRuleset();

        // Add one matching element per sample selector.
        for (const cls of sampleSelectors) {
            const el = document.createElement('div');
            el.className = cls;
            el.innerHTML = '<span class="child"></span>';
            document.body.appendChild(el);
        }

        applyExtCss(rules);

        for (const cls of sampleSelectors) {
            const el = document.querySelector(`.${cls}`) as HTMLElement;
            expect(el.style.getPropertyValue('display')).toBe('none');
            expect(el.style.getPropertyPriority('display')).toBe('important');
        }
    });

    it('serialized executeScript payload stays under the safe ceiling', () => {
        const { rules } = buildLargeRuleset();

        // func payload: exactly what Chrome serializes via Function.toString().
        const funcBytes = Buffer.byteLength(String(applyExtCss), 'utf8');
        // args payload: cssRules (array of strings) + collectStats (boolean).
        const argsBytes = Buffer.byteLength(
            JSON.stringify([rules, false]),
            'utf8',
        );
        const totalBytes = funcBytes + argsBytes;

        // eslint-disable-next-line no-console -- benchmark/validation report
        console.log(
            `[extcss-large-ruleset] func=${funcBytes} B, `
            + `args=${argsBytes} B, total=${totalBytes} B `
            + `(ceiling=${SAFE_PAYLOAD_BYTES} B)`,
        );

        expect(totalBytes).toBeLessThan(SAFE_PAYLOAD_BYTES);
    });
});
