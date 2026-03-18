import { describe, expect, test } from 'vitest';

import { RuleParser } from '../../../src/parser-new/rule-parser';
import type { ElementHidingRule } from '../../../src/nodes';

const parser = new RuleParser();

describe('RuleParser — element hiding rules', () => {
    describe('parse (with location)', () => {
        test('example.com##.ads — basic element hiding', () => {
            const ast = parser.parse('example.com##.ads', { isLocIncluded: true });
            
            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                category: 'Cosmetic',
                syntax: 'Common',
                exception: false,
                start: 0,
                end: 17,
                domains: {
                    type: 'DomainList',
                    separator: ',',
                    children: [
                        {
                            type: 'Domain',
                            value: 'example.com',
                            exception: false,
                            start: 0,
                            end: 11,
                        },
                    ],
                    start: 0,
                    end: 11,
                },
                separator: {
                    type: 'Value',
                    value: '##',
                    start: 11,
                    end: 13,
                },
                body: {
                    type: 'ElementHidingRuleBody',
                    selectorList: {
                        type: 'Value',
                        value: '.ads',
                        start: 13,
                        end: 17,
                    },
                    start: 13,
                    end: 17,
                },
            });
        });

        test('example.com#@#.ads — element hiding exception', () => {
            const ast = parser.parse('example.com#@#.ads', { isLocIncluded: true });
            
            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                exception: true,
                separator: {
                    type: 'Value',
                    value: '#@#',
                    start: 11,
                    end: 14,
                },
                body: {
                    type: 'ElementHidingRuleBody',
                    selectorList: {
                        type: 'Value',
                        value: '.ads',
                        start: 14,
                        end: 18,
                    },
                    start: 14,
                    end: 18,
                },
            });
        });

        test('example.com,~example.org##.banner — multiple domains with exception', () => {
            const ast = parser.parse('example.com,~example.org##.banner', { isLocIncluded: true });
            
            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                exception: false,
                domains: {
                    type: 'DomainList',
                    separator: ',',
                    children: [
                        {
                            type: 'Domain',
                            value: 'example.com',
                            exception: false,
                            start: 0,
                            end: 11,
                        },
                        {
                            type: 'Domain',
                            value: 'example.org',
                            exception: true,
                            start: 13,
                            end: 24,
                        },
                    ],
                    start: 0,
                    end: 24,
                },
                body: {
                    type: 'ElementHidingRuleBody',
                    selectorList: {
                        type: 'Value',
                        value: '.banner',
                        start: 26,
                        end: 33,
                    },
                },
            });
        });

        test('##.popup — no domains, global rule', () => {
            const ast = parser.parse('##.popup', { isLocIncluded: true });
            
            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                exception: false,
                domains: {
                    type: 'DomainList',
                    separator: ',',
                    children: [],
                },
                separator: {
                    type: 'Value',
                    value: '##',
                    start: 0,
                    end: 2,
                },
                body: {
                    type: 'ElementHidingRuleBody',
                    selectorList: {
                        type: 'Value',
                        value: '.popup',
                        start: 2,
                        end: 8,
                    },
                },
            });
        });

        test('example.com#?#div:has(> .ad) — extended element hiding', () => {
            const ast = parser.parse('example.com#?#div:has(> .ad)', { isLocIncluded: true });
            
            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                exception: false,
                separator: {
                    type: 'Value',
                    value: '#?#',
                    start: 11,
                    end: 14,
                },
                body: {
                    type: 'ElementHidingRuleBody',
                    selectorList: {
                        type: 'Value',
                        value: 'div:has(> .ad)',
                        start: 14,
                        end: 28,
                    },
                },
            });
        });

        test('example.com#@?#div:has(> .ad) — extended element hiding exception', () => {
            const ast = parser.parse('example.com#@?#div:has(> .ad)', { isLocIncluded: true });
            
            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                exception: true,
                separator: {
                    type: 'Value',
                    value: '#@?#',
                    start: 11,
                    end: 15,
                },
                body: {
                    type: 'ElementHidingRuleBody',
                    selectorList: {
                        type: 'Value',
                        value: 'div:has(> .ad)',
                        start: 15,
                        end: 29,
                    },
                },
            });
        });

        test('example.com ## .ads — whitespace around separator', () => {
            const ast = parser.parse('example.com ## .ads', { isLocIncluded: true });
            
            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                body: {
                    type: 'ElementHidingRuleBody',
                    selectorList: {
                        type: 'Value',
                        value: '.ads',
                    },
                },
            });
        });

        test('example.com##div[id="foo,bar"] — complex selector with comma', () => {
            const ast = parser.parse('example.com##div[id="foo,bar"]', { isLocIncluded: true });
            
            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                body: {
                    type: 'ElementHidingRuleBody',
                    selectorList: {
                        type: 'Value',
                        value: 'div[id="foo,bar"]',
                    },
                },
            });
        });

        test('example.com##.class1,.class2 — multiple selectors', () => {
            const ast = parser.parse('example.com##.class1,.class2', { isLocIncluded: true });
            
            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                body: {
                    type: 'ElementHidingRuleBody',
                    selectorList: {
                        type: 'Value',
                        value: '.class1,.class2',
                    },
                },
            });
        });
    });

    describe('parse (without location)', () => {
        test('example.com##.ads', () => {
            const ast = parser.parse('example.com##.ads', { isLocIncluded: false });
            
            expect(ast).toMatchObject({
                type: 'ElementHidingRule',
                exception: false,
                domains: {
                    type: 'DomainList',
                    separator: ',',
                    children: [
                        {
                            type: 'Domain',
                            value: 'example.com',
                            exception: false,
                        },
                    ],
                },
                separator: {
                    type: 'Value',
                    value: '##',
                },
                body: {
                    type: 'ElementHidingRuleBody',
                    selectorList: {
                        type: 'Value',
                        value: '.ads',
                    },
                },
            });

            expect(ast).not.toHaveProperty('start');
            expect(ast).not.toHaveProperty('end');
        });
    });

    describe('edge cases', () => {
        test('trailing whitespace in body is trimmed', () => {
            const ast = parser.parse('example.com##.ads   ', { isLocIncluded: true });
            
            expect(ast).toMatchObject({
                body: {
                    selectorList: {
                        value: '.ads',
                        start: 13,
                        end: 17,
                    },
                },
            });
        });

        test('unicode in selector', () => {
            const ast = parser.parse('example.com##.класс', { isLocIncluded: false });
            
            expect(ast).toMatchObject({
                body: {
                    selectorList: {
                        value: '.класс',
                    },
                },
            });
        });

        test('complex domain list with regex domain', () => {
            const ast = parser.parse('/example\\.com/,test.com##.ads', { isLocIncluded: false });
            
            expect(ast).toMatchObject({
                domains: {
                    children: [
                        {
                            type: 'Domain',
                            value: '/example\\.com/',
                            exception: false,
                        },
                        {
                            type: 'Domain',
                            value: 'test.com',
                            exception: false,
                        },
                    ],
                },
            });
        });
    });

    describe('error cases', () => {
        test('empty body should throw', () => {
            expect(() => parser.parse('example.com##')).toThrow('Element hiding rule has empty body');
        });

        test('only whitespace in body should throw', () => {
            expect(() => parser.parse('example.com##   ')).toThrow('Element hiding rule has empty body');
        });
    });

    describe('separator variants', () => {
        test.each([
            ['##', false],
            ['#@#', true],
            ['#?#', false],
            ['#@?#', true],
        ])('separator %s has exception=%s', (separator, expectedException) => {
            const rule = `example.com${separator}.ads`;
            const ast = parser.parse(rule) as ElementHidingRule;
            
            expect(ast.exception).toBe(expectedException);
            expect(ast.separator.value).toBe(separator);
        });
    });
});
