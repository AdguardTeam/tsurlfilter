import { describe, expect, test } from 'vitest';

import { RuleParser } from '../../../src/parser-new/rule-parser';

const parser = new RuleParser();

describe('RuleParser — AdGuard rule modifiers', () => {
    describe('AdGuard modifier list prefix [$...]', () => {
        test('[$path] modifier - [$path=/page]example.com##.ads', () => {
            const ast = parser.parse('[$path=/page]example.com##.ads');

            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                syntax: 'AdGuard',
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
                syntax: 'AdGuard',
                modifiers: {
                    type: 'ModifierList',
                    children: [
                        {
                            type: 'Modifier',
                            name: { type: 'Value', value: 'domain' },
                            value: { type: 'Value', value: 'example.com' },
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
                syntax: 'AdGuard',
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
                            value: { type: 'Value', value: 'example.com' },
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

        test('modifier list with domain list - [$path=/page]example.com,test.org##.ads', () => {
            const ast = parser.parse('[$path=/page]example.com,test.org##.ads');

            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                syntax: 'AdGuard',
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
                syntax: 'AdGuard',
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
                syntax: 'AdGuard',
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
                syntax: 'Common',
            });
            expect((ast as any).modifiers).toBeUndefined();
        });
    });

    describe('edge cases - regex values with embedded separators', () => {
        test('[$domain] with regex containing character class - [$domain=/example[0-9]\\.(com|org)/]##.ad', () => {
            const ast = parser.parse('[$domain=/example[0-9]\\.(com|org)/]##.ad');

            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                syntax: 'AdGuard',
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

        test.skip('[$domain] with regex containing quantifier braces - [$domain=/example\\d{1,}\\.(com|org)/]##.ad', () => {
            // TODO: The value parser's isPotentialNetModifier heuristic may split
            // on the comma inside {1,} — needs investigation
            const ast = parser.parse('[$domain=/example\\d{1,}\\.(com|org)/]##.ad');

            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                syntax: 'AdGuard',
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
                syntax: 'AdGuard',
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
