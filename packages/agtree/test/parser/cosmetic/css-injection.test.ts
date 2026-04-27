import { describe, expect, test } from 'vitest';

import { createParserContext, initParserContext } from '../../../src/parser/context';
import {
    CSS_INJ_CLOSE_BRACE_TI,
    CSS_INJ_DL_END_TI,
    CSS_INJ_DL_SOURCE_END,
    CSS_INJ_DL_SOURCE_START,
    CSS_INJ_DL_START_TI,
    CSS_INJ_FLAG_HAS_MEDIA,
    CSS_INJ_FLAG_REMOVE,
    CSS_INJ_FLAGS,
    CSS_INJ_MEDIA_CLOSE_BRACE_TI,
    CSS_INJ_MEDIA_OPEN_BRACE_TI,
    CSS_INJ_MEDIA_QUERY_END,
    CSS_INJ_MEDIA_QUERY_START,
    CSS_INJ_OPEN_BRACE_TI,
    CSS_INJ_SL_END_TI,
    CSS_INJ_SL_SOURCE_END,
    CSS_INJ_SL_SOURCE_START,
    CSS_INJ_SL_START_TI,
} from '../../../src/parser/cosmetic/constants';
import { AdgCssInjectionParser } from '../../../src/parser/cosmetic/css-injection';
import { Tokenizer } from '../../../src/tokenizer/tokenizer';

const tokenizer = new Tokenizer(1024);
const ctx = createParserContext();

/**
 * Tokenize a CSS injection body and run the structural parser.
 *
 * @param source CSS injection body string (after separator).
 * @param dataOffset Offset within ctx.data to write output.
 * @param required Whether to throw on missing brace. Defaults to true.
 *
 * @returns `true` if parsed as CSS injection.
 */
function parse(source: string, dataOffset = 0, required = true): boolean {
    tokenizer.setSource(source);
    initParserContext(ctx, source, tokenizer);
    return AdgCssInjectionParser.parse(ctx, 0, ctx.tokenCount, dataOffset, required);
}

/**
 * Slice a source region from ctx.data offsets.
 *
 * @param source Source string.
 * @param d Data buffer.
 * @param offset Base offset within d.
 * @param startSlot Slot index for the start position.
 * @param endSlot Slot index for the end position.
 *
 * @returns Sliced source substring.
 */
function sl(source: string, d: Int32Array, offset: number, startSlot: number, endSlot: number): string {
    return source.slice(d[offset + startSlot], d[offset + endSlot]);
}

describe('AdgCssInjectionParser', () => {
    describe('basic CSS injection (no @media)', () => {
        test('simple selector and declaration', () => {
            const source = 'body { padding: 0; }';
            expect(parse(source)).toBe(true);
            const d = ctx.data;

            // No media
            expect(d[CSS_INJ_FLAGS] & CSS_INJ_FLAG_HAS_MEDIA).toBe(0);
            expect(d[CSS_INJ_MEDIA_QUERY_START]).toBe(-1);
            expect(d[CSS_INJ_MEDIA_QUERY_END]).toBe(-1);
            expect(d[CSS_INJ_MEDIA_OPEN_BRACE_TI]).toBe(-1);
            expect(d[CSS_INJ_MEDIA_CLOSE_BRACE_TI]).toBe(-1);

            // Selector list = "body"
            expect(sl(source, d, 0, CSS_INJ_SL_SOURCE_START, CSS_INJ_SL_SOURCE_END)).toBe('body');

            // Declaration list = "padding: 0;"
            expect(sl(source, d, 0, CSS_INJ_DL_SOURCE_START, CSS_INJ_DL_SOURCE_END)).toBe('padding: 0;');

            // No remove
            expect(d[CSS_INJ_FLAGS] & CSS_INJ_FLAG_REMOVE).toBe(0);
        });

        test('extended CSS selector', () => {
            const source = 'body:-abp-has(.ad) { padding: 0; }';
            expect(parse(source)).toBe(true);
            const d = ctx.data;

            expect(sl(source, d, 0, CSS_INJ_SL_SOURCE_START, CSS_INJ_SL_SOURCE_END)).toBe('body:-abp-has(.ad)');
            expect(sl(source, d, 0, CSS_INJ_DL_SOURCE_START, CSS_INJ_DL_SOURCE_END)).toBe('padding: 0;');
        });

        test('multiple declarations', () => {
            const source = 'body { padding: 0; margin: 0; }';
            expect(parse(source)).toBe(true);
            const d = ctx.data;

            expect(sl(source, d, 0, CSS_INJ_SL_SOURCE_START, CSS_INJ_SL_SOURCE_END)).toBe('body');
            expect(sl(source, d, 0, CSS_INJ_DL_SOURCE_START, CSS_INJ_DL_SOURCE_END)).toBe('padding: 0; margin: 0;');
        });

        test('!important declaration', () => {
            const source = 'body { background-color: #333!important; }';
            expect(parse(source)).toBe(true);
            const d = ctx.data;

            expect(sl(source, d, 0, CSS_INJ_DL_SOURCE_START, CSS_INJ_DL_SOURCE_END))
                .toBe('background-color: #333!important;');
        });

        test('extra whitespace is trimmed', () => {
            const source = '  body  {  padding: 0;  }';
            expect(parse(source)).toBe(true);
            const d = ctx.data;

            expect(sl(source, d, 0, CSS_INJ_SL_SOURCE_START, CSS_INJ_SL_SOURCE_END)).toBe('body');
            expect(sl(source, d, 0, CSS_INJ_DL_SOURCE_START, CSS_INJ_DL_SOURCE_END)).toBe('padding: 0;');
        });
    });

    describe('@media-wrapped rules', () => {
        test('basic @media wrapper', () => {
            const source = '@media (min-height: 1024px) and (max-height: 1920px) { body { padding: 0; } }';
            expect(parse(source)).toBe(true);
            const d = ctx.data;

            // Has media flag
            expect(d[CSS_INJ_FLAGS] & CSS_INJ_FLAG_HAS_MEDIA).toBe(CSS_INJ_FLAG_HAS_MEDIA);

            // Media query list
            expect(sl(source, d, 0, CSS_INJ_MEDIA_QUERY_START, CSS_INJ_MEDIA_QUERY_END))
                .toBe('(min-height: 1024px) and (max-height: 1920px)');

            // Media brace token indices are set (not -1)
            expect(d[CSS_INJ_MEDIA_OPEN_BRACE_TI]).not.toBe(-1);
            expect(d[CSS_INJ_MEDIA_CLOSE_BRACE_TI]).not.toBe(-1);

            // Selector list = "body"
            expect(sl(source, d, 0, CSS_INJ_SL_SOURCE_START, CSS_INJ_SL_SOURCE_END)).toBe('body');

            // Declaration list = "padding: 0;"
            expect(sl(source, d, 0, CSS_INJ_DL_SOURCE_START, CSS_INJ_DL_SOURCE_END)).toBe('padding: 0;');
        });

        test('@media with extended CSS selector', () => {
            const source = '@media (min-height: 1024px) and (max-height: 1920px)'
                + ' { body:-abp-has(.ad) { padding: 0; } }';
            expect(parse(source)).toBe(true);
            const d = ctx.data;

            expect(d[CSS_INJ_FLAGS] & CSS_INJ_FLAG_HAS_MEDIA).toBe(CSS_INJ_FLAG_HAS_MEDIA);
            expect(sl(source, d, 0, CSS_INJ_MEDIA_QUERY_START, CSS_INJ_MEDIA_QUERY_END))
                .toBe('(min-height: 1024px) and (max-height: 1920px)');
            expect(sl(source, d, 0, CSS_INJ_SL_SOURCE_START, CSS_INJ_SL_SOURCE_END)).toBe('body:-abp-has(.ad)');
            expect(sl(source, d, 0, CSS_INJ_DL_SOURCE_START, CSS_INJ_DL_SOURCE_END)).toBe('padding: 0;');
        });
    });

    describe('remove: true detection', () => {
        test('remove: true sets flag', () => {
            const source = '.textad { remove: true; }';
            expect(parse(source)).toBe(true);
            const d = ctx.data;

            expect(d[CSS_INJ_FLAGS] & CSS_INJ_FLAG_REMOVE).toBe(CSS_INJ_FLAG_REMOVE);
            expect(sl(source, d, 0, CSS_INJ_SL_SOURCE_START, CSS_INJ_SL_SOURCE_END)).toBe('.textad');
        });

        test('remove: true with extra whitespace', () => {
            const source = '.ad { remove:   true ; }';
            expect(parse(source)).toBe(true);

            expect(ctx.data[CSS_INJ_FLAGS] & CSS_INJ_FLAG_REMOVE).toBe(CSS_INJ_FLAG_REMOVE);
        });

        test('remove: true with other declarations', () => {
            const source = '.ad { remove: true; display: none; }';
            expect(parse(source)).toBe(true);

            expect(ctx.data[CSS_INJ_FLAGS] & CSS_INJ_FLAG_REMOVE).toBe(CSS_INJ_FLAG_REMOVE);
        });

        test('normal declarations do not set remove flag', () => {
            const source = 'body { display: none !important; }';
            expect(parse(source)).toBe(true);

            expect(ctx.data[CSS_INJ_FLAGS] & CSS_INJ_FLAG_REMOVE).toBe(0);
        });

        test('no-remove: true is not misdetected as remove', () => {
            const source = '.ad { no-remove: true; }';
            expect(parse(source)).toBe(true);

            // The "remove" is part of "no-remove" ident — should NOT trigger
            expect(ctx.data[CSS_INJ_FLAGS] & CSS_INJ_FLAG_REMOVE).toBe(0);
        });

        test('remove: false throws error', () => {
            expect(() => parse('.textad { remove: false; }')).toThrow(/remove.*true/i);
        });

        test('remove: yes throws error', () => {
            expect(() => parse('.textad { remove: yes; }')).toThrow(/remove.*true/i);
        });
    });

    describe('brace inside strings is ignored', () => {
        test('brace inside double-quoted string is not treated as structural', () => {
            // A selector with content containing braces inside quotes
            const source = 'div[data-x="{"] { padding: 0; }';
            expect(parse(source)).toBe(true);
            const d = ctx.data;

            // The brace inside quotes must not be the matched open brace
            expect(sl(source, d, 0, CSS_INJ_DL_SOURCE_START, CSS_INJ_DL_SOURCE_END)).toBe('padding: 0;');
        });

        test('brace inside single-quoted string is not treated as structural', () => {
            const source = "div[data-x='{'] { padding: 0; }";
            expect(parse(source)).toBe(true);
            const d = ctx.data;

            expect(sl(source, d, 0, CSS_INJ_DL_SOURCE_START, CSS_INJ_DL_SOURCE_END)).toBe('padding: 0;');
        });
    });

    describe('required=false (disambiguation mode)', () => {
        test('returns false when no brace and required=false', () => {
            expect(parse('abp-snippet', 0, false)).toBe(false);
        });

        test('returns true when brace exists and required=false', () => {
            const source = 'body { padding: 0; }';
            expect(parse(source, 0, false)).toBe(true);

            expect(sl(source, ctx.data, 0, CSS_INJ_SL_SOURCE_START, CSS_INJ_SL_SOURCE_END)).toBe('body');
        });

        test('@media always commits even with required=false', () => {
            const source = '@media screen { body { padding: 0; } }';
            expect(parse(source, 0, false)).toBe(true);

            expect(ctx.data[CSS_INJ_FLAGS] & CSS_INJ_FLAG_HAS_MEDIA).toBe(CSS_INJ_FLAG_HAS_MEDIA);
        });
    });

    describe('error cases', () => {
        test('empty selector list throws', () => {
            expect(() => parse('{ padding: 0; }')).toThrow(/selector/i);
        });

        test('empty declaration list throws', () => {
            expect(() => parse('body { }')).toThrow(/declaration/i);
        });

        test('no opening brace throws', () => {
            expect(() => parse('body padding: 0;')).toThrow(/brace|\{/i);
        });

        test('empty media query list throws', () => {
            expect(() => parse('@media { body { padding: 0; } }')).toThrow(/media query/i);
        });

        test('body with no braces (would-be snippet) throws', () => {
            expect(() => parse('abp-snippet')).toThrow(/brace|\{/i);
        });
    });

    describe('dataOffset support', () => {
        test('writes at non-zero dataOffset', () => {
            const source = 'body { padding: 0; }';
            const offset = 10;
            expect(parse(source, offset)).toBe(true);
            const d = ctx.data;

            expect(sl(source, d, offset, CSS_INJ_SL_SOURCE_START, CSS_INJ_SL_SOURCE_END)).toBe('body');
            expect(sl(source, d, offset, CSS_INJ_DL_SOURCE_START, CSS_INJ_DL_SOURCE_END)).toBe('padding: 0;');
        });
    });

    describe('unused import guard', () => {
        // These are imported to ensure they compile (linter check)
        test('token index constants are numbers', () => {
            expect(typeof CSS_INJ_SL_START_TI).toBe('number');
            expect(typeof CSS_INJ_SL_END_TI).toBe('number');
            expect(typeof CSS_INJ_OPEN_BRACE_TI).toBe('number');
            expect(typeof CSS_INJ_CLOSE_BRACE_TI).toBe('number');
            expect(typeof CSS_INJ_DL_START_TI).toBe('number');
            expect(typeof CSS_INJ_DL_END_TI).toBe('number');
        });
    });
});
