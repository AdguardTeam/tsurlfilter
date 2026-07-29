import { describe, expect, test } from 'vitest';

import { RuleParserPipeline } from '../../../src/ast-builder/rule-parser';
import { AdgCssInjectionGenerator } from '../../../src/generator/css/adg-css-injection-generator';
import type { CssInjectionRule, CssInjectionRuleBody, Raw } from '../../../src/nodes';
import { SYNTAX_UBO } from '../../../src/utils/syntax-flags';

const parser = new RuleParserPipeline();

describe('UboCssInjectionAstBuilder — :style() rules', () => {
    test('basic :style() with no domains', () => {
        const ast = parser.parse('##body:style(padding: 0;)') as CssInjectionRule;

        expect(ast.type).toBe('CssInjectionRule');
        expect(ast.syntax).toBe(SYNTAX_UBO);
        expect(ast.exception).toBe(false);
        expect(ast.body.type).toBe('CssInjectionRuleBody');
        expect(ast.body.selectorList).toMatchObject({ type: 'Raw', value: 'body' });
        expect(ast.body.declarationList).toMatchObject({ type: 'Raw', value: 'padding: 0;' });
        expect(ast.body.mediaQueryList).toBeUndefined();
        expect(ast.body.remove).toBeUndefined();
    });

    test(':style() with domain', () => {
        const ast = parser.parse('example.com##h1:style(background-color: blue !important)') as CssInjectionRule;

        expect(ast.type).toBe('CssInjectionRule');
        expect(ast.syntax).toBe(SYNTAX_UBO);
        expect(ast.domains.children).toHaveLength(1);
        expect(ast.domains.children[0].value).toBe('example.com');
        expect(ast.body.selectorList).toMatchObject({ type: 'Raw', value: 'h1' });
        expect(ast.body.declarationList).toMatchObject({
            type: 'Raw',
            value: 'background-color: blue !important',
        });
    });

    test(':style() with attribute selector containing colons & semicolons', () => {
        const ast = parser.parse('##body[style="opacity: 0;"]:style(opacity: 1 !important;)') as CssInjectionRule;

        expect(ast.body.selectorList).toMatchObject({
            type: 'Raw',
            value: 'body[style="opacity: 0;"]',
        });
        expect(ast.body.declarationList).toMatchObject({
            type: 'Raw',
            value: 'opacity: 1 !important;',
        });
    });

    test(':style() with location info enabled', () => {
        const src = '##body:style(padding: 0;)';
        const ast = parser.parse(src, { isLocIncluded: true }) as CssInjectionRule;

        expect(ast.start).toBe(0);
        expect(ast.end).toBe(src.length);

        // separator
        expect(ast.separator.start).toBe(0);
        expect(ast.separator.end).toBe(2);

        // body covers the full body range (after separator)
        expect(ast.body.start).toBe(2);
        expect(ast.body.end).toBe(src.length);

        // selectorList: cleaned value 'body', range covers full body
        expect((ast.body.selectorList as Raw).value).toBe('body');
        expect(ast.body.selectorList.start).toBe(2);
        expect(ast.body.selectorList.end).toBe(src.length);

        // declarationList: range covers exactly 'padding: 0;'
        const dlStart = src.indexOf('padding');
        const dlEnd = src.indexOf(')');
        expect(ast.body.declarationList?.start).toBe(dlStart);
        expect(ast.body.declarationList?.end).toBe(dlEnd);
    });
});

describe('UboCssInjectionAstBuilder — :remove() rules', () => {
    test('basic :remove() with no domains', () => {
        const ast = parser.parse('##.ads:remove()') as CssInjectionRule;

        expect(ast.type).toBe('CssInjectionRule');
        expect(ast.syntax).toBe(SYNTAX_UBO);
        expect(ast.body.selectorList).toMatchObject({ type: 'Raw', value: '.ads' });
        expect(ast.body.declarationList).toBeUndefined();
        expect(ast.body.remove).toBe(true);
    });

    test(':remove() with multi-token selector', () => {
        const ast = parser.parse('gorhill.github.io###pcf #a18 .fail:remove()') as CssInjectionRule;

        expect(ast.domains.children[0].value).toBe('gorhill.github.io');
        expect(ast.body.selectorList).toMatchObject({
            type: 'Raw',
            value: '#pcf #a18 .fail',
        });
        expect(ast.body.remove).toBe(true);
        expect(ast.body.declarationList).toBeUndefined();
    });

    test(':remove() with non-empty argument is ignored (still remove:true)', () => {
        const ast = parser.parse('##body:remove(something)') as CssInjectionRule;

        expect(ast.body.remove).toBe(true);
        expect(ast.body.declarationList).toBeUndefined();
    });
});

describe('UboCssInjectionAstBuilder — :matches-media() combined', () => {
    test(':matches-media() + :style()', () => {
        const ast = parser.parse(
            '##body:matches-media((min-width: 1024px) and (max-width: 1920px)):style(padding: 0 !important;)',
        ) as CssInjectionRule;

        expect(ast.body.selectorList).toMatchObject({ type: 'Raw', value: 'body' });
        expect(ast.body.mediaQueryList).toMatchObject({
            type: 'Value',
            value: '(min-width: 1024px) and (max-width: 1920px)',
        });
        expect(ast.body.declarationList).toMatchObject({
            type: 'Raw',
            value: 'padding: 0 !important;',
        });
    });

    test(':matches-media() + :remove()', () => {
        const ast = parser.parse('##.ad:matches-media((max-width: 600px)):remove()') as CssInjectionRule;

        expect(ast.body.mediaQueryList).toMatchObject({
            type: 'Value',
            value: '(max-width: 600px)',
        });
        expect(ast.body.remove).toBe(true);
        expect(ast.body.declarationList).toBeUndefined();
    });
});

describe('UboCssInjectionAstBuilder — exception rules', () => {
    test('#@#…:style()', () => {
        const ast = parser.parse('#@#body:style(padding: 0;)') as CssInjectionRule;

        expect(ast.exception).toBe(true);
        expect(ast.body.declarationList).toMatchObject({ type: 'Raw', value: 'padding: 0;' });
    });

    test('#@#…:remove()', () => {
        const ast = parser.parse('example.com#@#.ads:remove()') as CssInjectionRule;

        expect(ast.exception).toBe(true);
        expect(ast.body.remove).toBe(true);
    });
});

describe('UboCssInjectionAstBuilder — complex rule', () => {
    test('domains + :matches-path() + :matches-media() + :style()', () => {
        const src = 'example.com,~example.net#@#:matches-path(/something) body > .container'
            + ':has-text(/ad/):matches-media((min-width: 1024px) and (max-width: 1920px))'
            + ':style(padding: 0 !important;)';

        const ast = parser.parse(src) as CssInjectionRule;

        expect(ast.exception).toBe(true);
        expect(ast.syntax).toBe(SYNTAX_UBO);
        expect(ast.domains.children).toHaveLength(2);
        expect(ast.domains.children[0].value).toBe('example.com');
        expect(ast.domains.children[1].value).toBe('example.net');
        expect(ast.domains.children[1].exception).toBe(true);

        // :matches-path() goes to rule-level modifiers
        expect(ast.modifiers?.children).toHaveLength(1);
        expect(ast.modifiers!.children[0].name.value).toBe('matches-path');
        expect(ast.modifiers!.children[0].value?.value).toBe('/something');

        // :matches-media() and :style() go to body
        expect(ast.body.mediaQueryList?.value).toBe('(min-width: 1024px) and (max-width: 1920px)');
        expect((ast.body.selectorList as Raw).value).toBe('body > .container:has-text(/ad/)');
        expect((ast.body.declarationList as { value: string }).value).toBe('padding: 0 !important;');
    });
});

describe('UboCssInjectionAstBuilder — edge cases', () => {
    test('empty :style() argument produces empty Raw declarationList', () => {
        const ast = parser.parse('##body:style()') as CssInjectionRule;

        expect(ast.body.declarationList).toMatchObject({ type: 'Raw', value: '' });
    });

    test('whitespace-only :style() argument produces trimmed empty Raw', () => {
        const ast = parser.parse('##body:style(   )') as CssInjectionRule;

        expect(ast.body.declarationList).toMatchObject({ type: 'Raw', value: '' });
    });

    test('empty selector before :style() produces empty selectorList', () => {
        const ast = parser.parse('##:style(padding: 0)') as CssInjectionRule;

        expect(ast.body.selectorList).toMatchObject({ type: 'Raw', value: '' });
        expect(ast.body.declarationList).toMatchObject({ type: 'Raw', value: 'padding: 0' });
    });

    test('only :matches-media() + :style(), no actual selector', () => {
        const ast = parser.parse('##:matches-media((min-width:1024px)):style(color:red)') as CssInjectionRule;

        expect(ast.body.selectorList).toMatchObject({ type: 'Raw', value: '' });
        expect(ast.body.mediaQueryList?.value).toBe('(min-width:1024px)');
        expect(ast.body.declarationList).toMatchObject({ type: 'Raw', value: 'color:red' });
    });
});

describe('UboCssInjectionAstBuilder — error cases', () => {
    test(':style() followed by another selector is rejected', () => {
        expect(() => parser.parse('##body:style(padding: 0) div')).toThrow();
    });

    test(':style() followed by :remove() is rejected', () => {
        expect(() => parser.parse('##body:style(padding: 0):remove()')).toThrow();
    });

    test(':style() inside :has() is rejected', () => {
        expect(() => parser.parse('##div:has(:style(color: red))')).toThrow();
    });

    test(':not(:style(...)) is rejected', () => {
        expect(() => parser.parse('##div:not(:style(color: red))')).toThrow();
    });

    test('mixed ADG modifier list + uBO :style() is rejected', () => {
        expect(() => parser.parse('[$path=/something]example.com##.foo:style(color: red)')).toThrow();
    });
});

describe('UboCssInjectionAstBuilder — parseUboSpecificRules: false', () => {
    test('with parseUboSpecificRules: false, :style() rule throws', () => {
        expect(() => {
            parser.parse('##body:style(padding: 0;)', { parseUboSpecificRules: false });
        }).toThrow(/uBO-specific rules is disabled/);
    });
});

describe('UboCssInjectionAstBuilder — CSS sub-parsing options', () => {
    test('default: selectorList is Raw', () => {
        const ast = parser.parse('##body:style(padding: 0;)') as CssInjectionRule;

        expect(ast.body.selectorList.type).toBe('Raw');
    });

    test('parseCssSelectorList: true → selectorList is SelectorList', () => {
        const ast = parser.parse('##body:style(padding: 0;)', {
            parseCssSelectorList: true,
        }) as CssInjectionRule;

        expect(ast.body.selectorList.type).toBe('SelectorList');
    });

    test('default: declarationList is Raw', () => {
        const ast = parser.parse('##body:style(padding: 0 !important;)') as CssInjectionRule;

        expect(ast.body.declarationList?.type).toBe('Raw');
    });

    test('parseCssDeclarationList: true → declarationList is CssDeclarationList', () => {
        const ast = parser.parse('##body:style(padding: 0 !important;)', {
            parseCssDeclarationList: true,
        }) as CssInjectionRule;

        expect(ast.body.declarationList?.type).toBe('CssDeclarationList');
    });

    test(':remove() with parseCssDeclarationList: true → no declarationList', () => {
        const ast = parser.parse('##body:remove()', {
            parseCssDeclarationList: true,
        }) as CssInjectionRule;

        expect(ast.body.remove).toBe(true);
        expect(ast.body.declarationList).toBeUndefined();
    });

    test('both options enabled produce typed nodes', () => {
        const ast = parser.parse('##body:style(padding: 0;)', {
            parseCssSelectorList: true,
            parseCssDeclarationList: true,
        }) as CssInjectionRule;

        expect(ast.body.selectorList.type).toBe('SelectorList');
        expect(ast.body.declarationList?.type).toBe('CssDeclarationList');
    });
});

describe('UboCssInjectionAstBuilder — negated :matches-media()', () => {
    test(':not(:matches-media()) + :style() sets mediaQueryNegated', () => {
        const ast = parser.parse(
            '##body:not(:matches-media((min-width: 750px))):style(color: red)',
        ) as CssInjectionRule;

        expect(ast.type).toBe('CssInjectionRule');
        expect(ast.body.mediaQueryList).toMatchObject({
            type: 'Value',
            value: '(min-width: 750px)',
        });
        expect(ast.body.mediaQueryNegated).toBe(true);
        expect(ast.body.selectorList).toMatchObject({ type: 'Raw', value: 'body' });
        expect(ast.body.declarationList).toMatchObject({ type: 'Raw', value: 'color: red' });
    });

    test('non-negated :matches-media() does NOT set mediaQueryNegated', () => {
        const ast = parser.parse(
            '##body:matches-media((min-width: 750px)):style(color: red)',
        ) as CssInjectionRule;

        expect(ast.body.mediaQueryList?.value).toBe('(min-width: 750px)');
        expect(ast.body.mediaQueryNegated).toBeFalsy();
    });

    test('double :not(:not(:matches-media())) cancels negation', () => {
        const ast = parser.parse(
            '##body:not(:not(:matches-media((min-width: 750px)))):style(color: red)',
        ) as CssInjectionRule;

        expect(ast.body.mediaQueryList?.value).toBe('(min-width: 750px)');
        expect(ast.body.mediaQueryNegated).toBeFalsy();
    });

    test('triple :not(:not(:not(:matches-media()))) is negated', () => {
        const ast = parser.parse(
            '##body:not(:not(:not(:matches-media((min-width: 750px))))):style(color: red)',
        ) as CssInjectionRule;

        expect(ast.body.mediaQueryList?.value).toBe('(min-width: 750px)');
        expect(ast.body.mediaQueryNegated).toBe(true);
    });
});

describe('UboCssInjectionAstBuilder — AdGuard generator for negated :matches-media()', () => {
    test('AdGuard generator emits @media not ... for negated', () => {
        const ast = parser.parse(
            '##body:not(:matches-media((min-width: 750px))):style(color: red)',
        ) as CssInjectionRule;

        const output = AdgCssInjectionGenerator.generate(ast.body as unknown as CssInjectionRuleBody);

        expect(output).toBe('@media not (min-width: 750px) { body { color: red } }');
    });

    test('AdGuard generator emits @media ... for non-negated', () => {
        const ast = parser.parse(
            '##body:matches-media((min-width: 750px)):style(color: red)',
        ) as CssInjectionRule;

        const output = AdgCssInjectionGenerator.generate(ast.body as unknown as CssInjectionRuleBody);

        expect(output).toBe('@media (min-width: 750px) { body { color: red } }');
    });
});
