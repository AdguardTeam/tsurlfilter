/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';

import { type IAffectedElement } from '@adguard/extended-css';

import { cssHitsHelpers } from '../../../../../src/lib/common/content-script/utils/css-hits-helpers';

/**
 * Marker prefix used by the shipped counters.
 */
const MARKER = 'adguard';

/**
 * Collects the hits of one affected element with fresh caller state.
 *
 * @param affectedEl Affected element from ExtendedCss.
 * @param countedHits Per-node reported hits, kept by the caller.
 * @param cleanedRules Cleaned rule copies, kept by the caller.
 *
 * @returns Collected hits.
 */
const collectHits = (
    affectedEl: IAffectedElement,
    countedHits: WeakMap<Element, Set<string>>,
    cleanedRules: WeakMap<
        IAffectedElement['rules'][number],
        IAffectedElement['rules'][number]
    >,
): ReturnType<typeof cssHitsHelpers.collectExtendedCssHits> => cssHitsHelpers
    .collectExtendedCssHits(affectedEl, MARKER, false, countedHits, cleanedRules);

describe('cssHitsHelpers.collectExtendedCssHits', () => {
    it('hands the same cleaned rule copy back on every pass', () => {
        const countedHits = new WeakMap<Element, Set<string>>();
        const cleanedRules = new WeakMap<
            IAffectedElement['rules'][number],
            IAffectedElement['rules'][number]
        >();
        const node = document.createElement('div');

        // One parsed rule object, as ExtendedCss keeps it.
        const rule = { style: { content: 'adguard7%3B7' } };

        const firstEl = { rules: [rule], node };
        expect(collectHits(firstEl, countedHits, cleanedRules)).toEqual([{
            filterId: 7,
            ruleIndex: 7,
            element: node,
        }]);

        const cleanedRule = firstEl.rules[0];
        expect(cleanedRule).not.toBe(rule);
        expect(cleanedRule.style?.content).toBe('');
        // The shared parsed rule keeps the marker for the other elements it
        // matches, so only the element's own copy is stripped.
        expect(rule.style.content).toBe('adguard7%3B7');

        // A mutation pass builds a new affected element around the same parsed
        // rule. ExtendedCss marks applied rules in a WeakSet keyed by the rule
        // object, so the copy must keep its identity or the fast path is
        // defeated on every pass.
        const secondEl = { rules: [rule], node };
        collectHits(secondEl, countedHits, cleanedRules);

        expect(secondEl.rules[0]).toBe(cleanedRule);
        expect(secondEl.rules[0].style?.content).toBe('');
    });

    it('shares the cleaned rule copy between elements matched by the same rule', () => {
        const countedHits = new WeakMap<Element, Set<string>>();
        const cleanedRules = new WeakMap<
            IAffectedElement['rules'][number],
            IAffectedElement['rules'][number]
        >();
        const rule = { style: { content: 'adguard8%3B8' } };

        const firstEl = { rules: [rule], node: document.createElement('div') };
        const secondEl = { rules: [rule], node: document.createElement('span') };

        collectHits(firstEl, countedHits, cleanedRules);
        collectHits(secondEl, countedHits, cleanedRules);

        expect(firstEl.rules[0]).toBe(secondEl.rules[0]);
        expect(rule.style.content).toBe('adguard8%3B8');
    });
});
