import { describe, expect, test } from 'vitest';

import { RuleParserPipeline } from '../../../src/ast-builder/rule-parser';
import type { ElementHidingRule } from '../../../src/nodes';

/**
 * More than the 128-domain default — verifies single-step growth.
 */
const DOMAINS_ABOVE_DEFAULT = 200;

/**
 * Size used for sequential-pass reuse tests — above default but below the large test.
 */
const DOMAINS_SEQUENTIAL = 150;

/**
 * Very large domain list — exercises multiple doublings before stabilising.
 */
const DOMAINS_VERY_LARGE = 1400;

/**
 * Build a cosmetic rule with N comma-separated domains.
 *
 * @param n Number of domains.
 *
 * @returns Rule source string like `d0.com,d1.com,...,dN-1.com##.cls`.
 */
function makeCosmetic(n: number): string {
    const domains = Array.from({ length: n }, (_, i) => `d${i}.com`).join(',');
    return `${domains}##.ad`;
}

describe('Domain-region growth', () => {
    test('parses a cosmetic rule with more domains than the default capacity', () => {
        const parser = new RuleParserPipeline();
        const n = DOMAINS_ABOVE_DEFAULT;
        const source = makeCosmetic(n);
        const rule = parser.parse(source) as ElementHidingRule;

        expect(rule.type).toBe('ElementHidingRule');
        expect(rule.domains.children).toHaveLength(n);

        // Spot-check first and last domain
        expect(rule.domains.children[0].value).toBe('d0.com');
        expect(rule.domains.children[n - 1].value).toBe(`d${n - 1}.com`);
    });

    test('parses multiple large cosmetic rules in sequence (buffers grow once, reused)', () => {
        const parser = new RuleParserPipeline();
        for (let pass = 0; pass < 3; pass += 1) {
            const n = DOMAINS_SEQUENTIAL;
            const rule = parser.parse(makeCosmetic(n)) as ElementHidingRule;
            expect(rule.domains.children).toHaveLength(n);
        }
    });

    test('parses a cosmetic rule with 1400 domains', () => {
        const parser = new RuleParserPipeline();
        const n = DOMAINS_VERY_LARGE;
        const rule = parser.parse(makeCosmetic(n)) as ElementHidingRule;
        expect(rule.type).toBe('ElementHidingRule');
        expect(rule.domains.children).toHaveLength(n);
        expect(rule.domains.children[0].value).toBe('d0.com');
        expect(rule.domains.children[DOMAINS_VERY_LARGE - 1].value).toBe(`d${DOMAINS_VERY_LARGE - 1}.com`);
    });
});
