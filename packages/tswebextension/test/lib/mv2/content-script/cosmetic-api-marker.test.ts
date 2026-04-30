/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';

import { type CosmeticRule } from '@adguard/tsurlfilter';

import { CosmeticApiCommon } from '../../../../src/lib/common/cosmetic-api';

const rule = (content: string, filterId: number, index: number): CosmeticRule => ({
    getContent: () => content,
    getFilterListId: () => filterId,
    getIndex: () => index,
} as unknown as CosmeticRule);

// Pull strategies via the same private hatch already used elsewhere in
// these tests. The strategies are part of the protected API surface
// inside the class and only exposed for this kind of focused test.
// @ts-expect-error — private access
const { NATIVE_MARKER, EXTENDED_MARKER } = CosmeticApiCommon;

describe('CosmeticApiCommon marker emission (AG-265)', () => {
    describe('native strategy (--adguard-hit custom property)', () => {
        it('emits elemhide marker via --adguard-hit custom property', () => {
            // @ts-expect-error — access private static for unit testing
            const out: string = CosmeticApiCommon.addMarkerToElemhideRule(rule('div.ad', 7, 42), NATIVE_MARKER);
            expect(out).toBe(
                "div.ad { display: none !important; --adguard-hit: 'adguard7%3B42' !important; }",
            );
        });

        it('emits inject marker inside the rule\'s own block (pseudo-agnostic)', () => {
            // @ts-expect-error — private access
            const out: string = CosmeticApiCommon.addMarkerToInjectRule(
                rule('div::before { border: none!important; }', 0, 1),
                NATIVE_MARKER,
            );
            expect(out).toBe(
                "div::before { border: none!important; --adguard-hit: 'adguard0%3B1' !important; }",
            );
        });

        it('does not strip or rewrite the selector for pseudo-element rules', () => {
            // @ts-expect-error — private access
            const out: string = CosmeticApiCommon.addMarkerToInjectRule(
                rule('.box > a::marker { color: red; }', 3, 9),
                NATIVE_MARKER,
            );
            expect(out.startsWith('.box > a::marker { color: red;')).toBe(true);
            expect(out).toContain("--adguard-hit: 'adguard3%3B9' !important;");
        });

        it('still tags rules whose user content uses the content property', () => {
            // Custom property does not collide with `content:`, so the
            // rule must still receive the marker.
            // @ts-expect-error — private access
            const out: string = CosmeticApiCommon.addMarkerToInjectRule(
                rule("div::before { content: 'foo'; }", 1, 2),
                NATIVE_MARKER,
            );
            expect(out).toContain("content: 'foo'");
            expect(out).toContain("--adguard-hit: 'adguard1%3B2' !important;");
        });

        it('inserts the missing trailing semicolon before appending the marker', () => {
            // @ts-expect-error — private access
            const out: string = CosmeticApiCommon.addMarkerToInjectRule(
                rule('div { color: red }', 4, 11),
                NATIVE_MARKER,
            );
            expect(out).toBe(
                "div { color: red; --adguard-hit: 'adguard4%3B11' !important; }",
            );
        });

        it('does not duplicate the trailing semicolon when one is already present', () => {
            // @ts-expect-error — private access
            const out: string = CosmeticApiCommon.addMarkerToInjectRule(
                rule('div { color: red; }', 4, 11),
                NATIVE_MARKER,
            );
            expect(out).toBe(
                "div { color: red; --adguard-hit: 'adguard4%3B11' !important; }",
            );
        });

        it('prepends @property declaration to stylesheets with hits', () => {
            // @ts-expect-error — private access
            const sheets: string[] = CosmeticApiCommon.buildStyleSheetsWithHits(
                [rule('div.ad', 7, 42)],
                [rule('div::before { border: none!important; }', 0, 1)],
                NATIVE_MARKER,
            );
            expect(sheets[0]).toBe(
                "@property --adguard-hit { syntax: '*'; inherits: false; initial-value: ''; }",
            );
            expect(sheets).toHaveLength(3);
        });

        it('returns an empty array when no rules are provided', () => {
            // @ts-expect-error — private access
            const sheets: string[] = CosmeticApiCommon.buildStyleSheetsWithHits([], [], NATIVE_MARKER);
            expect(sheets).toEqual([]);
        });
    });

    describe('extended strategy (legacy content: marker)', () => {
        it('emits elemhide marker via the content property', () => {
            // @ts-expect-error — private access
            const out: string = CosmeticApiCommon.addMarkerToElemhideRule(rule('div.ad', 7, 42), EXTENDED_MARKER);
            expect(out).toBe(
                "div.ad { display: none !important; content: 'adguard7%3B42' !important; }",
            );
        });

        it('appends content: marker to inject rules without an existing content declaration', () => {
            // @ts-expect-error — private access
            const out: string = CosmeticApiCommon.addMarkerToInjectRule(
                rule('div { color: red; }', 4, 11),
                EXTENDED_MARKER,
            );
            expect(out).toBe(
                "div { color: red; content: 'adguard4%3B11' !important; }",
            );
        });

        it('returns the rule unchanged if it already declares content (legacy collision guard)', () => {
            // @ts-expect-error — private access
            const out: string = CosmeticApiCommon.addMarkerToInjectRule(
                rule("div::before { content: 'foo'; }", 1, 2),
                EXTENDED_MARKER,
            );
            expect(out).toBe("div::before { content: 'foo'; }");
        });

        it('does NOT prepend the @property preamble (ExtendedCss never inserts a stylesheet)', () => {
            // @ts-expect-error — private access
            const sheets: string[] = CosmeticApiCommon.buildStyleSheetsWithHits(
                [rule('div.ad', 7, 42)],
                [rule('div { color: red; }', 0, 1)],
                EXTENDED_MARKER,
            );
            expect(sheets).toHaveLength(2);
            expect(sheets[0]).toContain("content: 'adguard7%3B42'");
            expect(sheets.some((s) => s.includes('@property'))).toBe(false);
        });
    });
});
