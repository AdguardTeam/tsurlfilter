import { describe, expect, test } from 'vitest';

import { RuleParserPipeline } from '../../../src/ast-builder/rule-parser';
import type { ElementHidingRule, JsInjectionRule } from '../../../src/nodes';
import { ValueKind } from '../../../src/nodes';

const parser = new RuleParserPipeline();

describe('Cosmetic rule body Raw nodes', () => {
    test('element hiding selectorList is Raw with CssSelector kind', () => {
        const ast = parser.parse('example.com##.banner') as ElementHidingRule;
        expect(ast.body.selectorList.type).toBe('Raw');
        expect(ast.body.selectorList.kind).toBe(ValueKind.CssSelector);
        expect(ast.body.selectorList.value).toBe('.banner');
    });

    test('JS injection body is Raw with JavaScript kind', () => {
        const ast = parser.parse('example.com#%#alert(1)') as JsInjectionRule;
        expect(ast.body.type).toBe('Raw');
        expect(ast.body.kind).toBe(ValueKind.JavaScript);
        expect(ast.body.value).toBe('alert(1)');
    });
});
