import { describe, expect, test } from 'vitest';

import { RuleParserPipeline } from '../../../src/ast-builder/rule-parser';
import { SYNTAX_ADG, SYNTAX_ALL } from '../../../src/utils/syntax-flags';

const parser = new RuleParserPipeline();

describe('RuleParser — AdGuard rule modifiers', () => {
    describe('AdGuard modifier list prefix [$...]', () => {
        test('[$path] modifier - [$path=/page]example.com##.ads', () => {
            const ast = parser.parse('[$path=/page]example.com##.ads');

            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                syntax: SYNTAX_ADG,
                exception: false,
                modifiers: {
                    type: 'ModifierList',
                    children: [
                        {
                            type: 'Modifier',
                            name: { type: 'Value', value: 'path' },
                            value: { type: 'Value', value: '/page' },
                        },
                    ],
                },
                domains: {
                    type: 'DomainList',
                    children: [
                        {
                            type: 'Domain',
                            value: 'example.com',
                        },
                    ],
                },
                body: {
                    selectorList: {
                        value: '.ads',
                    },
                },
            });
        });

        test('[$domain] modifier - [$domain=example.com]##.ads', () => {
            const ast = parser.parse('[$domain=example.com]##.ads');

            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                syntax: SYNTAX_ADG,
                modifiers: {
                    type: 'ModifierList',
                    children: [
                        {
                            type: 'Modifier',
                            name: { type: 'Value', value: 'domain' },
                            value: { type: 'Raw', value: 'example.com' },
                        },
                    ],
                },
                body: {
                    selectorList: {
                        value: '.ads',
                    },
                },
            });
        });

        test('multiple modifiers - [$path=/page,domain=example.com]##.ads', () => {
            const ast = parser.parse('[$path=/page,domain=example.com]##.ads');

            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                syntax: SYNTAX_ADG,
                modifiers: {
                    type: 'ModifierList',
                    children: [
                        {
                            type: 'Modifier',
                            name: { type: 'Value', value: 'path' },
                            value: { type: 'Value', value: '/page' },
                        },
                        {
                            type: 'Modifier',
                            name: { type: 'Value', value: 'domain' },
                            value: { type: 'Raw', value: 'example.com' },
                        },
                    ],
                },
                body: {
                    selectorList: {
                        value: '.ads',
                    },
                },
            });
        });

        test('regex-literal bracket in modifier value does not close modifier list', () => {
            // A `]` inside a regex character class (e.g. `path=/[abc]/`)
            // must be skipped during bracket-depth tracking in findClosingBracket
            // so it is not mistaken for the closing `]` of the modifier list.
            const ast = parser.parse('[$domain=example.com,path=/[abc]/]##.selector');

            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                modifiers: {
                    type: 'ModifierList',
                    children: [
                        {
                            type: 'Modifier',
                            name: { type: 'Value', value: 'domain' },
                            value: { type: 'Raw', value: 'example.com' },
                        },
                        {
                            type: 'Modifier',
                            name: { type: 'Value', value: 'path' },
                            value: { type: 'Value', value: '/[abc]/' },
                        },
                    ],
                },
                body: {
                    selectorList: {
                        value: '.selector',
                    },
                },
            });
        });

        test('slash inside a regex character class does not close the regex', () => {
            // A `/` inside a regex character class (e.g. `/[/]/`) must be
            // skipped by findClosingSlash until classDepth returns to 0;
            // otherwise the class's `]` is misidentified as the end of the
            // modifier list.
            const ast = parser.parse('[$path=/[/]/]##.ad');

            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                modifiers: {
                    type: 'ModifierList',
                    children: [
                        {
                            type: 'Modifier',
                            name: { type: 'Value', value: 'path' },
                            value: { type: 'Value', value: '/[/]/' },
                        },
                    ],
                },
                body: {
                    selectorList: {
                        value: '.ad',
                    },
                },
            });
        });

        test('modifier list with domain list - [$path=/page]example.com,test.org##.ads', () => {
            const ast = parser.parse('[$path=/page]example.com,test.org##.ads');

            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                syntax: SYNTAX_ADG,
                modifiers: {
                    type: 'ModifierList',
                    children: [
                        {
                            type: 'Modifier',
                            name: { type: 'Value', value: 'path' },
                            value: { type: 'Value', value: '/page' },
                        },
                    ],
                },
                domains: {
                    type: 'DomainList',
                    children: [
                        {
                            type: 'Domain',
                            value: 'example.com',
                        },
                        {
                            type: 'Domain',
                            value: 'test.org',
                        },
                    ],
                },
                body: {
                    selectorList: {
                        value: '.ads',
                    },
                },
            });
        });

        test('with exception rule - [$path=/page]example.com#@#.ads', () => {
            const ast = parser.parse('[$path=/page]example.com#@#.ads');

            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                syntax: SYNTAX_ADG,
                exception: true,
                modifiers: {
                    type: 'ModifierList',
                    children: [
                        {
                            type: 'Modifier',
                            name: { type: 'Value', value: 'path' },
                            value: { type: 'Value', value: '/page' },
                        },
                    ],
                },
                body: {
                    selectorList: {
                        value: '.ads',
                    },
                },
            });
        });

        test('with extended syntax - [$path=/page]example.com#?#.ads', () => {
            const ast = parser.parse('[$path=/page]example.com#?#.ads');

            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                syntax: SYNTAX_ADG,
                separator: {
                    value: '#?#',
                },
                modifiers: {
                    type: 'ModifierList',
                    children: [
                        {
                            type: 'Modifier',
                            name: { type: 'Value', value: 'path' },
                            value: { type: 'Value', value: '/page' },
                        },
                    ],
                },
                body: {
                    selectorList: {
                        value: '.ads',
                    },
                },
            });
        });

        test('no modifiers - example.com##.ads', () => {
            const ast = parser.parse('example.com##.ads');

            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                syntax: SYNTAX_ALL,
            });
            expect((ast as any).modifiers).toBeUndefined();
        });
    });

    describe('edge cases - regex values with embedded separators', () => {
        test('[$domain] with regex containing character class - [$domain=/example[0-9]\\.(com|org)/]##.ad', () => {
            const ast = parser.parse('[$domain=/example[0-9]\\.(com|org)/]##.ad');

            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                syntax: SYNTAX_ADG,
                modifiers: {
                    type: 'ModifierList',
                    children: [
                        {
                            type: 'Modifier',
                            name: { type: 'Value', value: 'domain' },
                        },
                    ],
                },
                body: {
                    selectorList: {
                        value: '.ad',
                    },
                },
            });
        });

        // eslint-disable-next-line max-len
        test('[$domain] with regex containing quantifier braces - [$domain=/example\\d{1,}\\.(com|org)/]##.ad', () => {
            // Previously skipped: the value parser's isPotentialNetModifier heuristic may split
            // on the comma inside {1,}
            const ast = parser.parse('[$domain=/example\\d{1,}\\.(com|org)/]##.ad');

            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                syntax: SYNTAX_ADG,
                modifiers: {
                    type: 'ModifierList',
                    children: [
                        {
                            type: 'Modifier',
                            name: { type: 'Value', value: 'domain' },
                        },
                    ],
                },
                body: {
                    selectorList: {
                        value: '.ad',
                    },
                },
            });
        });

        test('[$domain] regex with multiple modifiers - [$domain=/example\\.(com|org)/,path=/page]##.ad', () => {
            const ast = parser.parse('[$domain=/example\\.(com|org)/,path=/page]##.ad');

            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                syntax: SYNTAX_ADG,
                modifiers: {
                    type: 'ModifierList',
                    children: [
                        {
                            type: 'Modifier',
                            name: { type: 'Value', value: 'domain' },
                        },
                        {
                            type: 'Modifier',
                            name: { type: 'Value', value: 'path' },
                            value: { type: 'Value', value: '/page' },
                        },
                    ],
                },
                body: {
                    selectorList: {
                        value: '.ad',
                    },
                },
            });
        });

        // eslint-disable-next-line max-len
        test('[$path] with complex regex containing character classes and $ anchor', () => {
            // Real-world pattern: ] inside character class and $ as regex anchor
            // should not break modifier block parsing
            // eslint-disable-next-line max-len
            const ast = parser.parse('[$path=/^[a-z0-9]{5,}\\.(?=.*[a-z])(?=.*[0-9])[a-z0-9]{17,}\\.(cfd|sbs|shop)$/]##.ad');

            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                syntax: SYNTAX_ADG,
                modifiers: {
                    type: 'ModifierList',
                    children: [
                        {
                            type: 'Modifier',
                            name: { type: 'Value', value: 'path' },
                        },
                    ],
                },
                body: {
                    selectorList: {
                        value: '.ad',
                    },
                },
            });
        });
    });

    describe('error cases', () => {
        test('unclosed modifier list - [$path=/page example.com##.ads', () => {
            expect(() => {
                parser.parse('[$path=/page example.com##.ads');
            }).toThrow();
        });
    });

    describe('validation - mutually exclusive with uBO modifiers', () => {
        test('should reject AdGuard [$...] + uBO :matches-path()', () => {
            expect(() => {
                parser.parse('[$path=/page]##:matches-path(/other) .ads');
            }).toThrow('Cannot mix AdGuard modifier list [$...] with uBO pseudo-class modifiers');
        });

        test('should reject AdGuard [$...] + uBO :style()', () => {
            expect(() => {
                parser.parse('[$domain=example.com]##.ads:style(display: none)');
            }).toThrow('Cannot mix AdGuard modifier list [$...] with uBO pseudo-class modifiers');
        });
    });
});
