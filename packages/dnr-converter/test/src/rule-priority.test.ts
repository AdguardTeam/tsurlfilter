/**
 * @file Tests for Rule priority calculation — pins expected priority
 * values for representative rules to catch regressions.
 */
import { describe, expect, it } from 'vitest';

import { Rule } from '../../src/rule/rule';

/**
 * Helper: parse a single network rule and return its priority.
 *
 * @param text Rule text.
 *
 * @returns Priority weight number.
 */
function priority(text: string): number {
    const rules = Rule.createFromText(1, 0, text);
    expect(rules).toHaveLength(1);
    return rules[0].priority;
}

describe('Rule priority', () => {
    // -------------------------------------------------------------------------
    // Exact numeric priorities (pins the calculation against regressions)
    // -------------------------------------------------------------------------

    it('basic blocking rule has priority 1', () => {
        // w = 1 (base)
        expect(priority('||example.com^')).toBe(1);
    });

    it('$important blocking rule has priority 1_000_001', () => {
        // w = 1 + 10^6 (category 7)
        expect(priority('||example.com^$important')).toBe(1_000_001);
    });

    it('allowlist (@@) with no modifiers has priority 100_001', () => {
        // w = 1 + 10^5 (category 6)
        expect(priority('@@||example.com^')).toBe(100_001);
    });

    it('$important allowlist has priority 1_100_001', () => {
        // w = 1 + 10^5 (category 6) + 10^6 (category 7)
        expect(priority('@@||example.com^$important')).toBe(1_100_001);
    });

    it('$document allowlist enables implicit exceptions and has priority 140_101', () => {
        // $document on an allowlist rule implicitly enables $elemhide, $jsinject,
        // $urlblock, $content (4 category-5 options) and adds document to
        // permittedContentTypes (category 2: 50 + 50/1 = 100).
        // w = 1 + 100 + 4*10_000 (category 5) + 10^5 (category 6) = 140_101
        expect(priority('@@||example.com^$document')).toBe(140_101);
    });

    it('single $domain restriction adds category-3 weight: priority 201', () => {
        // w = 1 + (100 + 100/1) = 201
        expect(priority('||example.com^$domain=foo.com')).toBe(201);
    });

    it('two permitted domains add averaged category-3 weight: priority 151', () => {
        // w = 1 + (100 + 100/2) = 151
        expect(priority('||example.com^$domain=a.com|b.com')).toBe(151);
    });

    it('$third-party adds one category-1 unit: priority 2', () => {
        // w = 1 + 1 = 2
        expect(priority('||example.com^$third-party')).toBe(2);
    });

    it('single resource type adds category-2 weight: priority 101', () => {
        // w = 1 + (50 + 50/1) = 101
        expect(priority('||example.com^$script')).toBe(101);
    });

    it('three resource types add averaged category-2 weight (verifies rounding): priority 68', () => {
        // w = 1 + (50 + 50/3) = 67.666… → Math.ceil = 68
        expect(priority('||example.com^$script,image,media')).toBe(68);
    });

    it('$header adds flat category-2 weight: priority 51', () => {
        // w = 1 + 50 (flat, no per-count division)
        expect(priority('||example.com^$header=x-custom-header')).toBe(51);
    });

    it('$method with one value adds category-2 weight: priority 101', () => {
        // w = 1 + (50 + 50/1) = 101
        expect(priority('||example.com^$method=get')).toBe(101);
    });

    it('$to adds one category-1 unit: priority 2', () => {
        // w = 1 + 1 = 2
        expect(priority('||example.com^$to=example.org')).toBe(2);
    });

    it('$redirect adds category-4 weight: priority 1_001', () => {
        // w = 1 + 10^3
        expect(priority('||example.com^$redirect=noopjs')).toBe(1_001);
    });

    it('$csp does not contribute to priority: priority 1', () => {
        // CSP is not in any priority category
        expect(priority('||example.com^$csp=script-src \'none\'')).toBe(1);
    });

    it('combined modifiers stack priority across categories: priority 302', () => {
        // $third-party (cat-1: +1) + $domain=foo.com (cat-3: +200) + $script (cat-2: +100)
        // w = 1 + 1 + 200 + 100 = 302
        expect(priority('||example.com^$third-party,domain=foo.com,script')).toBe(302);
    });
});
