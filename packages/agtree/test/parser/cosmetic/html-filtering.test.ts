/**
 * @file Parser-level unit tests for `HtmlFilteringParser`.
 *
 * Tests the structural parser for HTML filtering rules.
 * Inspects the flat Int32Array data buffer directly — no AST.
 */

import { describe, expect, test } from 'vitest';

import { AdblockSyntaxError } from '../../../src/errors/adblock-syntax-error';
import { RuleClassifier } from '../../../src/parser/classifier';
import {
    createParserContext,
    initParserContext,
    selectorListDataOffset,
    tokenStart,
} from '../../../src/parser/context';
import {
    CR_BODY_START,
    CR_BODY_START_TI,
    CR_FLAG_BODY_UBO_RESPONSEHEADER,
    CR_FLAG_EXCEPTION,
    CR_FLAGS_OFFSET,
    CR_SEP_KIND_ADG_HTML_FILTERING,
    CR_SEP_KIND_MASK,
    CR_SEP_KIND_SHIFT,
    CR_SEP_KIND_UBO_HTML_FILTERING,
    HF_ARG_END,
    HF_ARG_START,
    HF_FN_NAME_END,
    HF_FN_NAME_START,
} from '../../../src/parser/cosmetic/constants';
import { parseCommonCosmeticHeader } from '../../../src/parser/cosmetic/cosmetic-common';
import { AdgHtmlFilteringParser, UboHtmlFilteringParser } from '../../../src/parser/cosmetic/html-filtering';
import {
    ChildKind,
    DEFAULT_MAX_COMPLEX,
    SelectorListParser,
    SL_COUNT_OFFSET,
} from '../../../src/parser/css/selector-list';
import { Tokenizer } from '../../../src/tokenizer/tokenizer';

const tokenizer = new Tokenizer(1024);
const ctx = createParserContext();

/**
 * Data offset where selector list data starts (after CR header).
 */
const SL_DATA_OFFSET = 7;

/**
 * Helper: tokenize, classify, then call AdgHtmlFilteringParser.parse.
 *
 * @param source Rule source string.
 */
function parseAdg(source: string): void {
    tokenizer.setSource(source);
    initParserContext(ctx, source, tokenizer);
    const classified = RuleClassifier.classify(ctx, 0, ctx.tokenCount);
    AdgHtmlFilteringParser.parse(ctx, classified);
}

/**
 * Helper: tokenize, classify, then call UboHtmlFilteringParser.parse.
 *
 * @param source Rule source string.
 * @param parseUboSpecificRules Whether uBO-specific rules are allowed.
 */
function parseUbo(source: string, parseUboSpecificRules = true): void {
    tokenizer.setSource(source);
    initParserContext(ctx, source, tokenizer);
    const classified = RuleClassifier.classify(ctx, 0, ctx.tokenCount);
    UboHtmlFilteringParser.parse(ctx, classified, { parseUboSpecificRules });
}

/**
 * Read sep-kind from flags.
 *
 * @returns Sep-kind value.
 */
function sepKind(): number {
    return (ctx.data[CR_FLAGS_OFFSET] >>> CR_SEP_KIND_SHIFT) & CR_SEP_KIND_MASK;
}

/**
 * Read exception flag.
 *
 * @returns True if exception flag is set.
 */
function isException(): boolean {
    return (ctx.data[CR_FLAGS_OFFSET] & CR_FLAG_EXCEPTION) !== 0;
}

/**
 * Read responseheader flag.
 *
 * @returns True if responseheader flag is set.
 */
function isResponseHeader(): boolean {
    return (ctx.data[CR_FLAGS_OFFSET] & CR_FLAG_BODY_UBO_RESPONSEHEADER) !== 0;
}

/**
 * Helper to read selector list child record.
 *
 * @param i Child index.
 *
 * @returns Child record fields.
 */
function slChild(i: number) {
    const base = SelectorListParser.childBase(SL_DATA_OFFSET, DEFAULT_MAX_COMPLEX, i);
    const d = ctx.data;
    return {
        kind: d[base + 0] as ChildKind,
        srcStart: d[base + 1],
        srcEnd: d[base + 2],
        f0: d[base + 3],
        f1: d[base + 4],
        f2: d[base + 5],
        f3: d[base + 6],
        f4: d[base + 7],
        f5: d[base + 8],
    };
}

describe('HtmlFilteringParser — ADG', () => {
    test('ADG rule with [$…] modifier list correctly separates data regions', () => {
        // When an AdGuard [$…] modifier list is present, the parser shifts
        // selector-list data past the modifier records so the two regions
        // don't overwrite each other (selectorListDataOffset).
        parseAdg('[$domain=example.com]example.org$$script[data-src="banner"]');
        expect(sepKind()).toBe(CR_SEP_KIND_ADG_HTML_FILTERING);

        // The selector-list count at the shifted offset must be correct.
        // Use the context-aware selectorListDataOffset instead of the fixed
        // SL_DATA_OFFSET so the test reads from the right position.
        const slOffset = selectorListDataOffset(ctx);
        expect(ctx.data[slOffset + SL_COUNT_OFFSET]).toBeGreaterThan(0);
    });

    test('basic ADG rule: example.org$$script[data-src="banner"]', () => {
        parseAdg('example.org$$script[data-src="banner"]');
        expect(sepKind()).toBe(CR_SEP_KIND_ADG_HTML_FILTERING);
        expect(isException()).toBe(false);

        // Selector list should be parsed
        expect(ctx.data[SL_DATA_OFFSET + SL_COUNT_OFFSET]).toBe(1);
        // First child: type selector "script"
        const c0 = slChild(0);
        expect(c0.kind).toBe(ChildKind.TypeSelector);
        expect(ctx.source.slice(c0.f0, c0.f1)).toBe('script');
        // Second child: attribute selector
        const c1 = slChild(1);
        expect(c1.kind).toBe(ChildKind.AttributeSelector);
        expect(ctx.source.slice(c1.f0, c1.f1)).toBe('data-src');
    });

    test('ADG exception rule: example.org$@$script[data-src="banner"]', () => {
        parseAdg('example.org$@$script[data-src="banner"]');
        expect(sepKind()).toBe(CR_SEP_KIND_ADG_HTML_FILTERING);
        expect(isException()).toBe(true);
    });

    test('ADG "" in middle of double-quoted attr value', () => {
        parseAdg('example.org$$[attr="value with "" quotes"]');
        const c0 = slChild(0);
        expect(c0.kind).toBe(ChildKind.AttributeSelector);
        expect(ctx.source.slice(c0.f4, c0.f5)).toBe('value with "" quotes');
    });

    test('ADG "" at beginning of double-quoted attr value', () => {
        parseAdg('example.org$$[attr=""" value with quotes"]');
        const c0 = slChild(0);
        expect(ctx.source.slice(c0.f4, c0.f5)).toBe('"" value with quotes');
    });

    test('ADG "" at end of double-quoted attr value', () => {
        parseAdg('example.org$$[attr="value with quotes """]');
        const c0 = slChild(0);
        expect(ctx.source.slice(c0.f4, c0.f5)).toBe('value with quotes ""');
    });

    test('ADG "" in attribute pattern inside value', () => {
        parseAdg('example.org$$[attr="[attr=""test""]"]');
        const c0 = slChild(0);
        expect(ctx.source.slice(c0.f4, c0.f5)).toBe('[attr=""test""]');
    });

    test('ADG single-quoted attr value with "" (no escaping)', () => {
        parseAdg("example.org$$[attr='value with \"\" quotes']");
        const c0 = slChild(0);
        expect(ctx.source.slice(c0.f4, c0.f5)).toBe('value with "" quotes');
    });

    test('ADG simple selector: div', () => {
        parseAdg('example.org$$div');
        expect(ctx.data[SL_DATA_OFFSET + SL_COUNT_OFFSET]).toBe(1);
        const c0 = slChild(0);
        expect(c0.kind).toBe(ChildKind.TypeSelector);
        expect(ctx.source.slice(c0.f0, c0.f1)).toBe('div');
    });

    test('ADG complex selector: div > span + a ~ h1', () => {
        parseAdg('example.org$$div > span + a ~ h1');
        expect(ctx.data[SL_DATA_OFFSET + SL_COUNT_OFFSET]).toBe(1);
    });

    test('ADG multiple selectors: div > span, .class + #id', () => {
        parseAdg('example.org$$div > span, .class + #id');
        expect(ctx.data[SL_DATA_OFFSET + SL_COUNT_OFFSET]).toBe(2);
    });

    test('ADG body with attribute without value: [some_attr]', () => {
        parseAdg('example.org$$div[some_attr]');
        const c1 = slChild(1);
        expect(c1.kind).toBe(ChildKind.AttributeSelector);
        expect(ctx.source.slice(c1.f0, c1.f1)).toBe('some_attr');
    });
});

// ==========================================================================
// uBO HTML filtering (##^, #@#^)
// ==========================================================================

describe('HtmlFilteringParser — uBO', () => {
    test('basic uBO rule: example.com##^script:has-text(detect)', () => {
        parseUbo('example.com##^script:has-text(detect)');
        expect(sepKind()).toBe(CR_SEP_KIND_UBO_HTML_FILTERING);
        expect(isException()).toBe(false);
        expect(isResponseHeader()).toBe(false);

        // Body should start after ^
        const bodyStart = ctx.data[CR_BODY_START];
        expect(ctx.source[bodyStart]).toBe('s'); // 'script'

        // Selector list parsed
        expect(ctx.data[SL_DATA_OFFSET + SL_COUNT_OFFSET]).toBe(1);
        const c0 = slChild(0);
        expect(c0.kind).toBe(ChildKind.TypeSelector);
        expect(ctx.source.slice(c0.f0, c0.f1)).toBe('script');
    });

    test('uBO exception rule: example.com#@#^script:has-text(detect)', () => {
        parseUbo('example.com#@#^script:has-text(detect)');
        expect(sepKind()).toBe(CR_SEP_KIND_UBO_HTML_FILTERING);
        expect(isException()).toBe(true);
    });

    test('uBO with space after ^: example.com##^ script', () => {
        parseUbo('example.com##^ script');
        expect(sepKind()).toBe(CR_SEP_KIND_UBO_HTML_FILTERING);
        const bodyStart = ctx.data[CR_BODY_START];
        expect(ctx.source[bodyStart]).toBe('s'); // whitespace skipped
    });

    test('uBO simple selector: example.com##^div', () => {
        parseUbo('example.com##^div');
        expect(ctx.data[SL_DATA_OFFSET + SL_COUNT_OFFSET]).toBe(1);
        const c0 = slChild(0);
        expect(c0.kind).toBe(ChildKind.TypeSelector);
        expect(ctx.source.slice(c0.f0, c0.f1)).toBe('div');
    });

    test('uBO throws when parseUboSpecificRules=false', () => {
        expect(() => parseUbo('example.com##^div', false)).toThrow(AdblockSyntaxError);
    });

    test('uBO empty body after ^ throws', () => {
        expect(() => parseUbo('example.com##^')).toThrow();
    });

    test('uBO only whitespace after ^ throws', () => {
        expect(() => parseUbo('example.com##^   ')).toThrow();
    });

    test('uBO raw mode: ^ detected, sep-kind set, body start adjusted, no body parsing', () => {
        // When called via RuleParser with parseHtmlFilteringRuleBodies=false,
        // the dispatcher sets sep-kind and adjusts body start without calling UboHtmlFilteringParser.
        // Simulate that inline logic here by doing the same ctx.data writes manually.
        const source = 'example.com##^div';
        tokenizer.setSource(source);
        initParserContext(ctx, source, tokenizer);
        const classified = RuleClassifier.classify(ctx, 0, ctx.tokenCount);
        parseCommonCosmeticHeader(ctx, classified, 'uBO HTML filtering rule');
        ctx.data[CR_FLAGS_OFFSET] |= CR_SEP_KIND_UBO_HTML_FILTERING << CR_SEP_KIND_SHIFT;
        // skip ^ (bodyStartTi) and update body start
        const newTi = ctx.data[CR_BODY_START_TI] + 1; // skip ^
        // no whitespace after ^ in this case
        ctx.data[CR_BODY_START] = tokenStart(ctx, newTi);
        ctx.data[CR_BODY_START_TI] = newTi;

        expect(sepKind()).toBe(CR_SEP_KIND_UBO_HTML_FILTERING);
        // body start should point to 'd' of 'div'
        expect(ctx.source[ctx.data[CR_BODY_START]]).toBe('d');
    });
});

describe('HtmlFilteringParser — uBO responseheader', () => {
    test('responseheader(Test)', () => {
        parseUbo('example.com##^responseheader(Test)');
        expect(sepKind()).toBe(CR_SEP_KIND_UBO_HTML_FILTERING);
        expect(isResponseHeader()).toBe(true);

        expect(ctx.source.slice(ctx.data[HF_FN_NAME_START], ctx.data[HF_FN_NAME_END]))
            .toBe('responseheader');
        expect(ctx.source.slice(ctx.data[HF_ARG_START], ctx.data[HF_ARG_END]))
            .toBe('Test');
    });

    test('responseheader with extra spaces', () => {
        parseUbo('example.com##^  responseheader(  Test  )  ');
        expect(isResponseHeader()).toBe(true);
        expect(ctx.source.slice(ctx.data[HF_ARG_START], ctx.data[HF_ARG_END]))
            .toBe('Test');
    });

    test('responseheader() empty arg throws', () => {
        expect(() => parseUbo('example.com##^responseheader()')).toThrow(AdblockSyntaxError);
        try {
            parseUbo('example.com##^responseheader()');
        } catch (e: unknown) {
            expect((e as AdblockSyntaxError).message).toContain('Empty parameter');
        }
    });

    test('responseheader( missing close paren throws', () => {
        expect(() => parseUbo('example.com##^responseheader(Test')).toThrow(AdblockSyntaxError);
    });

    test('responseheader(Test) unexpected tokens after throws', () => {
        expect(() => parseUbo('example.com##^responseheader(Test) unexpected')).toThrow(AdblockSyntaxError);
    });

    test('responseheader( missing arg and close paren throws', () => {
        expect(() => parseUbo('example.com##^responseheader(')).toThrow(AdblockSyntaxError);
    });
});
