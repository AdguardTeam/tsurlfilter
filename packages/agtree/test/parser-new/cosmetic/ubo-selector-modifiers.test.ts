import { describe, expect, test } from 'vitest';

import { RuleParser } from '../../../src/parser-new/rule-parser';

const parser = new RuleParser();

describe('RuleParser — uBO selector modifiers', () => {
    describe(':matches-path() extraction', () => {
        test('basic - ##:matches-path(/page) .ad', () => {
            const ast = parser.parse('##:matches-path(/page) .ad') as any;

            expect(ast.type).toBe('ElementHidingRule');
            expect(ast.syntax).toBe('UblockOrigin');
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
            expect(ast.syntax).toBe('UblockOrigin');
            expect(ast.body.selectorList.value).toBe('.ad');
            expect(ast.modifiers.children[0].name.value).toBe('matches-path');
            expect(ast.modifiers.children[0].value.value).toBe('/page');
            expect(ast.domains.children).toHaveLength(1);
        });

        test('at end of selector - ##.ad:matches-path(/page)', () => {
            const ast = parser.parse('##.ad:matches-path(/page)') as any;

            expect(ast.type).toBe('ElementHidingRule');
            expect(ast.syntax).toBe('UblockOrigin');
            expect(ast.body.selectorList.value).toBe('.ad');
            expect(ast.modifiers.children[0].name.value).toBe('matches-path');
            expect(ast.modifiers.children[0].value.value).toBe('/page');
        });

        test('regex-like value with parens - ##:matches-path(/\\/(sub1|sub2)\\/page/) .ad', () => {
            const ast = parser.parse('##:matches-path(/\\/(sub1|sub2)\\/page/) .ad') as any;

            expect(ast.type).toBe('ElementHidingRule');
            expect(ast.syntax).toBe('UblockOrigin');
            expect(ast.body.selectorList.value).toBe('.ad');
            expect(ast.modifiers.children[0].name.value).toBe('matches-path');
            expect(ast.modifiers.children[0].value.value).toBe('/\\/(sub1|sub2)\\/page/');
        });
    });

    describe(':matches-media() extraction', () => {
        test('basic - ##:matches-media((min-width: 1024px)) .ad', () => {
            const ast = parser.parse('##:matches-media((min-width: 1024px)) .ad') as any;

            expect(ast.type).toBe('ElementHidingRule');
            expect(ast.syntax).toBe('UblockOrigin');
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
            expect(ast.syntax).toBe('UblockOrigin');
            expect(ast.body.selectorList.value).toBe('.foo');
            expect(ast.modifiers.children).toHaveLength(1);
            expect(ast.modifiers.children[0].name.value).toBe('matches-path');
            expect(ast.modifiers.children[0].value.value).toBe('/exclude');
            expect(ast.modifiers.children[0].exception).toBe(true);
        });

        test('double :not() (cancels) - ##:not(:not(:matches-path(/path))) .foo', () => {
            const ast = parser.parse('##:not(:not(:matches-path(/path))) .foo') as any;

            expect(ast.type).toBe('ElementHidingRule');
            expect(ast.syntax).toBe('UblockOrigin');
            expect(ast.body.selectorList.value).toBe('.foo');
            expect(ast.modifiers.children[0].name.value).toBe('matches-path');
            expect(ast.modifiers.children[0].value.value).toBe('/path');
            expect(ast.modifiers.children[0].exception).toBeUndefined();
        });

        test('triple :not() (single negation) - ##:not(:not(:not(:matches-path(/path)))) .foo', () => {
            const ast = parser.parse('##:not(:not(:not(:matches-path(/path)))) .foo') as any;

            expect(ast.type).toBe('ElementHidingRule');
            expect(ast.syntax).toBe('UblockOrigin');
            expect(ast.body.selectorList.value).toBe('.foo');
            expect(ast.modifiers.children[0].name.value).toBe('matches-path');
            expect(ast.modifiers.children[0].value.value).toBe('/path');
            expect(ast.modifiers.children[0].exception).toBe(true);
        });
    });

    describe('multiple modifiers', () => {
        // eslint-disable-next-line max-len
        test(':matches-path() + :matches-media() - ##:matches-path(/page):matches-media((min-width: 1024px)) .ad', () => {
            const ast = parser.parse('##:matches-path(/page):matches-media((min-width: 1024px)) .ad') as any;

            expect(ast.type).toBe('ElementHidingRule');
            expect(ast.syntax).toBe('UblockOrigin');
            expect(ast.body.selectorList.value).toBe('.ad');
            expect(ast.modifiers.children).toHaveLength(2);
            expect(ast.modifiers.children[0].name.value).toBe('matches-path');
            expect(ast.modifiers.children[0].value.value).toBe('/page');
            expect(ast.modifiers.children[1].name.value).toBe('matches-media');
            expect(ast.modifiers.children[1].value.value).toBe('(min-width: 1024px)');
        });
    });

    describe(':style() and :remove() — not yet implemented', () => {
        test(':style() throws not implemented', () => {
            expect(() => {
                parser.parse('example.com##.ads:style(display: none !important)');
            }).toThrow(':style() is not yet implemented');
        });

        test(':remove() throws not implemented', () => {
            expect(() => {
                parser.parse('example.com##.banner:remove()');
            }).toThrow(':remove() is not yet implemented');
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

        test(':matches-media() nested inside pseudo-class throws', () => {
            expect(() => {
                parser.parse('##:not(:matches-media((min-width: 1024px))) .ad');
            }).toThrow('cannot be nested');
        });

        test(':style() not at end throws', () => {
            // :style() detected by preparser as terminal, but followed by non-whitespace
            expect(() => {
                parser.parse('example.com##.ads:style(display:none) div');
            }).toThrow(':style() and :remove() can only be used at the end');
        });
    });

    describe('parseUboSpecificRules=false disables detection', () => {
        test('modifiers remain in selector when disabled', () => {
            const ast = parser.parse('##:matches-path(/page) .ad', {
                parseUboSpecificRules: false,
            }) as any;

            expect(ast.type).toBe('ElementHidingRule');
            expect(ast.body.selectorList.value).toBe(':matches-path(/page) .ad');
            expect(ast.modifiers).toBeUndefined();
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
    });
});
