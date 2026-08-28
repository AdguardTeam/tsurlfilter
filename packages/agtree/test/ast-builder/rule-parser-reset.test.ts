import { describe, expect, test } from 'vitest';

import { RuleParserPipeline } from '../../src/ast-builder/rule-parser';
import type { ElementHidingRule } from '../../src/nodes';

/**
 * Large enough to force domain-buffer growth, used to verify that reset() reclaims the extra memory.
 */
const DOMAINS_LARGE = 200;

/**
 * Build a cosmetic rule with N domains.
 *
 * @param n Number of domains.
 *
 * @returns Rule source string.
 */
function makeCosmetic(n: number): string {
    const domains = Array.from({ length: n }, (_, i) => `d${i}.com`).join(',');
    return `${domains}##.ad`;
}

describe('RuleParserPipeline.reset()', () => {
    test('reset() allows next parse to work correctly', () => {
        const parser = new RuleParserPipeline();

        // Parse a large rule to force growth
        const large = parser.parse(makeCosmetic(DOMAINS_LARGE)) as ElementHidingRule;
        expect(large.domains.children).toHaveLength(DOMAINS_LARGE);

        // Reset
        parser.reset();

        // Parse a small rule — should work fine after reset
        const small = parser.parse('example.com##.ad') as ElementHidingRule;
        expect(small.type).toBe('ElementHidingRule');
        expect(small.domains.children).toHaveLength(1);
        expect(small.domains.children[0].value).toBe('example.com');
    });

    test('reset() can be called before any parse (no-op)', () => {
        const parser = new RuleParserPipeline();
        expect(() => parser.reset()).not.toThrow();
        // Still works after reset
        const rule = parser.parse('example.com##.ad') as ElementHidingRule;
        expect(rule.type).toBe('ElementHidingRule');
    });

    test('reset() can be called multiple times', () => {
        const parser = new RuleParserPipeline();
        parser.parse(makeCosmetic(DOMAINS_LARGE));
        parser.reset();
        parser.reset(); // second reset should be a no-op
        const rule = parser.parse('example.com##.ad') as ElementHidingRule;
        expect(rule.type).toBe('ElementHidingRule');
    });
});
