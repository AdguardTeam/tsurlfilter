import { describe, expect, test } from 'vitest';

import { CssRuleAstBuilder } from '../../../src/ast-builder/cosmetic/rule';
import { AdblockSyntaxError } from '../../../src/errors/adblock-syntax-error';
import type { CssRule, CssRuleParseOptions } from '../../../src/nodes';
import { createParserContext, initParserContext } from '../../../src/parser/context';
import { CssRuleParser } from '../../../src/parser/css/rule';
import { CR_MIN_DATA_SLOTS } from '../../../src/parser/css/rule/constants';
import { Tokenizer } from '../../../src/tokenizer/tokenizer';

const TOKEN_CAPACITY = 512;

/**
 * Test helper: tokenize + parse + build AST from a raw CSS rule string.
 *
 * @param raw Raw CSS rule string.
 * @param options Parse options.
 * @param baseOffset Starting offset within the original source.
 *
 * @returns CssRule AST node.
 */
function parseCssRule(
    raw: string,
    options: CssRuleParseOptions = {},
    baseOffset = 0,
): CssRule {
    const tokenizer = new Tokenizer(TOKEN_CAPACITY);
    tokenizer.setSource(raw, 0);

    const ctx = createParserContext(TOKEN_CAPACITY);
    if (ctx.data.length < CR_MIN_DATA_SLOTS) {
        ctx.data = new Int32Array(CR_MIN_DATA_SLOTS);
    }
    initParserContext(ctx, raw, tokenizer, 0);

    const dataOffset = 0;
    CssRuleParser.parse(ctx, 0, ctx.tokenCount, dataOffset);

    return CssRuleAstBuilder.parse(
        ctx,
        raw,
        ctx.data,
        dataOffset,
        baseOffset,
        baseOffset + raw.length,
        options,
    );
}

describe('CssRuleAstBuilder (parser-new)', () => {
    describe('CssRuleAstBuilder.parse - valid cases', () => {
        test('simple rule produces correct AST structure', () => {
            const input = 'div { color: red; }';
            const result: CssRule = parseCssRule(input);

            expect(result.type).toBe('CssRule');
            expect(result.start).toBe(0);
            expect(result.end).toBe(input.length);

            // Prelude is a SelectorList
            expect(result.prelude.type).toBe('SelectorList');
            if (result.prelude.type === 'SelectorList') {
                expect(result.prelude.start).toBe(0);
                expect(result.prelude.end).toBe(3); // "div"
            }

            // Block is a CssBlock
            expect(result.block.type).toBe('CssBlock');
            if (result.block.type === 'CssBlock') {
                expect(result.block.start).toBe(4); // position of '{'
                expect(result.block.end).toBe(19); // position after '}'

                const dl = result.block.declarationList;
                expect(dl.type).toBe('CssDeclarationList');
                expect(dl.children).toHaveLength(1);
                expect(dl.children[0].property.value).toBe('color');
                expect(dl.children[0].value.value).toBe('red');
                expect(dl.children[0].important).toBe(false);
            }
        });

        test('multiple selectors and declarations', () => {
            const input = 'h1, h2 { color: blue; font-size: 2em; }';
            const result = parseCssRule(input);

            expect(result.type).toBe('CssRule');

            expect(result.prelude.type).toBe('SelectorList');
            if (result.prelude.type === 'SelectorList') {
                expect(result.prelude.children).toHaveLength(2);
            }

            expect(result.block.type).toBe('CssBlock');
            if (result.block.type === 'CssBlock') {
                const dl = result.block.declarationList;
                expect(dl.children).toHaveLength(2);
                expect(dl.children[0].property.value).toBe('color');
                expect(dl.children[0].value.value).toBe('blue');
                expect(dl.children[1].property.value).toBe('font-size');
                expect(dl.children[1].value.value).toBe('2em');
            }
        });

        test('empty declaration block: div { }', () => {
            const input = 'div { }';
            const result = parseCssRule(input);

            expect(result.type).toBe('CssRule');
            expect(result.block.type).toBe('CssBlock');
            if (result.block.type === 'CssBlock') {
                expect(result.block.declarationList.children).toHaveLength(0);
            }
        });

        test('!important declaration', () => {
            const input = '.banner { display: none !important; }';
            const result = parseCssRule(input);

            expect(result.block.type).toBe('CssBlock');
            if (result.block.type === 'CssBlock') {
                const decl = result.block.declarationList.children[0];
                expect(decl.property.value).toBe('display');
                expect(decl.value.value).toBe('none');
                expect(decl.important).toBe(true);
            }
        });

        test('no whitespace around braces: .x{display:none}', () => {
            const input = '.x{display:none}';
            const result = parseCssRule(input);

            expect(result.prelude.type).toBe('SelectorList');
            expect(result.block.type).toBe('CssBlock');
            if (result.block.type === 'CssBlock') {
                const decl = result.block.declarationList.children[0];
                expect(decl.property.value).toBe('display');
                expect(decl.value.value).toBe('none');
            }
        });

        test('isLocIncluded: false omits start/end fields', () => {
            const input = 'div { color: red; }';
            const result = parseCssRule(input, { isLocIncluded: false });

            expect(result.start).toBeUndefined();
            expect(result.end).toBeUndefined();
            expect(result.prelude.start).toBeUndefined();
            expect(result.prelude.end).toBeUndefined();
            expect(result.block.start).toBeUndefined();
            expect(result.block.end).toBeUndefined();
        });

        test('parsePrelude: false yields Raw prelude', () => {
            const input = 'div, p { color: red; }';
            const result = parseCssRule(input, { parsePrelude: false });

            expect(result.prelude.type).toBe('Raw');
            if (result.prelude.type === 'Raw') {
                expect(result.prelude.value).toBe('div, p');
            }
        });

        test('parseBlock: false yields Raw block', () => {
            const input = 'div { color: red; }';
            const result = parseCssRule(input, { parseBlock: false });

            expect(result.block.type).toBe('Raw');
            if (result.block.type === 'Raw') {
                expect(result.block.value).toBe('color: red;');
            }
        });

        test('baseOffset shifts all container node positions', () => {
            // 'div { color: red; }' has length 19.
            // With baseOffset=100:
            //   CssRule:             start=100, end=119
            //   SelectorList "div":  start=100, end=103
            //   CssBlock:            start=104, end=119  ('{ ... }' including braces)
            //   CssDeclarationList:  start=106, end=117
            const input = 'div { color: red; }';
            const baseOffset = 100;
            const result = parseCssRule(input, {}, baseOffset);

            // Rule itself
            expect(result.start).toBe(100);
            expect(result.end).toBe(119);

            // Prelude (SelectorList)
            expect(result.prelude.type).toBe('SelectorList');
            expect(result.prelude.start).toBe(100);
            expect(result.prelude.end).toBe(103);

            // Block (CssBlock)
            expect(result.block.type).toBe('CssBlock');
            expect(result.block.start).toBe(104); // position of '{'
            expect(result.block.end).toBe(119); // position after '}'

            // Declaration list inside the block
            if (result.block.type === 'CssBlock') {
                const dl = result.block.declarationList;
                expect(dl.start).toBe(106); // 'c' of 'color'
                expect(dl.end).toBe(117); // end of 'red;'
                // Container nodes (SelectorList, CssBlock, CssDeclarationList) have
                // their start/end shifted by baseOffset. Leaf nodes (TypeSelector,
                // CssDeclaration property/value) retain 0-based local offsets because
                // their sub-parsers receive an already-shifted ruleStart and build
                // positions relative to their own source slice.
                expect(dl.children[0].property.value).toBe('color');
                expect(dl.children[0].value.value).toBe('red');
            }
        });

        test('braces inside :contains() do not confuse block detection', () => {
            const input = String.raw`p:contains(/\d{0,3}/) { color: red; }`;
            const result = parseCssRule(input);

            expect(result.prelude.type).toBe('SelectorList');
            expect(result.block.type).toBe('CssBlock');
            if (result.block.type === 'CssBlock') {
                expect(result.block.declarationList.children).toHaveLength(1);
                expect(result.block.declarationList.children[0].property.value).toBe('color');
            }
        });

        test('closing brace inside string value', () => {
            const input = 'div { content: "}"; }';
            const result = parseCssRule(input);

            expect(result.block.type).toBe('CssBlock');
            if (result.block.type === 'CssBlock') {
                expect(result.block.declarationList.children[0].property.value).toBe('content');
            }
        });

        test('repeated calls reuse context correctly (no state leakage)', () => {
            const inputs = [
                'div { color: red; }',
                'h1 { font-size: 2em; }',
                '.foo, .bar { display: none; }',
            ];

            for (const input of inputs) {
                const result = parseCssRule(input);
                expect(result.type).toBe('CssRule');
                expect(result.start).toBe(0);
                expect(result.end).toBe(input.length);
            }
        });
    });

    describe('CssRuleAstBuilder.parse - error cases', () => {
        test('missing closing brace throws AdblockSyntaxError', () => {
            expect(() => parseCssRule('div { color: red;')).toThrow(AdblockSyntaxError);
        });

        test('no braces at all throws AdblockSyntaxError', () => {
            expect(() => parseCssRule('div color: red')).toThrow(AdblockSyntaxError);
        });

        test('empty selector throws AdblockSyntaxError', () => {
            expect(() => parseCssRule('   { color: red; }')).toThrow(AdblockSyntaxError);
        });
    });
});
