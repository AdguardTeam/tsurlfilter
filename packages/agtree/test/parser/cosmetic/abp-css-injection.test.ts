import { describe, expect, test } from 'vitest';

import { RuleParserPipeline } from '../../../src/ast-builder/rule-parser';
import type { CssInjectionRule, ElementHidingRule } from '../../../src/nodes';
import { ValueKind } from '../../../src/nodes';
import { CR_FLAG_BODY_ABP_CSS_INJECTION, CR_FLAGS_OFFSET } from '../../../src/parser/cosmetic/constants';
import { SYNTAX_ABP } from '../../../src/utils/syntax-flags';

const parser = new RuleParserPipeline();

describe('ABP CSS injection detection with brackets in quoted strings', () => {
    describe('brackets inside quoted attribute values', () => {
        test.each([
            '##div[data-v="["] {color:red}',
            '##div[data-v="]"] {color:red}',
            "##div[data-v='['] {color:red}",
            "##div[data-v=']'] {color:red}",
            '##div[data-v="a\\"[b"] {color:red}',
        ])('%s → CSS injection', (rule) => {
            const ast = parser.parse(rule) as CssInjectionRule;

            expect(ast.type).toBe('CssInjectionRule');
            expect(ast.syntax).toBe(SYNTAX_ABP);
            expect(ast.body.declarationList).toMatchObject({
                type: 'Raw',
                value: 'color:red',
                kind: ValueKind.CssDeclaration,
            });
        });
    });

    describe('brace inside a quoted attribute value', () => {
        test('brace in a quoted value does not open the declaration block', () => {
            const ast = parser.parse('##div[data-v="{"] {color:red}') as CssInjectionRule;

            expect(ast.type).toBe('CssInjectionRule');
            expect(ast.syntax).toBe(SYNTAX_ABP);
            expect(ast.body.declarationList).toMatchObject({
                type: 'Raw',
                value: 'color:red',
                kind: ValueKind.CssDeclaration,
            });
        });

        test.each([
            ['##div[data-v="{"]', 'div[data-v="{"]'],
            ['##div[data-v="{"] .ad', 'div[data-v="{"] .ad'],
        ])('%s → element hiding', (rule, selector) => {
            const ast = parser.parse(rule) as ElementHidingRule;

            expect(ast.type).toBe('ElementHidingRule');
            expect(ast.body.selectorList).toMatchObject({ type: 'Raw', value: selector });
        });
    });

    describe('quotes outside attribute selectors', () => {
        test("##div:has-text(It's) {color:red} → CSS injection", () => {
            const ast = parser.parse("##div:has-text(It's) {color:red}") as CssInjectionRule;

            expect(ast.type).toBe('CssInjectionRule');
            expect(ast.syntax).toBe(SYNTAX_ABP);
            expect(ast.body.declarationList).toMatchObject({
                type: 'Raw',
                value: 'color:red',
                kind: ValueKind.CssDeclaration,
            });
        });

        test('a quote pair must not hide the real declaration brace', () => {
            // A quote outside an attribute selector is plain text. The second
            // apostrophe must not pair with the first one across the real
            // declaration-block brace.
            const rule = "##div:has-text(it's) {color:red; content:'x'}";
            const { ctx } = parser.parseStructural(rule);

            // eslint-disable-next-line no-bitwise
            expect(ctx.data[CR_FLAGS_OFFSET] & CR_FLAG_BODY_ABP_CSS_INJECTION)
                .toBe(CR_FLAG_BODY_ABP_CSS_INJECTION);
        });
    });

    describe('control cases', () => {
        test('plain quoted attribute value still parses as CSS injection', () => {
            const ast = parser.parse('##div[data-v="x"] {color:red}') as CssInjectionRule;

            expect(ast.type).toBe('CssInjectionRule');
            expect(ast.syntax).toBe(SYNTAX_ABP);
            expect(ast.body.declarationList).toMatchObject({
                type: 'Raw',
                value: 'color:red',
                kind: ValueKind.CssDeclaration,
            });
        });
    });
});
