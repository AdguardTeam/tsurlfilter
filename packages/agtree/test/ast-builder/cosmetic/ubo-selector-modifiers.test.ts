import { describe, expect, test } from 'vitest';

import { RuleParserPipeline } from '../../../src/ast-builder/rule-parser';
import { SYNTAX_UBO } from '../../../src/utils/syntax-flags';

const parser = new RuleParserPipeline();

describe('RuleParser — uBO selector modifiers', () => {
    describe(':matches-path() extraction', () => {
        test('basic - ##:matches-path(/page) .ad', () => {
            const ast = parser.parse('##:matches-path(/page) .ad') as any;

            expect(ast.type).toBe('ElementHidingRule');
            expect(ast.syntax).toBe(SYNTAX_UBO);
            expect(ast.body.selectorList.value).toBe('.ad');
            expect(ast.modifiers).toBeDefined();
            expect(ast.modifiers.children).toHaveLength(1);
            expect(ast.modifiers.children[0].name.value).toBe('matches-path');
            expect(ast.modifiers.children[0].value.value).toBe('/page');
            expect(ast.modifiers.children[0].exception).toBeUndefined();
        });

        test('with domain - example.com##:matches-path(/page) .ad', () => {
            const ast = parser.parse('example.com##:matches-path(/page) .ad') as any;

            expect(ast.type).toBe('ElementHidingRule');
            expect(ast.syntax).toBe(SYNTAX_UBO);
            expect(ast.body.selectorList.value).toBe('.ad');
            expect(ast.modifiers.children[0].name.value).toBe('matches-path');
            expect(ast.modifiers.children[0].value.value).toBe('/page');
            expect(ast.domains.children).toHaveLength(1);
        });

        test('at end of selector - ##.ad:matches-path(/page)', () => {
            const ast = parser.parse('##.ad:matches-path(/page)') as any;

            expect(ast.type).toBe('ElementHidingRule');
            expect(ast.syntax).toBe(SYNTAX_UBO);
            expect(ast.body.selectorList.value).toBe('.ad');
            expect(ast.modifiers.children[0].name.value).toBe('matches-path');
            expect(ast.modifiers.children[0].value.value).toBe('/page');
        });

        test('regex-like value with parens - ##:matches-path(/\\/(sub1|sub2)\\/page/) .ad', () => {
            const ast = parser.parse('##:matches-path(/\\/(sub1|sub2)\\/page/) .ad') as any;

            expect(ast.type).toBe('ElementHidingRule');
            expect(ast.syntax).toBe(SYNTAX_UBO);
            expect(ast.body.selectorList.value).toBe('.ad');
            expect(ast.modifiers.children[0].name.value).toBe('matches-path');
            expect(ast.modifiers.children[0].value.value).toBe('/\\/(sub1|sub2)\\/page/');
        });
    });

    describe(':matches-media() extraction', () => {
        test('basic - ##:matches-media((min-width: 1024px)) .ad', () => {
            const ast = parser.parse('##:matches-media((min-width: 1024px)) .ad') as any;

            expect(ast.type).toBe('ElementHidingRule');
            expect(ast.syntax).toBe(SYNTAX_UBO);
            expect(ast.body.selectorList.value).toBe('.ad');
            expect(ast.modifiers.children).toHaveLength(1);
            expect(ast.modifiers.children[0].name.value).toBe('matches-media');
            expect(ast.modifiers.children[0].value.value).toBe('(min-width: 1024px)');
        });
    });

    describe(':not() wrapping (negation)', () => {
        test('single :not() - ##:not(:matches-path(/exclude)) .foo', () => {
            const ast = parser.parse('##:not(:matches-path(/exclude)) .foo') as any;

            expect(ast.type).toBe('ElementHidingRule');
            expect(ast.syntax).toBe(SYNTAX_UBO);
            expect(ast.body.selectorList.value).toBe('.foo');
            expect(ast.modifiers.children).toHaveLength(1);
            expect(ast.modifiers.children[0].name.value).toBe('matches-path');
            expect(ast.modifiers.children[0].value.value).toBe('/exclude');
            expect(ast.modifiers.children[0].exception).toBe(true);
        });

        test('double :not() (cancels) - ##:not(:not(:matches-path(/path))) .foo', () => {
            const ast = parser.parse('##:not(:not(:matches-path(/path))) .foo') as any;

            expect(ast.type).toBe('ElementHidingRule');
            expect(ast.syntax).toBe(SYNTAX_UBO);
            expect(ast.body.selectorList.value).toBe('.foo');
            expect(ast.modifiers.children[0].name.value).toBe('matches-path');
            expect(ast.modifiers.children[0].value.value).toBe('/path');
            expect(ast.modifiers.children[0].exception).toBeUndefined();
        });

        test('triple :not() (single negation) - ##:not(:not(:not(:matches-path(/path)))) .foo', () => {
            const ast = parser.parse('##:not(:not(:not(:matches-path(/path)))) .foo') as any;

            expect(ast.type).toBe('ElementHidingRule');
            expect(ast.syntax).toBe(SYNTAX_UBO);
            expect(ast.body.selectorList.value).toBe('.foo');
            expect(ast.modifiers.children[0].name.value).toBe('matches-path');
            expect(ast.modifiers.children[0].value.value).toBe('/path');
            expect(ast.modifiers.children[0].exception).toBe(true);
        });
    });

    describe('multiple modifiers', () => {
        test(':not(:matches-media()) wrapping — single :not() negates :matches-media()', () => {
            const ast = parser.parse('##:not(:matches-media((min-width: 1024px))) .ad') as any;

            expect(ast.type).toBe('ElementHidingRule');
            expect(ast.syntax).toBe(SYNTAX_UBO);
            expect(ast.body.selectorList.value).toBe('.ad');
            expect(ast.modifiers.children).toHaveLength(1);
            expect(ast.modifiers.children[0].name.value).toBe('matches-media');
            expect(ast.modifiers.children[0].value.value).toBe('(min-width: 1024px)');
            expect(ast.modifiers.children[0].exception).toBe(true);
        });

        test(':not(:matches-media()) wrapping — double :not() cancels negation', () => {
            const ast = parser.parse('##:not(:not(:matches-media((min-width: 1024px)))) .ad') as any;

            expect(ast.type).toBe('ElementHidingRule');
            expect(ast.modifiers.children[0].name.value).toBe('matches-media');
            expect(ast.modifiers.children[0].value.value).toBe('(min-width: 1024px)');
            expect(ast.modifiers.children[0].exception).toBeUndefined();
        });

        test(':not(:matches-media()) wrapping — triple :not() negates :matches-media()', () => {
            const ast = parser.parse('##:not(:not(:not(:matches-media((min-width: 1024px))))) .ad') as any;

            expect(ast.type).toBe('ElementHidingRule');
            expect(ast.modifiers.children[0].name.value).toBe('matches-media');
            expect(ast.modifiers.children[0].value.value).toBe('(min-width: 1024px)');
            expect(ast.modifiers.children[0].exception).toBe(true);
        });

        test(':not(:matches-media()) wrapping — :matches-media() inside :any() still throws', () => {
            expect(() => {
                parser.parse('##:any(:matches-media((min-width: 1024px))):style(color: red)');
            }).toThrow('can only be nested inside :not()');
        });

        test(':not(:matches-media()) wrapping — motivating real-world rule with both negated modifiers', () => {
            const rule = 'dawn.fi##:not(:matches-path(/^/$/)) .header'
                + ':not(:matches-media((min-width: 750px))) + div[class]'
                + ' + div[class] .mobile-top-ad:style(margin: -10px auto !important)';
            const ast = parser.parse(rule) as any;

            expect(ast.type).toBe('CssInjectionRule');
            expect(ast.modifiers.children).toHaveLength(1);
            expect(ast.modifiers.children[0].name.value).toBe('matches-path');
            expect(ast.modifiers.children[0].exception).toBe(true);
            expect(ast.body.mediaQueryList?.value).toBe('(min-width: 750px)');
            expect(ast.body.mediaQueryNegated).toBe(true);
        });

        // eslint-disable-next-line max-len
        test(':matches-path() + :matches-media() - ##:matches-path(/page):matches-media((min-width: 1024px)) .ad', () => {
            const ast = parser.parse('##:matches-path(/page):matches-media((min-width: 1024px)) .ad') as any;

            expect(ast.type).toBe('ElementHidingRule');
            expect(ast.syntax).toBe(SYNTAX_UBO);
            expect(ast.body.selectorList.value).toBe('.ad');
            expect(ast.modifiers.children).toHaveLength(2);
            expect(ast.modifiers.children[0].name.value).toBe('matches-path');
            expect(ast.modifiers.children[0].value.value).toBe('/page');
            expect(ast.modifiers.children[1].name.value).toBe('matches-media');
            expect(ast.modifiers.children[1].value.value).toBe('(min-width: 1024px)');
        });
    });

    describe('non-uBO pseudo-classes remain in selector', () => {
        test(':has-text() stays in selector', () => {
            const ast = parser.parse('example.com##div:has-text(advertisement)') as any;

            expect(ast.type).toBe('ElementHidingRule');
            expect(ast.body.selectorList.value).toBe('div:has-text(advertisement)');
            expect(ast.modifiers).toBeUndefined();
        });

        test(':matches-css() stays in selector', () => {
            const ast = parser.parse('example.com##div:matches-css(display: block)') as any;

            expect(ast.type).toBe('ElementHidingRule');
            expect(ast.body.selectorList.value).toBe('div:matches-css(display: block)');
            expect(ast.modifiers).toBeUndefined();
        });
    });

    describe('error cases', () => {
        test('duplicate modifier throws', () => {
            expect(() => {
                parser.parse('##:matches-path(/a):matches-path(/b) .ad');
            }).toThrow('Duplicate uBO modifier');
        });

        test(':style() not at end throws', () => {
            // :style() detected by parser as terminal, but followed by non-whitespace
            expect(() => {
                parser.parse('example.com##.ads:style(display:none) div');
            }).toThrow(':style() and :remove() can only be used at the end of the selector');
        });
    });

    describe('parseUboSpecificRules=false disables detection', () => {
        test('throws when uBO modifier syntax is used with disabled option', () => {
            expect(() => {
                parser.parse('##:matches-path(/page) .ad', {
                    parseUboSpecificRules: false,
                });
            }).toThrow(/uBO-specific rules is disabled/);
        });
    });

    describe('location info', () => {
        test(':matches-path() with isLocIncluded', () => {
            const ast = parser.parse('##:matches-path(/page) .ad', {
                isLocIncluded: true,
            }) as any;

            expect(ast.type).toBe('ElementHidingRule');
            expect(ast.modifiers.children[0].name.value).toBe('matches-path');
            expect(ast.modifiers.children[0].name.start).toBe(3);
            expect(ast.modifiers.children[0].name.end).toBe(15);
            expect(ast.modifiers.children[0].value.value).toBe('/page');
            expect(ast.modifiers.children[0].value.start).toBe(16);
            expect(ast.modifiers.children[0].value.end).toBe(21);
            expect(ast.modifiers.children[0].start).toBe(2);
            expect(ast.modifiers.children[0].end).toBe(22);
        });

        test('selectorList.raw matches start/end when modifiers are extracted', () => {
            const rule = '##:matches-path(/page) .ad';
            const ast = parser.parse(rule, { isLocIncluded: true }) as any;
            const sel = ast.body.selectorList;

            // value is the cleaned selector (modifier stripped)
            expect(sel.value).toBe('.ad');
            // raw is the original body text (modifier included)
            expect(sel.raw).toBe(':matches-path(/page) .ad');
            // start/end span the original body range
            expect(sel.start).toBe(2);
            expect(sel.end).toBe(26);
            // invariant: source.slice(start, end) === raw
            expect(rule.slice(sel.start, sel.end)).toBe(sel.raw);
        });

        test('selectorList.raw is set when uBO mods present', () => {
            const ast = parser.parse('##.ad:matches-path(/page)') as any;
            const sel = ast.body.selectorList;

            expect(sel.value).toBe('.ad');
            expect(sel.raw).toBe('.ad:matches-path(/page)');
        });
    });
});
