/**
 * @file Comprehensive syntax detection test matrix.
 *
 * Verifies that the correct SyntaxFlags bitflags are assigned to each rule
 * type across all categories (comments, network, cosmetic). Each entry
 * includes a reason explaining the expected value.
 *
 * Satisfies FR-017, SC-002, SC-007.
 */

import { describe, expect, test } from 'vitest';

import { RuleParserPipeline } from '../../src/ast-builder/rule-parser';
import type { AgentCommentRule } from '../../src/nodes';
import {
    SYNTAX_ABP,
    SYNTAX_ADG,
    SYNTAX_ALL,
    SYNTAX_UBO,
} from '../../src/utils/syntax-flags';

const parser = new RuleParserPipeline();

interface SyntaxTestCase {
    input: string;
    expected: number;
    reason: string;
}

describe('Syntax detection — comprehensive matrix', () => {
    describe('simple comments', () => {
        const cases: SyntaxTestCase[] = [
            {
                input: '! Homepage: https://example.com',
                expected: SYNTAX_ALL,
                reason: '! marker is universal — all products support it',
            },
            {
                input: '# comment line',
                expected: SYNTAX_ADG | SYNTAX_UBO,
                reason: '# marker is only supported by AdGuard and uBlock Origin',
            },
        ];

        test.each(cases)('$input → $reason', ({ input, expected }) => {
            const ast = parser.parse(input);
            expect(ast.syntax).toBe(expected);
        });
    });

    describe('metadata comments', () => {
        const cases: SyntaxTestCase[] = [
            {
                input: '! Title: My Filter List',
                expected: SYNTAX_ALL,
                reason: '! marker metadata is universal',
            },
            {
                input: '# Title: My Filter List',
                expected: SYNTAX_ADG | SYNTAX_UBO,
                reason: '# marker metadata only supported by ADG and UBO',
            },
        ];

        test.each(cases)('$input → $reason', ({ input, expected }) => {
            const ast = parser.parse(input);
            expect(ast.syntax).toBe(expected);
        });
    });

    describe('preprocessor directives', () => {
        const cases: SyntaxTestCase[] = [
            {
                input: '!#if adguard',
                expected: SYNTAX_ADG | SYNTAX_UBO,
                reason: '!#if is supported by both AdGuard and uBlock Origin',
            },
            {
                input: '!#else',
                expected: SYNTAX_ADG | SYNTAX_UBO,
                reason: '!#else is supported by both AdGuard and uBlock Origin',
            },
            {
                input: '!#endif',
                expected: SYNTAX_ADG | SYNTAX_UBO,
                reason: '!#endif is supported by both AdGuard and uBlock Origin',
            },
            {
                input: '!#include ./other-list.txt',
                expected: SYNTAX_ADG | SYNTAX_UBO,
                reason: '!#include is supported by both AdGuard and uBlock Origin',
            },
            {
                input: '!#safari_cb_affinity(privacy)',
                expected: SYNTAX_ADG,
                reason: '!#safari_cb_affinity is AdGuard-only',
            },
        ];

        test.each(cases)('$input → $reason', ({ input, expected }) => {
            const ast = parser.parse(input);
            expect(ast.syntax).toBe(expected);
        });
    });

    describe('hint comments', () => {
        const cases: SyntaxTestCase[] = [
            {
                input: '!+ PLATFORM(windows)',
                expected: SYNTAX_ADG,
                reason: 'Hints are an AdGuard-only feature',
            },
            {
                input: '!+ NOT_OPTIMIZED',
                expected: SYNTAX_ADG,
                reason: 'Hints are an AdGuard-only feature',
            },
        ];

        test.each(cases)('$input → $reason', ({ input, expected }) => {
            const ast = parser.parse(input);
            expect(ast.syntax).toBe(expected);
        });
    });

    describe('agent comments', () => {
        test('[AdGuard] → agent children carry per-product syntax', () => {
            const ast = parser.parse('[AdGuard]') as AgentCommentRule;
            // The rule itself is universal
            expect(ast.syntax).toBe(SYNTAX_ALL);
            // Individual agents carry product-specific flags
            expect(ast.children[0].syntax).toBe(SYNTAX_ADG);
        });

        test('[uBlock Origin] → UBO-specific agent', () => {
            const ast = parser.parse('[uBlock Origin]') as AgentCommentRule;
            expect(ast.syntax).toBe(SYNTAX_ALL);
            expect(ast.children[0].syntax).toBe(SYNTAX_UBO);
        });

        test('[Adblock Plus] → ABP-specific agent', () => {
            const ast = parser.parse('[Adblock Plus]') as AgentCommentRule;
            expect(ast.syntax).toBe(SYNTAX_ALL);
            expect(ast.children[0].syntax).toBe(SYNTAX_ABP);
        });
    });

    describe('network rules', () => {
        const cases: SyntaxTestCase[] = [
            {
                input: '||example.org^',
                expected: SYNTAX_ALL,
                reason: 'Basic network rules — no structural markers to distinguish products',
            },
            {
                input: '||example.org^$important',
                expected: SYNTAX_ALL,
                reason: 'Modifier-based syntax cannot be determined at parse level',
            },
            {
                input: '@@||example.org^$document',
                expected: SYNTAX_ALL,
                reason: 'Exception network rules are universal at syntax level',
            },
            {
                input: '/^https?:\\/\\/ads\\./$third-party',
                expected: SYNTAX_ALL,
                reason: 'Regex network rules are universal',
            },
        ];

        test.each(cases)('$input → $reason', ({ input, expected }) => {
            const ast = parser.parse(input);
            expect(ast.syntax).toBe(expected);
        });
    });

    describe('element hiding rules', () => {
        const cases: SyntaxTestCase[] = [
            {
                input: 'example.com##.ads',
                expected: SYNTAX_ALL,
                reason: 'Basic element hiding (##) is universal',
            },
            {
                input: 'example.com#?#.ads:has(> .sponsored)',
                expected: SYNTAX_ALL,
                reason: 'Extended CSS (#?#) is supported by all three products',
            },
            {
                input: 'example.com#@#.ads',
                expected: SYNTAX_ALL,
                reason: 'Element hiding exceptions (#@#) are universal',
            },
            {
                input: 'example.com#@?#.ads:has(> .sponsored)',
                expected: SYNTAX_ALL,
                reason: 'Extended CSS exceptions (#@?#) are universal',
            },
        ];

        test.each(cases)('$input → $reason', ({ input, expected }) => {
            const ast = parser.parse(input);
            expect(ast.syntax).toBe(expected);
        });
    });

    describe('ABP CSS injection (##selector { declarations })', () => {
        const cases: SyntaxTestCase[] = [
            {
                input: 'example.com##.ads { display: none !important; }',
                expected: SYNTAX_ABP,
                reason: 'ABP CSS injection: selector followed by declaration block',
            },
            {
                input: 'example.com##body .container { visibility: hidden; }',
                expected: SYNTAX_ABP,
                reason: 'ABP CSS injection: compound selector with declaration block',
            },
            {
                input: '##.banner { display: none; }',
                expected: SYNTAX_ABP,
                reason: 'ABP CSS injection: no domain, bare selector with declarations',
            },
            {
                input: 'example.com##div[class="ad"] { opacity: 0 !important; }',
                expected: SYNTAX_ABP,
                reason: 'ABP CSS injection: attribute selector (brackets) do not confuse detection',
            },
            {
                input: 'example.com##.ad-wrapper { margin: 0; padding: 0; }',
                expected: SYNTAX_ABP,
                reason: 'ABP CSS injection: multiple declarations in block',
            },
            {
                input: 'example.com##a[href^="https://ads"] { color: transparent; }',
                expected: SYNTAX_ABP,
                reason: 'ABP CSS injection: attribute selector with brackets before declaration block',
            },
            {
                input: 'example.com#@#.ads { display: none !important; }',
                expected: SYNTAX_ABP,
                reason: 'ABP CSS injection exception: exception marker does not change detection',
            },
        ];

        test.each(cases)('$input → $reason', ({ input, expected }) => {
            const ast = parser.parse(input);
            expect(ast.syntax).toBe(expected);
        });
    });

    describe('ADG-specific cosmetic rules', () => {
        const cases: SyntaxTestCase[] = [
            {
                input: 'example.com#$#.ads { display: none !important; }',
                expected: SYNTAX_ADG,
                reason: 'ADG CSS injection uses #$# separator',
            },
            {
                input: 'example.com#%#//scriptlet("abort-on-property-read", "ads")',
                expected: SYNTAX_ADG,
                reason: 'ADG JS injection uses #%# separator',
            },
            {
                input: 'example.com#%#AG_onLoad(function() { /* ... */ });',
                expected: SYNTAX_ADG,
                reason: 'ADG JS injection — arbitrary JS code',
            },
            {
                input: 'example.com$$div[id="ad"]',
                expected: SYNTAX_ADG,
                reason: 'ADG HTML filtering uses $$ separator',
            },
            {
                input: 'example.com#$?#.ads:has(> .sponsored) { display: none !important; }',
                expected: SYNTAX_ADG,
                reason: 'ADG extended CSS injection uses #$?# separator',
            },
        ];

        test.each(cases)('$input → $reason', ({ input, expected }) => {
            const ast = parser.parse(input);
            expect(ast.syntax).toBe(expected);
        });
    });

    describe('UBO-specific cosmetic rules', () => {
        const cases: SyntaxTestCase[] = [
            {
                input: 'example.com##^script:has-text(ads)',
                expected: SYNTAX_UBO,
                reason: 'UBO HTML filtering uses ##^ separator',
            },
            {
                input: 'example.com##+js(set-constant, ads, true)',
                expected: SYNTAX_UBO,
                reason: 'UBO scriptlet injection uses ##+js() syntax',
            },
            {
                input: 'example.com##.ads:remove()',
                expected: SYNTAX_UBO,
                reason: 'UBO :remove() procedural modifier',
            },
            {
                input: 'example.com##.ads:style(display: none !important;)',
                expected: SYNTAX_UBO,
                reason: 'UBO :style() procedural modifier',
            },
        ];

        test.each(cases)('$input → $reason', ({ input, expected }) => {
            const ast = parser.parse(input);
            expect(ast.syntax).toBe(expected);
        });
    });

    describe('ABP scriptlet injection', () => {
        const cases: SyntaxTestCase[] = [
            {
                input: 'example.com#$#abort-on-property-read ads',
                expected: SYNTAX_ABP,
                reason: 'ABP snippet injection uses #$# with snippet name (no braces)',
            },
        ];

        test.each(cases)('$input → $reason', ({ input, expected }) => {
            const ast = parser.parse(input);
            expect(ast.syntax).toBe(expected);
        });
    });
});
