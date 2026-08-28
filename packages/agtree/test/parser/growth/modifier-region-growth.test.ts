import { describe, expect, test } from 'vitest';

import { RuleParserPipeline } from '../../../src/ast-builder/rule-parser';
import type { NetworkRule } from '../../../src/nodes';

/**
 * More than the 64-modifier default — verifies single-step growth.
 */
const MODIFIERS_ABOVE_DEFAULT = 128;

/**
 * Size used for sequential-pass reuse tests.
 */
const MODIFIERS_SEQUENTIAL = 100;

/**
 * Build a network rule with N modifiers (`m0,m1,...,mN-1`).
 *
 * @param n Number of modifiers.
 *
 * @returns Rule source string like `||x^$m0,m1,...,mN-1`.
 */
function makeNetworkRule(n: number): string {
    const mods = Array.from({ length: n }, (_, i) => `m${i}`).join(',');
    return `||example.com^$${mods}`;
}

describe('Modifier-region growth', () => {
    test('parses a network rule with more modifiers than the default capacity', () => {
        const parser = new RuleParserPipeline();
        const n = MODIFIERS_ABOVE_DEFAULT;
        const source = makeNetworkRule(n);
        const rule = parser.parse(source) as NetworkRule;

        expect(rule.type).toBe('NetworkRule');
        expect(rule.modifiers?.children).toHaveLength(n);
        expect(rule.modifiers?.children[0].name.value).toBe('m0');
        expect(rule.modifiers?.children[n - 1].name.value).toBe(`m${n - 1}`);
    });

    test('parses multiple large network rules in sequence', () => {
        const parser = new RuleParserPipeline();
        for (let pass = 0; pass < 3; pass += 1) {
            const n = MODIFIERS_SEQUENTIAL;
            const rule = parser.parse(makeNetworkRule(n)) as NetworkRule;
            expect(rule.modifiers?.children).toHaveLength(n);
        }
    });
});
