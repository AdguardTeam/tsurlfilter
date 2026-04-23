import { describe, expect, test } from 'vitest';

import { AdblockSyntaxError } from '../../../src/errors/adblock-syntax-error';
import { createParserContext, initParserContext } from '../../../src/parser/context';
import { CssAtRuleParser } from '../../../src/parser/css/atrule';
import { AT_MIN_DATA_SLOTS, AT_NO_VALUE } from '../../../src/parser/css/atrule/constants';
import { Tokenizer } from '../../../src/tokenizer/tokenizer';

/**
 * Helper to parse a CSS at-rule and return extracted header values.
 *
 * @param input CSS at-rule source string.
 * @param baseOffset Optional base offset for the source string.
 *
 * @returns Extracted header values from the parser.
 */
function parseAtRule(input: string, baseOffset = 0) {
    const tokenizer = new Tokenizer(512);
    const ctx = createParserContext(512);

    if (ctx.data.length < AT_MIN_DATA_SLOTS) {
        ctx.data = new Int32Array(AT_MIN_DATA_SLOTS);
    }

    tokenizer.setSource(input, 0);
    initParserContext(ctx, input, tokenizer, baseOffset);

    const dataOffset = 0;
    CssAtRuleParser.parse(ctx, 0, ctx.tokenCount, dataOffset);

    return {
        sourceStart: CssAtRuleParser.sourceStart(ctx.data, dataOffset),
        nameSourceStart: CssAtRuleParser.nameSourceStart(ctx.data, dataOffset),
        nameSourceEnd: CssAtRuleParser.nameSourceEnd(ctx.data, dataOffset),
        nameStartTi: CssAtRuleParser.nameStartTi(ctx.data, dataOffset),
        nameEndTi: CssAtRuleParser.nameEndTi(ctx.data, dataOffset),
        preludeSourceStart: CssAtRuleParser.preludeSourceStart(ctx.data, dataOffset),
        preludeSourceEnd: CssAtRuleParser.preludeSourceEnd(ctx.data, dataOffset),
        preludeStartTi: CssAtRuleParser.preludeStartTi(ctx.data, dataOffset),
        preludeEndTi: CssAtRuleParser.preludeEndTi(ctx.data, dataOffset),
        openBracePos: CssAtRuleParser.openBracePos(ctx.data, dataOffset),
        openBraceTi: CssAtRuleParser.openBraceTi(ctx.data, dataOffset),
        closeBracePos: CssAtRuleParser.closeBracePos(ctx.data, dataOffset),
        closeBraceTi: CssAtRuleParser.closeBraceTi(ctx.data, dataOffset),
        blockStartTi: CssAtRuleParser.blockStartTi(ctx.data, dataOffset),
        blockEndTi: CssAtRuleParser.blockEndTi(ctx.data, dataOffset),
    };
}

describe('CssAtRuleParser', () => {
    describe('valid block at-rules', () => {
        test('@media with parenthesized prelude', () => {
            const input = '@media (min-width: 400px) { div { padding: 0; } }';
            const r = parseAtRule(input);

            expect(r.sourceStart).toBe(0);
            expect(input.slice(r.nameSourceStart, r.nameSourceEnd)).toBe('media');
            expect(input.slice(r.preludeSourceStart, r.preludeSourceEnd)).toBe('(min-width: 400px)');
            expect(input[r.openBracePos]).toBe('{');
            expect(input[r.closeBracePos]).toBe('}');
            // Block content should not be -1
            expect(r.blockStartTi).not.toBe(AT_NO_VALUE);
            expect(r.blockEndTi).not.toBe(AT_NO_VALUE);
        });

        test('@media with compound media query', () => {
            const input = '@media (min-height: 1024px) and (max-height: 1920px) { body { padding: 0; } }';
            const r = parseAtRule(input);

            expect(input.slice(r.nameSourceStart, r.nameSourceEnd)).toBe('media');
            expect(input.slice(r.preludeSourceStart, r.preludeSourceEnd))
                .toBe('(min-height: 1024px) and (max-height: 1920px)');
            expect(input[r.openBracePos]).toBe('{');
            expect(input[r.closeBracePos]).toBe('}');
        });

        test('@media with simple ident prelude', () => {
            const input = '@media screen { .cls { color: red; } }';
            const r = parseAtRule(input);

            expect(input.slice(r.nameSourceStart, r.nameSourceEnd)).toBe('media');
            expect(input.slice(r.preludeSourceStart, r.preludeSourceEnd)).toBe('screen');
        });

        test('@supports with feature query', () => {
            const input = '@supports (display: grid) { div { display: grid; } }';
            const r = parseAtRule(input);

            expect(input.slice(r.nameSourceStart, r.nameSourceEnd)).toBe('supports');
            expect(input.slice(r.preludeSourceStart, r.preludeSourceEnd)).toBe('(display: grid)');
            expect(input[r.openBracePos]).toBe('{');
        });

        test('empty block', () => {
            const input = '@media screen { }';
            const r = parseAtRule(input);

            expect(input.slice(r.nameSourceStart, r.nameSourceEnd)).toBe('media');
            expect(input.slice(r.preludeSourceStart, r.preludeSourceEnd)).toBe('screen');
            expect(input[r.openBracePos]).toBe('{');
            expect(input[r.closeBracePos]).toBe('}');
            // Empty block: blockStartTi >= blockEndTi
            expect(r.blockStartTi).toBeGreaterThanOrEqual(r.blockEndTi);
        });

        test('no whitespace after name: @media(min-width:0) { div { color: red; } }', () => {
            const input = '@media(min-width:0) { div { color: red; } }';
            const r = parseAtRule(input);

            expect(input.slice(r.nameSourceStart, r.nameSourceEnd)).toBe('media');
            expect(input.slice(r.preludeSourceStart, r.preludeSourceEnd)).toBe('(min-width:0)');
        });

        test('nested braces in block with strings', () => {
            const input = '@media screen { div { content: "}"; color: red; } }';
            const r = parseAtRule(input);

            expect(input.slice(r.nameSourceStart, r.nameSourceEnd)).toBe('media');
            expect(input[r.openBracePos]).toBe('{');
            // The closing brace should be the LAST `}` (outer one)
            expect(r.closeBracePos).toBe(input.lastIndexOf('}'));
        });

        test('multiple rules in block', () => {
            const input = '@media screen { div { color: red; } p { margin: 0; } }';
            const r = parseAtRule(input);

            expect(input.slice(r.nameSourceStart, r.nameSourceEnd)).toBe('media');
            // Block content spans both rules
            expect(r.blockStartTi).not.toBe(AT_NO_VALUE);
        });

        test('whitespace-only prelude treated as absent', () => {
            const input = '@media   { div { color: red; } }';
            const r = parseAtRule(input);

            expect(input.slice(r.nameSourceStart, r.nameSourceEnd)).toBe('media');
            // Prelude is whitespace-only → absent
            expect(r.preludeSourceStart).toBe(AT_NO_VALUE);
            expect(r.preludeSourceEnd).toBe(AT_NO_VALUE);
        });
    });

    describe('valid statement at-rules', () => {
        test('@charset with string prelude', () => {
            const input = '@charset "UTF-8";';
            const r = parseAtRule(input);

            expect(input.slice(r.nameSourceStart, r.nameSourceEnd)).toBe('charset');
            // Prelude should include the quotes
            expect(r.preludeSourceStart).not.toBe(AT_NO_VALUE);
            // No block
            expect(r.openBracePos).toBe(AT_NO_VALUE);
            expect(r.closeBracePos).toBe(AT_NO_VALUE);
            expect(r.blockStartTi).toBe(AT_NO_VALUE);
            expect(r.blockEndTi).toBe(AT_NO_VALUE);
        });

        test('@import with url prelude', () => {
            const input = '@import url("styles.css");';
            const r = parseAtRule(input);

            expect(input.slice(r.nameSourceStart, r.nameSourceEnd)).toBe('import');
            expect(r.openBracePos).toBe(AT_NO_VALUE);
        });
    });

    describe('composition with CssRuleParser', () => {
        test('block content can be passed to CssRuleParser', () => {
            // This test verifies the token ranges are correct for sub-parsing
            const input = '@media (min-width: 400px) { div { padding: 0; } }';
            const tokenizer = new Tokenizer(512);
            const ctx = createParserContext(512);

            if (ctx.data.length < AT_MIN_DATA_SLOTS) {
                ctx.data = new Int32Array(AT_MIN_DATA_SLOTS);
            }

            tokenizer.setSource(input, 0);
            initParserContext(ctx, input, tokenizer, 0);

            const dataOffset = 0;
            CssAtRuleParser.parse(ctx, 0, ctx.tokenCount, dataOffset);

            const blockStartTi = CssAtRuleParser.blockStartTi(ctx.data, dataOffset);
            const blockEndTi = CssAtRuleParser.blockEndTi(ctx.data, dataOffset);

            // Block content tokens should span "div { padding: 0; }"
            expect(blockStartTi).not.toBe(AT_NO_VALUE);
            expect(blockEndTi).not.toBe(AT_NO_VALUE);
            expect(blockStartTi).toBeLessThan(blockEndTi);
        });
    });

    describe('error handling', () => {
        test('missing @ at start', () => {
            const input = 'media screen { }';
            expect(() => parseAtRule(input)).toThrow(AdblockSyntaxError);
            expect(() => parseAtRule(input)).toThrow('Expected "@"');
        });

        test('missing name after @', () => {
            const input = '@ { }';
            expect(() => parseAtRule(input)).toThrow(AdblockSyntaxError);
            expect(() => parseAtRule(input)).toThrow('Expected at-rule name');
        });

        test('unclosed block', () => {
            const input = '@media screen { div { padding: 0; }';
            expect(() => parseAtRule(input)).toThrow(AdblockSyntaxError);
            expect(() => parseAtRule(input)).toThrow('expected "}"');
        });

        test('only @', () => {
            const input = '@';
            expect(() => parseAtRule(input)).toThrow(AdblockSyntaxError);
            expect(() => parseAtRule(input)).toThrow('Expected at-rule name');
        });
    });

    describe('non-zero dataOffset', () => {
        test('results are correctly offset', () => {
            const input = '@media screen { div { color: red; } }';
            const tokenizer = new Tokenizer(512);
            const ctx = createParserContext(512);
            const dataOffset = 10;

            if (ctx.data.length < dataOffset + AT_MIN_DATA_SLOTS) {
                ctx.data = new Int32Array(dataOffset + AT_MIN_DATA_SLOTS);
            }

            tokenizer.setSource(input, 0);
            initParserContext(ctx, input, tokenizer, 0);

            CssAtRuleParser.parse(ctx, 0, ctx.tokenCount, dataOffset);

            expect(CssAtRuleParser.sourceStart(ctx.data, dataOffset)).toBe(0);
            expect(input.slice(
                CssAtRuleParser.nameSourceStart(ctx.data, dataOffset),
                CssAtRuleParser.nameSourceEnd(ctx.data, dataOffset),
            )).toBe('media');
        });
    });
});
