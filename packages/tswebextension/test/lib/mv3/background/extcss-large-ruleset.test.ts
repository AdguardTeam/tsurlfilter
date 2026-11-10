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

import { extCssInjectedApply } from '../../../../src/lib/mv3/background/extcss-apply-fn';
import { EXTCSS_PROTOCOL } from '../../../../src/lib/mv3/background/extcss-protocol';
import { resetExtCssState } from '../helpers';

// Large rule set: "hundreds of ExtendedCss rules". 500 is well above
// "hundreds" and exercises the args serialization path heavily.
const LARGE_RULESET_SIZE = 500;

// Shared jsdom cleanup: dispose the retained instance and reset the DOM
// between tests.
afterEach(() => {
    resetExtCssState();
});

/**
 * Builds a large set of ExtendedCss rules and a DOM that matches one representative
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

describe('extCssInjectedApply — large rule set', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('applies 500 ExtendedCss rules and hides matching elements', () => {
        const { rules, sampleSelectors } = buildLargeRuleset();

        // Add one matching element per sample selector.
        for (const cls of sampleSelectors) {
            const el = document.createElement('div');
            el.className = cls;
            el.innerHTML = '<span class="child"></span>';
            document.body.appendChild(el);
        }

        extCssInjectedApply(rules, false, EXTCSS_PROTOCOL);

        for (const cls of sampleSelectors) {
            const el = document.querySelector(`.${cls}`) as HTMLElement;
            expect(el.style.getPropertyValue('display')).toBe('none');
            expect(el.style.getPropertyPriority('display')).toBe('important');
        }
    });
});
