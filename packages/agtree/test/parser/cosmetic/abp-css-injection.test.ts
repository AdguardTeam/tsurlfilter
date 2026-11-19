import { describe, expect, test } from 'vitest';

import { RuleParserPipeline } from '../../../src/ast-builder/rule-parser';
import type { CssInjectionRule, ElementHidingRule } from '../../../src/nodes';
import { ValueKind } from '../../../src/nodes';

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
            expect(ast.body.declarationList).toMatchObject({
                type: 'Raw',
                value: 'color:red',
                kind: ValueKind.CssDeclaration,
            });
        });

        test.each([
            '##div[data-v="{"]',
            '##div[data-v="{"] .ad',
        ])('%s → element hiding', (rule) => {
            const ast = parser.parse(rule) as ElementHidingRule;

            expect(ast.type).toBe('ElementHidingRule');
        });
    });

    describe('control cases', () => {
        test('plain quoted attribute value still parses as CSS injection', () => {
            const ast = parser.parse('##div[data-v="x"] {color:red}') as CssInjectionRule;

            expect(ast.type).toBe('CssInjectionRule');
            expect(ast.body.declarationList).toMatchObject({
                type: 'Raw',
                value: 'color:red',
                kind: ValueKind.CssDeclaration,
            });
        });
    });
});
