import { describe, expect, test } from 'vitest';

import type { JsInjectionRule } from '../../../src/nodes-new';
import { RuleParser } from '../../../src/parser-new/rule-parser';

const parser = new RuleParser();

describe('RuleParser — ADG JS injection rules', () => {
    describe('valid JS injection rules', () => {
        test('basic JS injection', () => {
            const rule = 'example.com#%#let a = 2;';
            const ast = parser.parse(rule) as JsInjectionRule;

            expect(ast.type).toBe('JsInjectionRule');
            expect(ast.category).toBe('Cosmetic');
            expect(ast.syntax).toBe('AdGuard');
            expect(ast.exception).toBe(false);
            expect(ast.body.type).toBe('Value');
            expect(ast.body.value).toBe('let a = 2;');
        });

        test('exception JS injection rule', () => {
            const rule = 'example.com#@%#let a = 2;';
            const ast = parser.parse(rule) as JsInjectionRule;

            expect(ast.type).toBe('JsInjectionRule');
            expect(ast.exception).toBe(true);
            expect(ast.separator.value).toBe('#@%#');
            expect(ast.body.value).toBe('let a = 2;');
        });

        test('complex JS body', () => {
            const rule = "example.com#%#AG_onLoad(function() { alert('hi'); });";
            const ast = parser.parse(rule) as JsInjectionRule;

            expect(ast.type).toBe('JsInjectionRule');
            expect(ast.body.value).toBe("AG_onLoad(function() { alert('hi'); });");
        });

        test('no domain', () => {
            const rule = '#%#let x = 1;';
            const ast = parser.parse(rule) as JsInjectionRule;

            expect(ast.type).toBe('JsInjectionRule');
            expect(ast.domains.children).toHaveLength(0);
        });

        test('multiple domains', () => {
            const rule = 'example.com,example.org#%#let x = 1;';
            const ast = parser.parse(rule) as JsInjectionRule;

            expect(ast.domains.children).toHaveLength(2);
        });

        test('whitespace after separator is trimmed', () => {
            const rule = 'example.com#%# let a = 2;';
            const ast = parser.parse(rule) as JsInjectionRule;

            expect(ast.type).toBe('JsInjectionRule');
            expect(ast.body.value).toBe('let a = 2;');
        });
    });

    describe('dispatch: #%# with //scriptlet produces ScriptletInjectionRule, not JsInjectionRule', () => {
        test('#%#//scriptlet produces ScriptletInjectionRule', () => {
            const rule = "example.com#%#//scriptlet('foo')";
            const ast = parser.parse(rule);

            expect(ast.type).toBe('ScriptletInjectionRule');
        });

        test('#%# without //scriptlet produces JsInjectionRule', () => {
            const rule = 'example.com#%#var x = 1;';
            const ast = parser.parse(rule);

            expect(ast.type).toBe('JsInjectionRule');
        });
    });

    describe('dispatch: ## with +js produces ScriptletInjectionRule, not ElementHidingRule', () => {
        test('##+js(foo) is ScriptletInjectionRule', () => {
            const rule = 'example.com##+js(foo)';
            const ast = parser.parse(rule);

            expect(ast.type).toBe('ScriptletInjectionRule');
        });

        test('##.ad-banner is ElementHidingRule', () => {
            const rule = 'example.com##.ad-banner';
            const ast = parser.parse(rule);

            expect(ast.type).toBe('ElementHidingRule');
        });

        test('##script:inject(foo) is ScriptletInjectionRule', () => {
            const rule = 'example.com##script:inject(foo)';
            const ast = parser.parse(rule);

            expect(ast.type).toBe('ScriptletInjectionRule');
        });

        test('+jsnotascriptlet (no paren) falls through to element hiding', () => {
            const rule = 'example.com##+jsnotascriptlet';
            const ast = parser.parse(rule);

            expect(ast.type).toBe('ElementHidingRule');
        });
    });

    describe('dispatch: options gating', () => {
        test('parseUboSpecificRules=false throws for ##+js', () => {
            expect(() => {
                parser.parse('example.com##+js(foo)', { parseUboSpecificRules: false });
            }).toThrow(/uBO scriptlet rules are disabled/i);
        });

        test('parseAbpSpecificRules=false throws for #$#', () => {
            expect(() => {
                parser.parse('example.com#$#snippet0', { parseAbpSpecificRules: false });
            }).toThrow(/ABP snippet rules are disabled/i);
        });
    });

    describe('location info', () => {
        test('isLocIncluded on JS injection rule', () => {
            const rule = 'example.com#%#let a = 2;';
            const ast = parser.parse(rule, { isLocIncluded: true }) as JsInjectionRule;

            expect(ast.start).toBe(0);
            expect(ast.end).toBe(rule.length);
            expect(ast.body.start).toBeDefined();
            expect(ast.body.end).toBeDefined();
            expect(ast.separator.start).toBeDefined();
            expect(ast.separator.end).toBeDefined();
        });
    });

    describe('AdGuard modifier list with scriptlet/JS rules', () => {
        test('[$domain=example.com] with +js scriptlet', () => {
            const rule = '[$domain=example.com]example.org##+js(foo)';
            const ast = parser.parse(rule);

            expect(ast.type).toBe('ScriptletInjectionRule');
            expect((ast as any).modifiers).toBeDefined();
            expect((ast as any).modifiers.children).toHaveLength(1);
            expect((ast as any).modifiers.children[0].name.value).toBe('domain');
        });

        test('[$app=com.test] with ADG scriptlet', () => {
            const rule = "[$app=com.test]example.com#%#//scriptlet('bar')";
            const ast = parser.parse(rule);

            expect(ast.type).toBe('ScriptletInjectionRule');
            expect((ast as any).modifiers).toBeDefined();
        });

        test('[$domain=example.com] with JS injection', () => {
            const rule = '[$domain=example.com]example.org#%#let x = 1;';
            const ast = parser.parse(rule);

            expect(ast.type).toBe('JsInjectionRule');
            expect((ast as any).modifiers).toBeDefined();
        });
    });
});
