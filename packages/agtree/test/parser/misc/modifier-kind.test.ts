import { describe, expect, test } from 'vitest';

import {
    createParserContext,
    initParserContext,
    ModifierParser,
    NetworkRuleParser,
} from '../../../src/parser';
import {
    MOD_KIND_CSP,
    MOD_KIND_DOMAIN_LIST,
    MOD_KIND_REGEX,
    MOD_KIND_RESOURCE,
    MOD_KIND_UNKNOWN,
    MODIFIER_FIELD_FLAGS,
    MODIFIER_VALUE_KIND_MASK,
    MODIFIER_VALUE_KIND_SHIFT,
    NR_FLAG_PATTERN_REGEX,
    NR_FLAGS_OFFSET,
    NR_MODIFIER_RECORDS_OFFSET,
} from '../../../src/parser/network/constants';
import { Tokenizer } from '../../../src/tokenizer/tokenizer';

const tokenizer = new Tokenizer(1024);
const ctx = createParserContext();

/**
 * Parse a modifier record directly (offset 0 in ctx.data).
 *
 * @param source Source string for the modifier (name=value or just name).
 *
 * @returns The modifier flags field value.
 */
function parseModifierFlags(source: string): number {
    tokenizer.setSource(source);
    initParserContext(ctx, source, tokenizer);
    // parse at ti=0, modIndex=0, recordsOffset=default (NR_MODIFIER_RECORDS_OFFSET)
    ModifierParser.parse(ctx, 0, 0);
    return ctx.data[NR_MODIFIER_RECORDS_OFFSET + MODIFIER_FIELD_FLAGS];
}

/**
 * Extract kind bits from raw modifier flags.
 *
 * @param flags Raw modifier flags value.
 *
 * @returns Kind bits.
 */
function kindBits(flags: number): number {
    // eslint-disable-next-line no-bitwise
    return (flags >>> MODIFIER_VALUE_KIND_SHIFT) & MODIFIER_VALUE_KIND_MASK;
}

/**
 * Parse a full network rule and return the flags field.
 *
 * @param source Full network rule source string.
 *
 * @returns Rule flags.
 */
function parseRuleFlags(source: string): number {
    tokenizer.setSource(source);
    initParserContext(ctx, source, tokenizer);
    NetworkRuleParser.parse(ctx);
    return ctx.data[NR_FLAGS_OFFSET];
}

/**
 * Parse a network rule and return modifier flags at the given modifier index.
 *
 * @param source Full network rule source string.
 * @param idx Modifier index (0-based).
 *
 * @returns Modifier flags value.
 */
function parseNetRuleModifierFlags(source: string, idx: number): number {
    tokenizer.setSource(source);
    initParserContext(ctx, source, tokenizer);
    NetworkRuleParser.parse(ctx);
    const base = NR_MODIFIER_RECORDS_OFFSET + idx * 5;
    return ctx.data[base + MODIFIER_FIELD_FLAGS];
}

describe('Modifier value kind — binary buffer packing', () => {
    describe('domain-list kind', () => {
        test('domain modifier → MOD_KIND_DOMAIN_LIST', () => {
            const flags = parseModifierFlags('domain=example.com');
            expect(kindBits(flags)).toBe(MOD_KIND_DOMAIN_LIST);
        });

        test('denyallow modifier → MOD_KIND_DOMAIN_LIST', () => {
            const flags = parseModifierFlags('denyallow=example.com');
            expect(kindBits(flags)).toBe(MOD_KIND_DOMAIN_LIST);
        });

        test('from modifier → MOD_KIND_DOMAIN_LIST', () => {
            const flags = parseModifierFlags('from=example.com');
            expect(kindBits(flags)).toBe(MOD_KIND_DOMAIN_LIST);
        });

        test('to modifier → MOD_KIND_DOMAIN_LIST', () => {
            const flags = parseModifierFlags('to=example.com');
            expect(kindBits(flags)).toBe(MOD_KIND_DOMAIN_LIST);
        });
    });

    describe('CSP kind', () => {
        test('csp modifier → MOD_KIND_CSP', () => {
            const flags = parseModifierFlags('csp=default-src self');
            expect(kindBits(flags)).toBe(MOD_KIND_CSP);
        });

        test('permissions modifier → MOD_KIND_CSP', () => {
            const flags = parseModifierFlags('permissions=geolocation=()');
            expect(kindBits(flags)).toBe(MOD_KIND_CSP);
        });
    });

    describe('resource kind', () => {
        test('redirect modifier → MOD_KIND_RESOURCE', () => {
            const flags = parseModifierFlags('redirect=noopjs');
            expect(kindBits(flags)).toBe(MOD_KIND_RESOURCE);
        });

        test('rewrite modifier → MOD_KIND_RESOURCE', () => {
            const flags = parseModifierFlags('rewrite=abp-resource:blank-js');
            expect(kindBits(flags)).toBe(MOD_KIND_RESOURCE);
        });

        test('redirect-rule modifier → MOD_KIND_RESOURCE', () => {
            const flags = parseModifierFlags('redirect-rule=noopjs');
            expect(kindBits(flags)).toBe(MOD_KIND_RESOURCE);
        });
    });

    describe('regex kind', () => {
        test('modifier with regex value → MOD_KIND_REGEX', () => {
            const flags = parseModifierFlags('app=/some.*regex/');
            expect(kindBits(flags)).toBe(MOD_KIND_REGEX);
        });

        test('modifier with regex value and flags → MOD_KIND_REGEX', () => {
            const flags = parseModifierFlags('app=/some.*regex/i');
            expect(kindBits(flags)).toBe(MOD_KIND_REGEX);
        });

        test('path-like value with intermediate slash → NOT regex (MOD_KIND_UNKNOWN)', () => {
            // /foo/bar/ has intermediate slashes — must not be misclassified as regex
            const flags = parseModifierFlags('app=/foo/bar/');
            expect(kindBits(flags)).toBe(MOD_KIND_UNKNOWN);
        });
    });

    describe('unknown kind', () => {
        test('third-party modifier (no value) → MOD_KIND_UNKNOWN', () => {
            const flags = parseModifierFlags('third-party');
            expect(kindBits(flags)).toBe(MOD_KIND_UNKNOWN);
        });

        test('important modifier (no value) → MOD_KIND_UNKNOWN', () => {
            const flags = parseModifierFlags('important');
            expect(kindBits(flags)).toBe(MOD_KIND_UNKNOWN);
        });

        test('script modifier (no value) → MOD_KIND_UNKNOWN', () => {
            const flags = parseModifierFlags('script');
            expect(kindBits(flags)).toBe(MOD_KIND_UNKNOWN);
        });
    });
});

describe('Network rule pattern regex detection', () => {
    test('regex pattern → NR_FLAG_PATTERN_REGEX set', () => {
        const flags = parseRuleFlags('/ads\\.js/');
        // eslint-disable-next-line no-bitwise
        expect(flags & NR_FLAG_PATTERN_REGEX).toBe(NR_FLAG_PATTERN_REGEX);
    });

    test('regex pattern with flags → NR_FLAG_PATTERN_REGEX set', () => {
        const flags = parseRuleFlags('/ads\\.js/i');
        // eslint-disable-next-line no-bitwise
        expect(flags & NR_FLAG_PATTERN_REGEX).toBe(NR_FLAG_PATTERN_REGEX);
    });

    test('plain URL pattern → NR_FLAG_PATTERN_REGEX not set', () => {
        const flags = parseRuleFlags('||example.com^');
        // eslint-disable-next-line no-bitwise
        expect(flags & NR_FLAG_PATTERN_REGEX).toBe(0);
    });

    test('URL path starting with slash → NR_FLAG_PATTERN_REGEX not set', () => {
        const flags = parseRuleFlags('/ads/banner.js');
        // eslint-disable-next-line no-bitwise
        expect(flags & NR_FLAG_PATTERN_REGEX).toBe(0);
    });

    test('URL path with trailing slash → NR_FLAG_PATTERN_REGEX not set', () => {
        // /ads/banner/ has intermediate slashes — must not be misclassified as regex
        const flags = parseRuleFlags('/ads/banner/');
        // eslint-disable-next-line no-bitwise
        expect(flags & NR_FLAG_PATTERN_REGEX).toBe(0);
    });

    test('network rule: regex pattern with modifiers', () => {
        const flags = parseRuleFlags('/ads\\.js/$third-party');
        // eslint-disable-next-line no-bitwise
        expect(flags & NR_FLAG_PATTERN_REGEX).toBe(NR_FLAG_PATTERN_REGEX);
    });
});

describe('Network rule modifier kinds via full rule parse', () => {
    test('domain modifier value in network rule → DomainList kind', () => {
        const flags = parseNetRuleModifierFlags('||example.com^$domain=bad.com', 0);
        expect(kindBits(flags)).toBe(MOD_KIND_DOMAIN_LIST);
    });

    test('redirect modifier value in network rule → Resource kind', () => {
        const flags = parseNetRuleModifierFlags('||example.com^$redirect=noopjs', 0);
        expect(kindBits(flags)).toBe(MOD_KIND_RESOURCE);
    });

    test('third-party modifier in network rule → Unknown kind', () => {
        const flags = parseNetRuleModifierFlags('||example.com^$third-party', 0);
        expect(kindBits(flags)).toBe(MOD_KIND_UNKNOWN);
    });
});
