import { describe, expect, test } from 'vitest';

import { RuleParserPipeline } from '../../../src/ast-builder/rule-parser';
import type { CssDeclarationList, CssInjectionRule, SelectorList } from '../../../src/nodes';
import { ValueKind } from '../../../src/nodes';
import { SYNTAX_ADG } from '../../../src/utils/syntax-flags';

const parser = new RuleParserPipeline();

describe('RuleParser — ADG CSS injection rules', () => {
    describe('plain CSS injection (no @media)', () => {
        test('no domain: #$#body { padding: 0; }', () => {
            const ast = parser.parse('#$#body { padding: 0; }') as CssInjectionRule;

            expect(ast.type).toBe('CssInjectionRule');
            expect(ast.category).toBe('Cosmetic');
            expect(ast.syntax).toBe(SYNTAX_ADG);
            expect(ast.exception).toBe(false);
            expect(ast.separator.value).toBe('#$#');
            expect(ast.domains.children).toHaveLength(0);
            expect(ast.body.type).toBe('CssInjectionRuleBody');
            expect(ast.body.selectorList).toMatchObject({ type: 'Raw', value: 'body', kind: ValueKind.CssSelector });
            // eslint-disable-next-line max-len
            expect(ast.body.declarationList).toMatchObject({ type: 'Raw', value: 'padding: 0;', kind: ValueKind.CssDeclaration });
            expect(ast.body.mediaQueryList).toBeUndefined();
            expect(ast.body.remove).toBeUndefined();
        });

        test('exception rule: #@$#body { padding: 0; }', () => {
            const ast = parser.parse('#@$#body { padding: 0; }') as CssInjectionRule;

            expect(ast.type).toBe('CssInjectionRule');
            expect(ast.exception).toBe(true);
            expect(ast.separator.value).toBe('#@$#');
            expect(ast.body.selectorList).toMatchObject({ type: 'Raw', value: 'body', kind: ValueKind.CssSelector });
            // eslint-disable-next-line max-len
            expect(ast.body.declarationList).toMatchObject({ type: 'Raw', value: 'padding: 0;', kind: ValueKind.CssDeclaration });
        });

        test('with domains: example.com,~example.net#$#body { padding: 0; }', () => {
            const ast = parser.parse(
                'example.com,~example.net#$#body { padding: 0; }',
            ) as CssInjectionRule;

            expect(ast.type).toBe('CssInjectionRule');
            expect(ast.exception).toBe(false);
            expect(ast.domains.children).toHaveLength(2);
            expect(ast.separator.value).toBe('#$#');
            expect(ast.body.selectorList).toMatchObject({ type: 'Raw', value: 'body', kind: ValueKind.CssSelector });
            // eslint-disable-next-line max-len
            expect(ast.body.declarationList).toMatchObject({ type: 'Raw', value: 'padding: 0;', kind: ValueKind.CssDeclaration });
        });

        test('domains + exception: example.com,~example.net#@$#body { padding: 0; }', () => {
            const ast = parser.parse(
                'example.com,~example.net#@$#body { padding: 0; }',
            ) as CssInjectionRule;

            expect(ast.type).toBe('CssInjectionRule');
            expect(ast.exception).toBe(true);
            expect(ast.separator.value).toBe('#@$#');
            expect(ast.domains.children).toHaveLength(2);
        });
    });

    describe('CSS injection with @media', () => {
        test('no domain, @media variant', () => {
            const rule = '#$#@media (min-height: 1024px) and (max-height: 1920px) { body { padding: 0; } }';
            const ast = parser.parse(rule) as CssInjectionRule;

            expect(ast.type).toBe('CssInjectionRule');
            expect(ast.body.mediaQueryList).toBeDefined();
            expect(ast.body.mediaQueryList!.value).toBe(
                '(min-height: 1024px) and (max-height: 1920px)',
            );
            expect(ast.body.selectorList).toMatchObject({ type: 'Raw', value: 'body', kind: ValueKind.CssSelector });
            // eslint-disable-next-line max-len
            expect(ast.body.declarationList).toMatchObject({ type: 'Raw', value: 'padding: 0;', kind: ValueKind.CssDeclaration });
        });

        test('with domains + @media', () => {
            const rule = 'example.com,~example.net#$#'
                + '@media (min-height: 1024px) and (max-height: 1920px) { body { padding: 0; } }';
            const ast = parser.parse(rule) as CssInjectionRule;

            expect(ast.type).toBe('CssInjectionRule');
            expect(ast.domains.children).toHaveLength(2);
            expect(ast.body.mediaQueryList).toBeDefined();
            expect(ast.body.mediaQueryList!.value).toBe(
                '(min-height: 1024px) and (max-height: 1920px)',
            );
            expect(ast.body.selectorList).toMatchObject({ type: 'Raw', value: 'body', kind: ValueKind.CssSelector });
        });
    });

    describe('extended CSS injection (#$?# / #@$?#)', () => {
        test('no domain: #$?#body:-abp-has(.ad) { padding: 0; }', () => {
            const ast = parser.parse(
                '#$?#body:-abp-has(.ad) { padding: 0; }',
            ) as CssInjectionRule;

            expect(ast.type).toBe('CssInjectionRule');
            expect(ast.separator.value).toBe('#$?#');
            expect(ast.body.selectorList).toMatchObject({
                type: 'Raw',
                value: 'body:-abp-has(.ad)',
                kind: ValueKind.CssSelector,
            });
            // eslint-disable-next-line max-len
            expect(ast.body.declarationList).toMatchObject({ type: 'Raw', value: 'padding: 0;', kind: ValueKind.CssDeclaration });
        });

        test('exception: #@$?#body:-abp-has(.ad) { padding: 0; }', () => {
            const ast = parser.parse(
                '#@$?#body:-abp-has(.ad) { padding: 0; }',
            ) as CssInjectionRule;

            expect(ast.type).toBe('CssInjectionRule');
            expect(ast.exception).toBe(true);
            expect(ast.separator.value).toBe('#@$?#');
        });

        test('extended + @media', () => {
            const rule = '#$?#'
                + '@media (min-height: 1024px) and (max-height: 1920px) { body:-abp-has(.ad) { padding: 0; } }';
            const ast = parser.parse(rule) as CssInjectionRule;

            expect(ast.type).toBe('CssInjectionRule');
            expect(ast.body.mediaQueryList).toBeDefined();
            expect(ast.body.selectorList).toMatchObject({
                type: 'Raw',
                value: 'body:-abp-has(.ad)',
                kind: ValueKind.CssSelector,
            });
        });

        test('domains + extended', () => {
            const ast = parser.parse(
                'example.com,~example.net#$?#body:-abp-has(.ad) { padding: 0; }',
            ) as CssInjectionRule;

            expect(ast.type).toBe('CssInjectionRule');
            expect(ast.domains.children).toHaveLength(2);
            expect(ast.separator.value).toBe('#$?#');
        });

        test('domains + extended + @media', () => {
            const rule = 'example.com,~example.net#$?#'
                + '@media (min-height: 1024px) and (max-height: 1920px) { body:-abp-has(.ad) { padding: 0; } }';
            const ast = parser.parse(rule) as CssInjectionRule;

            expect(ast.type).toBe('CssInjectionRule');
            expect(ast.domains.children).toHaveLength(2);
            expect(ast.body.mediaQueryList).toBeDefined();
        });

        test('domains + extended exception + @media', () => {
            const rule = 'example.com,~example.net#@$?#'
                + '@media (min-height: 1024px) and (max-height: 1920px) { body:-abp-has(.ad) { padding: 0; } }';
            const ast = parser.parse(rule) as CssInjectionRule;

            expect(ast.type).toBe('CssInjectionRule');
            expect(ast.exception).toBe(true);
            expect(ast.separator.value).toBe('#@$?#');
        });
    });

    describe('remove: true', () => {
        test('basic remove rule', () => {
            const ast = parser.parse(
                'example.com#$#.ads { remove: true; }',
            ) as CssInjectionRule;

            expect(ast.type).toBe('CssInjectionRule');
            expect(ast.body.remove).toBe(true);
            expect(ast.body.declarationList).toBeUndefined();
            expect(ast.body.selectorList).toMatchObject({ type: 'Raw', value: '.ads', kind: ValueKind.CssSelector });
        });

        test('extended CSS remove rule', () => {
            const ast = parser.parse(
                '#$?#.ads:-abp-has(.inner) { remove: true; }',
            ) as CssInjectionRule;

            expect(ast.type).toBe('CssInjectionRule');
            expect(ast.body.remove).toBe(true);
            expect(ast.body.declarationList).toBeUndefined();
        });
    });

    describe('location info', () => {
        test('isLocIncluded: true', () => {
            const rule = '#$#body { padding: 0; }';
            const ast = parser.parse(rule, { isLocIncluded: true }) as CssInjectionRule;

            expect(ast.start).toBe(0);
            expect(ast.end).toBe(rule.length);

            // Separator: '#$#' starts at 0, ends at 3
            expect(ast.separator.start).toBe(0);
            expect(ast.separator.end).toBe(3);

            // Body spans from after separator to end
            expect(ast.body.start).toBeDefined();
            expect(ast.body.end).toBeDefined();

            // Selector list: 'body' starts at 3, ends at 7
            expect(ast.body.selectorList.start).toBe(3);
            expect(ast.body.selectorList.end).toBe(7);

            // Declaration list: 'padding: 0;' starts at 10, ends at 21
            expect(ast.body.declarationList).toBeDefined();
            expect(ast.body.declarationList!.start).toBe(10);
            expect(ast.body.declarationList!.end).toBe(21);
        });

        test('location info with domains', () => {
            const rule = 'example.com#$#body { padding: 0; }';
            const ast = parser.parse(rule, { isLocIncluded: true }) as CssInjectionRule;

            expect(ast.start).toBe(0);
            expect(ast.end).toBe(rule.length);

            // Separator: '#$#' starts at 11 (after 'example.com')
            expect(ast.separator.start).toBe(11);
            expect(ast.separator.end).toBe(14);
        });

        test('location info with @media', () => {
            const rule = '#$#@media (min-height: 1024px) { body { padding: 0; } }';
            const ast = parser.parse(rule, { isLocIncluded: true }) as CssInjectionRule;

            expect(ast.body.mediaQueryList).toBeDefined();
            expect(ast.body.mediaQueryList!.start).toBeDefined();
            expect(ast.body.mediaQueryList!.end).toBeDefined();
        });
    });

    describe('dispatch correctness', () => {
        test('#$# with braces produces CssInjectionRule, not ElementHidingRule', () => {
            const ast = parser.parse('#$#body { padding: 0; }');
            expect(ast.type).toBe('CssInjectionRule');
        });

        test('#$# without braces falls back to ABP snippet (ScriptletInjectionRule)', () => {
            const ast = parser.parse('#$#abp-snippet');
            expect(ast.type).toBe('ScriptletInjectionRule');
        });

        test('#$?# always produces CssInjectionRule', () => {
            const ast = parser.parse('#$?#body:-abp-has(.ad) { padding: 0; }');
            expect(ast.type).toBe('CssInjectionRule');
        });

        test('existing element hiding still works', () => {
            const ast = parser.parse('example.com##.ad-banner');
            expect(ast.type).toBe('ElementHidingRule');
        });

        test('existing JS injection still works', () => {
            const ast = parser.parse('example.com#%#let a = 2;');
            expect(ast.type).toBe('JsInjectionRule');
        });
    });
});

describe('RuleParser — ADG CSS injection: parseCssSelectorList', () => {
    test('default: selectorList is Raw', () => {
        const selectorList = 'body';
        const declarationList = 'padding: 0;';
        const ast = parser.parse(`#$#${selectorList} { ${declarationList} }`) as CssInjectionRule;

        expect(ast.body.selectorList).toMatchObject({ type: 'Raw', value: selectorList, kind: ValueKind.CssSelector });
    });

    test('parseCssSelectorList: true → simple type selector', () => {
        const selectorList = 'body';
        const declarationList = 'padding: 0;';
        const ast = parser.parse(`#$#${selectorList} { ${declarationList} }`, {
            parseCssSelectorList: true,
        }) as CssInjectionRule;

        expect(ast.body.selectorList.type).toBe('SelectorList');
        const sl = ast.body.selectorList as SelectorList;
        expect(sl.children).toHaveLength(1);
        expect(sl.children[0].type).toBe('ComplexSelector');
    });

    test('parseCssSelectorList: true → compound selector', () => {
        const selectorList = 'div.class';
        const declarationList = 'color: red;';
        const ast = parser.parse(`#$#${selectorList} { ${declarationList} }`, {
            parseCssSelectorList: true,
        }) as CssInjectionRule;

        expect(ast.body.selectorList.type).toBe('SelectorList');
        const sl = ast.body.selectorList as SelectorList;
        expect(sl.children).toHaveLength(1);
        // compound selector: div + .class = 2 simple selectors in the ComplexSelector
        expect(sl.children[0].children).toHaveLength(2);
    });

    test('parseCssSelectorList: true → complex selector with combinator', () => {
        const selectorList = 'div.class > span';
        const declarationList = 'color: red;';
        const ast = parser.parse(`#$#${selectorList} { ${declarationList} }`, {
            parseCssSelectorList: true,
        }) as CssInjectionRule;

        expect(ast.body.selectorList.type).toBe('SelectorList');
        const sl = ast.body.selectorList as SelectorList;
        expect(sl.children).toHaveLength(1);
        // complex: two compound selectors joined by combinator = at least 3 children
        expect(sl.children[0].children.length).toBeGreaterThanOrEqual(3);
    });

    test('parseCssSelectorList: true with @media wrapper', () => {
        const selectorList = 'body';
        const declarationList = 'padding: 0;';
        const ast = parser.parse(`#$#@media (max-width: 768px) { ${selectorList} { ${declarationList} } }`, {
            parseCssSelectorList: true,
        }) as CssInjectionRule;

        expect(ast.body.selectorList.type).toBe('SelectorList');
        expect(ast.body.mediaQueryList).toBeDefined();
        expect(ast.body.mediaQueryList!.value).toBe('(max-width: 768px)');
    });
});

describe('RuleParser — ADG CSS injection: parseCssDeclarationList', () => {
    test('default: declarationList is Raw', () => {
        const selectorList = 'body';
        const declarationList = 'padding: 0;';
        const ast = parser.parse(`#$#${selectorList} { ${declarationList} }`) as CssInjectionRule;

        // eslint-disable-next-line max-len
        expect(ast.body.declarationList).toMatchObject({ type: 'Raw', value: declarationList, kind: ValueKind.CssDeclaration });
    });

    test('parseCssDeclarationList: true → single property', () => {
        const selectorList = 'body';
        const declarationList = 'padding: 0;';
        const ast = parser.parse(`#$#${selectorList} { ${declarationList} }`, {
            parseCssDeclarationList: true,
        }) as CssInjectionRule;

        expect(ast.body.declarationList?.type).toBe('CssDeclarationList');
        const dl = ast.body.declarationList as CssDeclarationList;
        expect(dl.children).toHaveLength(1);
        expect(dl.children[0].property.value).toBe('padding');
        expect(dl.children[0].value.value).toBe('0');
    });

    test('parseCssDeclarationList: true → property with !important', () => {
        const selectorList = 'body';
        const declarationList = 'padding: 0 !important;';
        const ast = parser.parse(`#$#${selectorList} { ${declarationList} }`, {
            parseCssDeclarationList: true,
        }) as CssInjectionRule;

        expect(ast.body.declarationList?.type).toBe('CssDeclarationList');
        const dl = ast.body.declarationList as CssDeclarationList;
        expect(dl.children).toHaveLength(1);
        expect(dl.children[0].property.value).toBe('padding');
        expect(dl.children[0].important).toBe(true);
    });

    test('remove: true with parseCssDeclarationList: true → no declarationList', () => {
        const selectorList = 'body';
        const declarationList = 'remove: true;';
        const ast = parser.parse(`#$#${selectorList} { ${declarationList} }`, {
            parseCssDeclarationList: true,
        }) as CssInjectionRule;

        expect(ast.body.remove).toBe(true);
        expect(ast.body.declarationList).toBeUndefined();
    });

    test('parseCssDeclarationList: true with @media wrapper', () => {
        const selectorList = 'body';
        const declarationList = 'padding: 0;';
        const ast = parser.parse(`#$#@media (max-width: 768px) { ${selectorList} { ${declarationList} } }`, {
            parseCssDeclarationList: true,
        }) as CssInjectionRule;

        expect(ast.body.declarationList?.type).toBe('CssDeclarationList');
        const dl = ast.body.declarationList as CssDeclarationList;
        expect(dl.children).toHaveLength(1);
        expect(dl.children[0].property.value).toBe('padding');
    });

    test('both options enabled produce typed nodes with correct values', () => {
        const selectorList = 'body';
        const declarationList = 'padding: 0;';
        const ast = parser.parse(`#$#${selectorList} { ${declarationList} }`, {
            parseCssSelectorList: true,
            parseCssDeclarationList: true,
        }) as CssInjectionRule;

        expect(ast.body.selectorList.type).toBe('SelectorList');
        const sl = ast.body.selectorList as SelectorList;
        expect(sl.children).toHaveLength(1);

        expect(ast.body.declarationList?.type).toBe('CssDeclarationList');
        const dl = ast.body.declarationList as CssDeclarationList;
        expect(dl.children).toHaveLength(1);
        expect(dl.children[0].property.value).toBe('padding');
    });
});
