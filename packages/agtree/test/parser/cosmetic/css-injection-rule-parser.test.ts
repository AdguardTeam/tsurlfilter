/* eslint-disable no-bitwise */
import { describe, expect, test } from 'vitest';

import { createParserContext, initParserContext, scriptletBodyDataOffset } from '../../../src/parser/context';
import {
    CR_FLAG_EXCEPTION,
    CR_FLAGS_OFFSET,
    CR_SEP_KIND_ABP_SNIPPET,
    CR_SEP_KIND_ADG_CSS_INJECTION,
    CR_SEP_KIND_MASK,
    CR_SEP_KIND_SHIFT,
    CSS_INJ_DL_SOURCE_END,
    CSS_INJ_DL_SOURCE_START,
    CSS_INJ_FLAG_HAS_MEDIA,
    CSS_INJ_FLAG_REMOVE,
    CSS_INJ_FLAGS,
    CSS_INJ_MEDIA_QUERY_END,
    CSS_INJ_MEDIA_QUERY_START,
    CSS_INJ_SL_SOURCE_END,
    CSS_INJ_SL_SOURCE_START,
} from '../../../src/parser/cosmetic/constants';
import { RuleKind, RuleParser } from '../../../src/parser/rule';
import { Tokenizer } from '../../../src/tokenizer/tokenizer';

const tokenizer = new Tokenizer(1024);
const ctx = createParserContext();

/**
 * Returns the CSS injection data base offset within ctx.data.
 * CSS injection body data is stored after domain records
 * (same region as scriptlet body data — mutually exclusive).
 *
 * @returns CSS injection data base offset.
 */
function injOffset(): number {
    return scriptletBodyDataOffset(ctx);
}

/**
 * Parse a full rule via RuleParser using given options.
 *
 * @param source Full rule source string.
 * @param parseAbpSpecificRules Whether to enable ABP-specific rule parsing.
 *
 * @returns The RuleKind returned by the parser.
 */
function parseRule(
    source: string,
    parseAbpSpecificRules = true,
): RuleKind {
    tokenizer.setSource(source);
    initParserContext(ctx, source, tokenizer);
    return RuleParser.parse(ctx, 0, ctx.tokenCount, 0, {
        parseUboSpecificRules: true,
        parseAbpSpecificRules,
    });
}

/**
 * Extract separator sub-kind from ctx flags.
 *
 * @returns The cosmetic sub-kind integer.
 */
function getSepKind(): number {
    return (ctx.data[CR_FLAGS_OFFSET] >>> CR_SEP_KIND_SHIFT) & CR_SEP_KIND_MASK;
}

/**
 * Check if the parsed rule has the exception flag.
 *
 * @returns True if exception flag is set.
 */
function isException(): boolean {
    return (ctx.data[CR_FLAGS_OFFSET] & CR_FLAG_EXCEPTION) !== 0;
}

describe('RuleParser — CSS injection dispatch', () => {
    describe('basic #$# rules', () => {
        test('#$# with CSS body → CSS injection', () => {
            const source = '#$#body { padding: 0; }';
            const kind = parseRule(source);

            expect(kind).toBe(RuleKind.Cosmetic);
            expect(getSepKind()).toBe(CR_SEP_KIND_ADG_CSS_INJECTION);
            expect(isException()).toBe(false);

            const inj = injOffset();
            const sl = source.slice(
                ctx.data[inj + CSS_INJ_SL_SOURCE_START],
                ctx.data[inj + CSS_INJ_SL_SOURCE_END],
            );
            expect(sl).toBe('body');

            const dl = source.slice(
                ctx.data[inj + CSS_INJ_DL_SOURCE_START],
                ctx.data[inj + CSS_INJ_DL_SOURCE_END],
            );
            expect(dl).toBe('padding: 0;');
        });

        test('#@$# exception rule', () => {
            const source = '#@$#body { padding: 0; }';
            parseRule(source);

            expect(getSepKind()).toBe(CR_SEP_KIND_ADG_CSS_INJECTION);
            expect(isException()).toBe(true);
        });

        test('#$# with domains', () => {
            const source = 'example.com,~example.net#$#body { padding: 0; }';
            parseRule(source);

            expect(getSepKind()).toBe(CR_SEP_KIND_ADG_CSS_INJECTION);

            const inj = injOffset();
            const sl = source.slice(
                ctx.data[inj + CSS_INJ_SL_SOURCE_START],
                ctx.data[inj + CSS_INJ_SL_SOURCE_END],
            );
            expect(sl).toBe('body');
        });

        test('#@$# exception with domains', () => {
            const source = 'example.com,~example.net#@$#body { padding: 0; }';
            parseRule(source);

            expect(getSepKind()).toBe(CR_SEP_KIND_ADG_CSS_INJECTION);
            expect(isException()).toBe(true);
        });
    });

    describe('#$# with @media', () => {
        test('@media wrapper', () => {
            const source = '#$#@media (min-height: 1024px) and (max-height: 1920px) { body { padding: 0; } }';
            parseRule(source);

            expect(getSepKind()).toBe(CR_SEP_KIND_ADG_CSS_INJECTION);
            expect(ctx.data[injOffset() + CSS_INJ_FLAGS] & CSS_INJ_FLAG_HAS_MEDIA).toBe(CSS_INJ_FLAG_HAS_MEDIA);

            const mq = source.slice(
                ctx.data[injOffset() + CSS_INJ_MEDIA_QUERY_START],
                ctx.data[injOffset() + CSS_INJ_MEDIA_QUERY_END],
            );
            expect(mq).toBe('(min-height: 1024px) and (max-height: 1920px)');

            const sl = source.slice(
                ctx.data[injOffset() + CSS_INJ_SL_SOURCE_START],
                ctx.data[injOffset() + CSS_INJ_SL_SOURCE_END],
            );
            expect(sl).toBe('body');
        });

        test('@media with domains', () => {
            const source = 'example.com,~example.net'
                + '#$#@media (min-height: 1024px) and (max-height: 1920px) { body { padding: 0; } }';
            parseRule(source);

            expect(getSepKind()).toBe(CR_SEP_KIND_ADG_CSS_INJECTION);
            expect(ctx.data[injOffset() + CSS_INJ_FLAGS] & CSS_INJ_FLAG_HAS_MEDIA).toBe(CSS_INJ_FLAG_HAS_MEDIA);
        });
    });

    describe('#$?# extended CSS rules (always CSS injection)', () => {
        test('#$?# basic', () => {
            const source = '#$?#body:-abp-has(.ad) { padding: 0; }';
            parseRule(source);

            expect(getSepKind()).toBe(CR_SEP_KIND_ADG_CSS_INJECTION);

            const inj = injOffset();
            const sl = source.slice(
                ctx.data[inj + CSS_INJ_SL_SOURCE_START],
                ctx.data[inj + CSS_INJ_SL_SOURCE_END],
            );
            expect(sl).toBe('body:-abp-has(.ad)');
        });

        test('#@$?# exception', () => {
            const source = '#@$?#body:-abp-has(.ad) { padding: 0; }';
            parseRule(source);

            expect(getSepKind()).toBe(CR_SEP_KIND_ADG_CSS_INJECTION);
            expect(isException()).toBe(true);
        });

        test('#$?# with domains', () => {
            const source = 'example.com,~example.net#$?#body:-abp-has(.ad) { padding: 0; }';
            parseRule(source);

            expect(getSepKind()).toBe(CR_SEP_KIND_ADG_CSS_INJECTION);
        });

        test('#$?# with @media', () => {
            const source = '#$?#@media (min-height: 1024px) and (max-height: 1920px)'
                + ' { body:-abp-has(.ad) { padding: 0; } }';
            parseRule(source);

            expect(getSepKind()).toBe(CR_SEP_KIND_ADG_CSS_INJECTION);
            expect(ctx.data[injOffset() + CSS_INJ_FLAGS] & CSS_INJ_FLAG_HAS_MEDIA).toBe(CSS_INJ_FLAG_HAS_MEDIA);
        });

        test('#$?# without braces throws', () => {
            expect(() => parseRule('#$?#abp-snippet')).toThrow();
        });

        test('#@$?# without braces throws', () => {
            expect(() => parseRule('#@$?#abp-snippet')).toThrow();
        });
    });

    describe('#$# disambiguation with ABP snippets', () => {
        test('parseAbpSpecificRules=true, no braces → ABP snippet', () => {
            const source = '#$#abort-on-property-read foo';
            parseRule(source, true);

            expect(getSepKind()).toBe(CR_SEP_KIND_ABP_SNIPPET);
        });

        test('parseAbpSpecificRules=true, has braces → CSS injection', () => {
            const source = '#$#body { padding: 0; }';
            parseRule(source, true);

            expect(getSepKind()).toBe(CR_SEP_KIND_ADG_CSS_INJECTION);
        });

        test('parseAbpSpecificRules=false, no braces → throws (not ABP)', () => {
            expect(() => parseRule('#$#abort-on-property-read foo', false)).toThrow();
        });

        test('parseAbpSpecificRules=false, has braces → CSS injection', () => {
            const source = '#$#body { padding: 0; }';
            parseRule(source, false);

            expect(getSepKind()).toBe(CR_SEP_KIND_ADG_CSS_INJECTION);
        });
    });

    describe('## ABP CSS injection gating (parseAbpSpecificRules)', () => {
        test('parseAbpSpecificRules=false keeps ##sel { decl } as element-hiding', () => {
            // When parseAbpSpecificRules is disabled, element-hiding rules
            // with declaration blocks (ABP CSS injection syntax) should stay
            // as element-hiding rules instead of being promoted to CssInjectionRule.
            const source = '##.banner { display: none; }';
            const kind = parseRule(source, false);

            // Returns Cosmetic but stays as element hiding (CR_SEP_KIND_ELEM_HIDE = 0)
            // not promoted to CR_SEP_KIND_ADG_CSS_INJECTION (3)
            expect(kind).toBe(RuleKind.Cosmetic);
            expect(getSepKind()).not.toBe(CR_SEP_KIND_ADG_CSS_INJECTION);
        });

        test('parseAbpSpecificRules=true promotes ##sel { decl } to CSS injection', () => {
            const source = '##.banner { display: none; }';
            const kind = parseRule(source, true);

            expect(kind).toBe(RuleKind.Cosmetic);
            expect(getSepKind()).toBe(CR_SEP_KIND_ADG_CSS_INJECTION);
        });
    });

    describe('remove: true via RuleParser', () => {
        test('remove: true sets flag', () => {
            const source = '#$#.textad { remove: true; }';
            parseRule(source);

            expect(ctx.data[injOffset() + CSS_INJ_FLAGS] & CSS_INJ_FLAG_REMOVE).toBe(CSS_INJ_FLAG_REMOVE);
        });

        test('remove: true with extended CSS separator', () => {
            const source = '#$?#div:contains(cookies) { remove: true; }';
            parseRule(source);

            expect(ctx.data[injOffset() + CSS_INJ_FLAGS] & CSS_INJ_FLAG_REMOVE).toBe(CSS_INJ_FLAG_REMOVE);
        });

        test('remove: false throws', () => {
            expect(() => parseRule('#$#.textad { remove: false; }')).toThrow(/remove.*true/i);
        });
    });
});
