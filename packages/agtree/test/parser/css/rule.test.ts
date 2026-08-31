import { describe, expect, test } from 'vitest';

import { AdblockSyntaxError } from '../../../src/errors/adblock-syntax-error';
import { createParserContext, initParserContext } from '../../../src/parser/context';
import { CssRuleParser } from '../../../src/parser/css/rule';
import { CR_MIN_DATA_SLOTS } from '../../../src/parser/css/rule/constants';
import { Tokenizer } from '../../../src/tokenizer/tokenizer';

/**
 * Helper to parse a CSS rule and return extracted header values.
 *
 * @param input CSS rule source string.
 * @param baseOffset Optional base offset for the source string.
 *
 * @returns Extracted header values from the parser.
 */
function parseRule(input: string, baseOffset = 0) {
    const tokenizer = new Tokenizer(512);
    const ctx = createParserContext(512);

    // Ensure data buffer is large enough
    if (ctx.data.length < CR_MIN_DATA_SLOTS) {
        ctx.data = new Int32Array(CR_MIN_DATA_SLOTS);
    }

    tokenizer.setSource(input, 0);
    initParserContext(ctx, input, tokenizer, baseOffset);

    const dataOffset = 0;
    CssRuleParser.parse(ctx, 0, ctx.tokenCount, dataOffset);

    return {
        slSourceStart: CssRuleParser.selectorListSourceStart(ctx.data, dataOffset),
        slSourceEnd: CssRuleParser.selectorListSourceEnd(ctx.data, dataOffset),
        slStartTi: CssRuleParser.selectorListStartTi(ctx.data, dataOffset),
        slEndTi: CssRuleParser.selectorListEndTi(ctx.data, dataOffset),
        openBraceSourcePos: CssRuleParser.openBraceSourcePos(ctx.data, dataOffset),
        openBraceTi: CssRuleParser.openBraceTi(ctx.data, dataOffset),
        closeBraceSourcePos: CssRuleParser.closeBraceSourcePos(ctx.data, dataOffset),
        closeBraceTi: CssRuleParser.closeBraceTi(ctx.data, dataOffset),
        dlSourceStart: CssRuleParser.declListSourceStart(ctx.data, dataOffset),
        dlSourceEnd: CssRuleParser.declListSourceEnd(ctx.data, dataOffset),
        dlStartTi: CssRuleParser.declListStartTi(ctx.data, dataOffset),
        dlEndTi: CssRuleParser.declListEndTi(ctx.data, dataOffset),
    };
}

describe('CssRuleParser', () => {
    describe('valid rules', () => {
        test('simple rule: div { color: red; }', () => {
            const input = 'div { color: red; }';
            const result = parseRule(input);

            // Selector list: "div"
            expect(input.slice(result.slSourceStart, result.slSourceEnd)).toBe('div');

            // Open brace
            expect(input[result.openBraceSourcePos]).toBe('{');

            // Close brace
            expect(input[result.closeBraceSourcePos]).toBe('}');

            // Declaration list: "color: red;"
            expect(input.slice(result.dlSourceStart, result.dlSourceEnd)).toBe('color: red;');
        });

        test('no whitespace: .banner{display:none!important;}', () => {
            const input = '.banner{display:none!important;}';
            const result = parseRule(input);

            expect(input.slice(result.slSourceStart, result.slSourceEnd)).toBe('.banner');
            expect(input[result.openBraceSourcePos]).toBe('{');
            expect(input[result.closeBraceSourcePos]).toBe('}');
            expect(input.slice(result.dlSourceStart, result.dlSourceEnd)).toBe('display:none!important;');
        });

        test('empty block: div { }', () => {
            const input = 'div { }';
            const result = parseRule(input);

            expect(input.slice(result.slSourceStart, result.slSourceEnd)).toBe('div');
            // Empty declaration list: start === end
            expect(result.dlSourceStart).toBe(result.dlSourceEnd);
        });

        test('multiple selectors and declarations', () => {
            const input = 'p > a, .foo:hover { color: blue; text-decoration: underline; }';
            const result = parseRule(input);

            expect(input.slice(result.slSourceStart, result.slSourceEnd)).toBe('p > a, .foo:hover');
            expect(input.slice(result.dlSourceStart, result.dlSourceEnd))
                .toBe('color: blue; text-decoration: underline;');
        });

        test('braces inside :contains() parentheses', () => {
            const input = String.raw`p:contains(/\d{0,3}/) { color: red; }`;
            const result = parseRule(input);

            // The parser must NOT treat {0,3} as the block opener (they are
            // in the selector region and never touched by the backward scanner)
            expect(input.slice(result.slSourceStart, result.slSourceEnd))
                .toBe(String.raw`p:contains(/\d{0,3}/)`);
            expect(input.slice(result.dlSourceStart, result.dlSourceEnd)).toBe('color: red;');
        });

        test('unbalanced braces inside :contains() parens', () => {
            const input = 'head > style:contains(body{background: #410e13) { display: none; }';
            const result = parseRule(input);

            expect(input.slice(result.slSourceStart, result.slSourceEnd))
                .toBe('head > style:contains(body{background: #410e13)');
            expect(input.slice(result.dlSourceStart, result.dlSourceEnd)).toBe('display: none;');
        });

        test('closing brace inside declaration string value', () => {
            const input = 'div { content: "}"; color: red; }';
            const result = parseRule(input);

            expect(input.slice(result.slSourceStart, result.slSourceEnd)).toBe('div');
            expect(input.slice(result.dlSourceStart, result.dlSourceEnd))
                .toBe('content: "}"; color: red;');
        });

        test('opening brace inside declaration string value', () => {
            const input = 'div { content: "{"; color: red; }';
            const result = parseRule(input);

            expect(input.slice(result.slSourceStart, result.slSourceEnd)).toBe('div');
            expect(input.slice(result.dlSourceStart, result.dlSourceEnd))
                .toBe('content: "{"; color: red;');
        });

        test('both braces inside declaration string value', () => {
            const input = 'div { content: "{ }"; color: red; }';
            const result = parseRule(input);

            expect(input.slice(result.slSourceStart, result.slSourceEnd)).toBe('div');
            expect(input.slice(result.dlSourceStart, result.dlSourceEnd))
                .toBe('content: "{ }"; color: red;');
        });

        test('single-quoted braces inside declaration string value', () => {
            const input = "div { content: '{ }'; color: red; }";
            const result = parseRule(input);

            expect(input.slice(result.slSourceStart, result.slSourceEnd)).toBe('div');
            expect(input.slice(result.dlSourceStart, result.dlSourceEnd))
                .toBe("content: '{ }'; color: red;");
        });

        test('whitespace trimming: leading/trailing whitespace', () => {
            const input = '  div  {  color: red;  }  ';
            const result = parseRule(input);

            expect(input.slice(result.slSourceStart, result.slSourceEnd)).toBe('div');
            expect(input.slice(result.dlSourceStart, result.dlSourceEnd)).toBe('color: red;');
        });

        test('declaration without trailing semicolon', () => {
            const input = '#consent-modal { display: none !important }';
            const result = parseRule(input);

            expect(input.slice(result.slSourceStart, result.slSourceEnd)).toBe('#consent-modal');
            expect(input.slice(result.dlSourceStart, result.dlSourceEnd))
                .toBe('display: none !important');
        });

        test('regex with braces and parens in :contains()', () => {
            const input = String.raw`p:contains(/(foo|bar)\d{0,3}/) { color: red; }`;
            const result = parseRule(input);

            expect(input.slice(result.slSourceStart, result.slSourceEnd))
                .toBe(String.raw`p:contains(/(foo|bar)\d{0,3}/)`);
            expect(input.slice(result.dlSourceStart, result.dlSourceEnd)).toBe('color: red;');
        });
    });

    describe('accessor helpers', () => {
        test('all accessors return correct values for: div { color: red; }', () => {
            const input = 'div { color: red; }';
            const result = parseRule(input);

            expect(result.slSourceStart).toBe(0);
            expect(result.slSourceEnd).toBe(3);
            expect(result.openBraceSourcePos).toBe(4);
            expect(result.closeBraceSourcePos).toBe(18);
            expect(result.dlSourceStart).toBe(6);
            expect(result.dlSourceEnd).toBe(17);
        });
    });

    describe('error cases', () => {
        test('no closing brace (backward scan immediately fails)', () => {
            expect(() => parseRule('div color: red;')).toThrow(AdblockSyntaxError);
            expect(() => parseRule('div color: red;')).toThrow('Expected closing "}"');
        });

        test('unclosed block (no closing brace)', () => {
            expect(() => parseRule('div { color: red;')).toThrow(AdblockSyntaxError);
            expect(() => parseRule('div { color: red;')).toThrow('Expected closing "}"');
        });

        test('no braces at all', () => {
            expect(() => parseRule('div color: red')).toThrow(AdblockSyntaxError);
            expect(() => parseRule('div color: red')).toThrow('Expected closing "}"');
        });

        test('empty selector list: { color: red; }', () => {
            expect(() => parseRule('{ color: red; }')).toThrow(AdblockSyntaxError);
            expect(() => parseRule('{ color: red; }')).toThrow('Empty selector list');
        });

        test('only whitespace before brace: "   { color: red; }"', () => {
            expect(() => parseRule('   { color: red; }')).toThrow(AdblockSyntaxError);
            expect(() => parseRule('   { color: red; }')).toThrow('Empty selector list');
        });
    });
});
