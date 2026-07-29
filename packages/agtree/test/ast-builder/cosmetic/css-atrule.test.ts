import { describe, expect, test } from 'vitest';

import { CssAtRuleAstBuilder, CssAtRulePipelineParser } from '../../../src/ast-builder/cosmetic/atrule';
import type { CssAtRule, CssAtRuleParseOptions } from '../../../src/nodes';
import { createParserContext, initParserContext } from '../../../src/parser/context';
import { CssAtRuleParser } from '../../../src/parser/css/atrule';
import { AT_MIN_DATA_SLOTS } from '../../../src/parser/css/atrule/constants';
import { Tokenizer } from '../../../src/tokenizer/tokenizer';

const TOKEN_CAPACITY = 512;

/**
 * Test helper: tokenize + structural parse + AST build for a CSS at-rule.
 *
 * @param raw Raw CSS at-rule string.
 * @param options Parse options.
 * @param baseOffset Starting offset within the original source.
 *
 * @returns CssAtRule AST node.
 */
function parseCssAtRule(
    raw: string,
    options: CssAtRuleParseOptions = {},
    baseOffset = 0,
): CssAtRule {
    const tokenizer = new Tokenizer(TOKEN_CAPACITY);
    tokenizer.setSource(raw, 0);

    const ctx = createParserContext(TOKEN_CAPACITY);
    if (ctx.data.length < AT_MIN_DATA_SLOTS) {
        ctx.data = new Int32Array(AT_MIN_DATA_SLOTS);
    }
    initParserContext(ctx, raw, tokenizer, 0);

    const dataOffset = 0;
    CssAtRuleParser.parse(ctx, 0, ctx.tokenCount, dataOffset);

    return CssAtRuleAstBuilder.parse(
        ctx,
        raw,
        ctx.data,
        dataOffset,
        baseOffset,
        baseOffset + raw.length,
        options,
    );
}

describe('CssAtRuleAstBuilder', () => {
    describe('block at-rule with prelude', () => {
        test('@media with parenthesized prelude', () => {
            const input = '@media (min-width: 400px) { div { color: red; } }';
            const result = parseCssAtRule(input);

            expect(result.type).toBe('CssAtRule');
            expect(result.start).toBe(0);
            expect(result.end).toBe(input.length);

            // Name
            expect(result.name.type).toBe('Value');
            expect(result.name.value).toBe('media');
            expect(result.name.start).toBe(1);
            expect(result.name.end).toBe(6);

            // Prelude
            expect(result.prelude).not.toBeNull();
            expect(result.prelude!.type).toBe('CssAtRulePrelude');
            if (result.prelude!.type === 'CssAtRulePrelude') {
                expect(result.prelude!.value).toBe('(min-width: 400px)');
            }

            // Block
            expect(result.block).not.toBeNull();
        });
    });

    describe('statement at-rule (no block)', () => {
        test('@charset with prelude, no block', () => {
            const input = '@charset "UTF-8";';
            const result = parseCssAtRule(input);

            expect(result.type).toBe('CssAtRule');
            expect(result.name.value).toBe('charset');

            // Prelude present
            expect(result.prelude).not.toBeNull();
            expect(result.prelude!.type).toBe('CssAtRulePrelude');
            if (result.prelude!.type === 'CssAtRulePrelude') {
                expect(result.prelude!.value).toBe('"UTF-8"');
            }

            // No block
            expect(result.block).toBeNull();
        });

        test('@foo; — name only, no prelude, no block', () => {
            const input = '@foo;';
            const result = parseCssAtRule(input);

            expect(result.type).toBe('CssAtRule');
            expect(result.name.value).toBe('foo');
            expect(result.prelude).toBeNull();
            expect(result.block).toBeNull();
        });
    });

    describe('parse options', () => {
        test('parsePrelude=false returns Raw prelude', () => {
            const input = '@media (min-width: 400px) { div { color: red; } }';
            const result = parseCssAtRule(input, { parsePrelude: false });

            expect(result.prelude).not.toBeNull();
            expect(result.prelude!.type).toBe('Raw');
            if (result.prelude!.type === 'Raw') {
                expect(result.prelude!.value).toBe('(min-width: 400px)');
            }
        });

        test('parseBlock=false returns Raw block', () => {
            const input = '@media screen { div { color: red; } }';
            const result = parseCssAtRule(input, { parseBlock: false });

            expect(result.block).not.toBeNull();
            expect(result.block!.type).toBe('Raw');
        });

        test('parseBlockRules=false returns Raw block body when block has content', () => {
            const input = '@media screen { div { color: red; } }';
            const result = parseCssAtRule(input, { parseBlockRules: false });

            expect(result.block).not.toBeNull();
            expect(result.block!.type).toBe('Raw');
            if (result.block!.type === 'Raw') {
                expect(result.block!.value).toContain('div');
            }
        });

        test('parseBlockRules=false with empty block returns CssBlock', () => {
            const input = '@media screen { }';
            const result = parseCssAtRule(input, { parseBlockRules: false });

            expect(result.block).not.toBeNull();
            expect(result.block!.type).toBe('CssBlock');
        });

        test('isLocIncluded=false omits start/end', () => {
            const input = '@media screen { div { color: red; } }';
            const result = parseCssAtRule(input, { isLocIncluded: false });

            expect(result.start).toBeUndefined();
            expect(result.end).toBeUndefined();
            expect(result.name.start).toBeUndefined();
            expect(result.name.end).toBeUndefined();
            if (result.prelude) {
                expect(result.prelude.start).toBeUndefined();
                expect(result.prelude.end).toBeUndefined();
            }
        });

        test('statement at-rule with parseBlock=true still returns null block', () => {
            const input = '@charset "UTF-8";';
            const result = parseCssAtRule(input, { parseBlock: true });

            expect(result.block).toBeNull();
        });
    });

    describe('legacy test data (from adg-css-injection.test.ts)', () => {
        test('@media with double-parenthesized media query', () => {
            // eslint-disable-next-line max-len
            const input = '@media ((min-width: 400px) and (max-width: 700px)) { div:has(> section[advert]) { padding-top: 0 !important; padding-bottom: 0 !important; } }';
            const result = parseCssAtRule(input);

            expect(result.type).toBe('CssAtRule');
            expect(result.name.value).toBe('media');

            expect(result.prelude).not.toBeNull();
            expect(result.prelude!.type).toBe('CssAtRulePrelude');
            if (result.prelude!.type === 'CssAtRulePrelude') {
                expect(result.prelude!.value).toBe('((min-width: 400px) and (max-width: 700px))');
            }

            expect(result.block).not.toBeNull();
        });

        test('@media with single-parenthesized media query and `and`', () => {
            // eslint-disable-next-line max-len
            const input = '@media (min-width: 400px) and (max-width: 700px) { div:has(> section[advert]) { padding-top: 0 !important; padding-bottom: 0 !important; } }';
            const result = parseCssAtRule(input);

            expect(result.type).toBe('CssAtRule');
            expect(result.name.value).toBe('media');

            expect(result.prelude).not.toBeNull();
            expect(result.prelude!.type).toBe('CssAtRulePrelude');
            if (result.prelude!.type === 'CssAtRulePrelude') {
                expect(result.prelude!.value).toBe('(min-width: 400px) and (max-width: 700px)');
            }

            expect(result.block).not.toBeNull();
        });

        test('@media with negated media query and string value in block', () => {
            const input = "@media not all and (hover: hover) { abbr::after { content: 'dummy'; } }";
            const result = parseCssAtRule(input);

            expect(result.type).toBe('CssAtRule');
            expect(result.name.value).toBe('media');

            expect(result.prelude).not.toBeNull();
            expect(result.prelude!.type).toBe('CssAtRulePrelude');
            if (result.prelude!.type === 'CssAtRulePrelude') {
                expect(result.prelude!.value).toBe('not all and (hover: hover)');
            }

            expect(result.block).not.toBeNull();
        });
    });

    describe('edge cases', () => {
        test('empty block: @media screen { }', () => {
            const input = '@media screen { }';
            const result = parseCssAtRule(input);

            expect(result.type).toBe('CssAtRule');
            expect(result.name.value).toBe('media');
            expect(result.prelude).not.toBeNull();
            expect(result.block).not.toBeNull();
        });

        test('block at-rule with no prelude: @font-face { font-family: MyFont; }', () => {
            const input = '@font-face { font-family: MyFont; }';
            const result = parseCssAtRule(input);

            expect(result.type).toBe('CssAtRule');
            expect(result.name.value).toBe('font-face');
            expect(result.prelude).toBeNull();
            expect(result.block).not.toBeNull();
        });

        test('shift: baseOffset shifts all locations', () => {
            const input = '@media screen { div { color: red; } }';
            const baseOffset = 100;
            const result = parseCssAtRule(input, {}, baseOffset);

            expect(result.start).toBe(baseOffset);
            expect(result.end).toBe(baseOffset + input.length);
            expect(result.name.start).toBe(baseOffset + 1);
            expect(result.name.end).toBe(baseOffset + 6);
        });
    });
});

describe('CssAtRulePipelineParser', () => {
    const parser = new CssAtRulePipelineParser();

    test('parse() produces same result as manual pipeline', () => {
        const input = '@media (min-width: 400px) { div { color: red; } }';
        const pipelineResult = parser.parse(input);
        const manualResult = parseCssAtRule(input);

        expect(pipelineResult.type).toBe(manualResult.type);
        expect(pipelineResult.name.value).toBe(manualResult.name.value);
        expect(pipelineResult.prelude?.type).toBe(manualResult.prelude?.type);
        expect(pipelineResult.block?.type).toBe(manualResult.block?.type);
    });

    test('parse() with statement at-rule', () => {
        const result = parser.parse('@charset "UTF-8";');

        expect(result.type).toBe('CssAtRule');
        expect(result.name.value).toBe('charset');
        expect(result.block).toBeNull();
    });

    test('parse() with options', () => {
        const result = parser.parse(
            '@media screen { div { color: red; } }',
            { isLocIncluded: false },
        );

        expect(result.start).toBeUndefined();
        expect(result.end).toBeUndefined();
    });

    test('parser reuses buffers across calls', () => {
        const result1 = parser.parse('@media screen { div { color: red; } }');
        const result2 = parser.parse('@charset "UTF-8";');

        expect(result1.type).toBe('CssAtRule');
        expect(result2.type).toBe('CssAtRule');
        expect(result2.block).toBeNull();
    });

    test('parseRange() parses at-rule from a pre-tokenized context', () => {
        const source = '@media screen { div { color: red; } }';

        const tokenizer = new Tokenizer(TOKEN_CAPACITY);
        tokenizer.setSource(source, 0);

        const ctx = createParserContext(TOKEN_CAPACITY);
        if (ctx.data.length < AT_MIN_DATA_SLOTS) {
            ctx.data = new Int32Array(AT_MIN_DATA_SLOTS);
        }
        initParserContext(ctx, source, tokenizer, 0);

        const result = parser.parseRange(ctx, 0, ctx.tokenCount, 0);

        expect(result.type).toBe('CssAtRule');
        expect(result.name.value).toBe('media');
        expect(result.prelude).not.toBeNull();
        expect(result.block).not.toBeNull();
        expect(result.start).toBe(0);
        expect(result.end).toBe(source.length);
    });
});
