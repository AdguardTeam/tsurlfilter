import { describe, expect, test } from 'vitest';

import { RuleParserPipeline } from '../../../src/ast-builder/rule-parser';
import { AdblockSyntaxError } from '../../../src/errors/adblock-syntax-error';
import type { HtmlFilteringRule } from '../../../src/nodes';
import { SYNTAX_ADG, SYNTAX_UBO } from '../../../src/utils/syntax-flags';

const parser = new RuleParserPipeline();

describe('RuleParser — HTML filtering rules', () => {
    describe('ADG — raw mode (default)', () => {
        test('$$script[tag-content="adblock"] — without domains', () => {
            const ast = parser.parse('$$script[tag-content="adblock"]', {
                isLocIncluded: true,
            }) as HtmlFilteringRule;

            expect(ast).toMatchObject({
                type: 'HtmlFilteringRule',
                category: 'Cosmetic',
                syntax: SYNTAX_ADG,
                exception: false,
                start: 0,
                end: 31,
                domains: {
                    type: 'DomainList',
                    separator: ',',
                    children: [],
                },
                separator: {
                    type: 'Value',
                    value: '$$',
                    start: 0,
                    end: 2,
                },
                body: {
                    type: 'Raw',
                    value: 'script[tag-content="adblock"]',
                    start: 2,
                    end: 31,
                },
            });
        });

        test('$$div[custom_attr] — without domains, simple attribute', () => {
            const ast = parser.parse('$$div[custom_attr]', {
                isLocIncluded: true,
            }) as HtmlFilteringRule;

            expect(ast).toMatchObject({
                type: 'HtmlFilteringRule',
                syntax: SYNTAX_ADG,
                exception: false,
                separator: {
                    type: 'Value',
                    value: '$$',
                },
                body: {
                    type: 'Raw',
                    value: 'div[custom_attr]',
                },
            });
        });

        test('$@$script[tag-content="adblock"] — exception without domains', () => {
            const ast = parser.parse('$@$script[tag-content="adblock"]', {
                isLocIncluded: true,
            }) as HtmlFilteringRule;

            expect(ast).toMatchObject({
                type: 'HtmlFilteringRule',
                syntax: SYNTAX_ADG,
                exception: true,
                separator: {
                    type: 'Value',
                    value: '$@$',
                    start: 0,
                    end: 3,
                },
                body: {
                    type: 'Raw',
                    value: 'script[tag-content="adblock"]',
                    start: 3,
                    end: 32,
                },
            });
        });

        test('example.com,~example.net$$script[tag-content="adblock"] — with domains', () => {
            const ast = parser.parse('example.com,~example.net$$script[tag-content="adblock"]', {
                isLocIncluded: true,
            }) as HtmlFilteringRule;

            expect(ast).toMatchObject({
                type: 'HtmlFilteringRule',
                syntax: SYNTAX_ADG,
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
                            value: 'example.net',
                            exception: true,
                            start: 13,
                            end: 24,
                        },
                    ],
                },
                separator: {
                    type: 'Value',
                    value: '$$',
                    start: 24,
                    end: 26,
                },
                body: {
                    type: 'Raw',
                    value: 'script[tag-content="adblock"]',
                    start: 26,
                    end: 55,
                },
            });
        });

        test('example.com,~example.net$@$script[tag-content="adblock"] — exception with domains', () => {
            const ast = parser.parse('example.com,~example.net$@$script[tag-content="adblock"]', {
                isLocIncluded: true,
            }) as HtmlFilteringRule;

            expect(ast).toMatchObject({
                type: 'HtmlFilteringRule',
                syntax: SYNTAX_ADG,
                exception: true,
                separator: {
                    type: 'Value',
                    value: '$@$',
                    start: 24,
                    end: 27,
                },
                body: {
                    type: 'Raw',
                    value: 'script[tag-content="adblock"]',
                    start: 27,
                    end: 56,
                },
            });
        });
    });

    describe('uBO — raw mode (default)', () => {
        test('##^script:has-text(adblock) — without domains', () => {
            const ast = parser.parse('##^script:has-text(adblock)', {
                isLocIncluded: true,
            }) as HtmlFilteringRule;

            expect(ast).toMatchObject({
                type: 'HtmlFilteringRule',
                category: 'Cosmetic',
                syntax: SYNTAX_UBO,
                exception: false,
                start: 0,
                end: 27,
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
                    type: 'Raw',
                    value: 'script:has-text(adblock)',
                    start: 3,
                    end: 27,
                },
            });
        });

        test('#@#^script:has-text(adblock) — exception without domains', () => {
            const ast = parser.parse('#@#^script:has-text(adblock)', {
                isLocIncluded: true,
            }) as HtmlFilteringRule;

            expect(ast).toMatchObject({
                type: 'HtmlFilteringRule',
                syntax: SYNTAX_UBO,
                exception: true,
                separator: {
                    type: 'Value',
                    value: '#@#',
                    start: 0,
                    end: 3,
                },
                body: {
                    type: 'Raw',
                    value: 'script:has-text(adblock)',
                    start: 4,
                    end: 28,
                },
            });
        });

        test('example.com,~example.net##^script:has-text(adblock) — with domains', () => {
            const ast = parser.parse('example.com,~example.net##^script:has-text(adblock)', {
                isLocIncluded: true,
            }) as HtmlFilteringRule;

            expect(ast).toMatchObject({
                type: 'HtmlFilteringRule',
                syntax: SYNTAX_UBO,
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
                        {
                            type: 'Domain',
                            value: 'example.net',
                            exception: true,
                        },
                    ],
                },
                separator: {
                    type: 'Value',
                    value: '##',
                },
                body: {
                    type: 'Raw',
                    value: 'script:has-text(adblock)',
                },
            });
        });

        test('example.com,~example.net#@#^script:has-text(adblock) — exception with domains', () => {
            const ast = parser.parse('example.com,~example.net#@#^script:has-text(adblock)', {
                isLocIncluded: true,
            }) as HtmlFilteringRule;

            expect(ast).toMatchObject({
                type: 'HtmlFilteringRule',
                syntax: SYNTAX_UBO,
                exception: true,
                separator: {
                    type: 'Value',
                    value: '#@#',
                },
                body: {
                    type: 'Raw',
                    value: 'script:has-text(adblock)',
                },
            });
        });

        test('##^responseheader(Test) — responseheader raw mode', () => {
            const ast = parser.parse('##^responseheader(Test)', {
                isLocIncluded: true,
            }) as HtmlFilteringRule;

            expect(ast).toMatchObject({
                type: 'HtmlFilteringRule',
                syntax: SYNTAX_UBO,
                exception: false,
                body: {
                    type: 'Raw',
                    value: 'responseheader(Test)',
                },
            });
        });

        test('##^ — throws in raw mode (empty body after ^)', () => {
            expect(() => parser.parse('##^')).toThrow(AdblockSyntaxError);
            expect(() => parser.parse('##^')).toThrow('Empty uBO HTML filtering rule body after ^');
        });

        test('example.com##^   — throws in raw mode (whitespace-only body after ^)', () => {
            expect(() => parser.parse('example.com##^   ')).toThrow(AdblockSyntaxError);
            expect(() => parser.parse('example.com##^   ')).toThrow('Empty uBO HTML filtering rule body after ^');
        });
    });

    describe('ADG — parsed mode', () => {
        test('$$script[tag-content="adblock"] — parsed selector list', () => {
            const ast = parser.parse('$$script[tag-content="adblock"]', {
                isLocIncluded: true,
                parseHtmlFilteringRuleBodies: true,
            }) as HtmlFilteringRule;

            expect(ast).toMatchObject({
                type: 'HtmlFilteringRule',
                syntax: SYNTAX_ADG,
                exception: false,
                body: {
                    type: 'HtmlFilteringRuleBody',
                    selectorList: {
                        type: 'SelectorList',
                        children: [{
                            type: 'ComplexSelector',
                            children: [
                                {
                                    type: 'TypeSelector',
                                    value: 'script',
                                },
                                {
                                    type: 'AttributeSelector',
                                    name: {
                                        type: 'Value',
                                        value: 'tag-content',
                                    },
                                    operator: {
                                        type: 'Value',
                                        value: '=',
                                    },
                                    value: {
                                        type: 'Value',
                                        value: 'adblock',
                                    },
                                },
                            ],
                        }],
                    },
                },
            });
        });

        test('$$div[custom_attr] — parsed simple attribute', () => {
            const ast = parser.parse('$$div[custom_attr]', {
                isLocIncluded: true,
                parseHtmlFilteringRuleBodies: true,
            }) as HtmlFilteringRule;

            expect(ast).toMatchObject({
                type: 'HtmlFilteringRule',
                syntax: SYNTAX_ADG,
                body: {
                    type: 'HtmlFilteringRuleBody',
                    selectorList: {
                        type: 'SelectorList',
                        children: [{
                            type: 'ComplexSelector',
                            children: [
                                {
                                    type: 'TypeSelector',
                                    value: 'div',
                                },
                                {
                                    type: 'AttributeSelector',
                                    name: {
                                        type: 'Value',
                                        value: 'custom_attr',
                                    },
                                },
                            ],
                        }],
                    },
                },
            });
        });

        test('example.com$$script[tag-content="adblock"] — parsed with domains', () => {
            const ast = parser.parse('example.com$$script[tag-content="adblock"]', {
                isLocIncluded: true,
                parseHtmlFilteringRuleBodies: true,
            }) as HtmlFilteringRule;

            expect(ast).toMatchObject({
                type: 'HtmlFilteringRule',
                syntax: SYNTAX_ADG,
                domains: {
                    type: 'DomainList',
                    children: [{
                        type: 'Domain',
                        value: 'example.com',
                        exception: false,
                    }],
                },
                body: {
                    type: 'HtmlFilteringRuleBody',
                    selectorList: {
                        type: 'SelectorList',
                        children: [{
                            type: 'ComplexSelector',
                        }],
                    },
                },
            });
        });

        test('ADG double-quote escaping: [attr="value with \\"\\"\\" quotes"]', () => {
            const ast = parser.parse('$$[attr="value with "" quotes"]', {
                isLocIncluded: true,
                parseHtmlFilteringRuleBodies: true,
            }) as HtmlFilteringRule;

            expect(ast).toMatchObject({
                type: 'HtmlFilteringRule',
                syntax: SYNTAX_ADG,
                body: {
                    type: 'HtmlFilteringRuleBody',
                    selectorList: {
                        type: 'SelectorList',
                        children: [{
                            type: 'ComplexSelector',
                            children: [{
                                type: 'AttributeSelector',
                                name: {
                                    type: 'Value',
                                    value: 'attr',
                                },
                                operator: {
                                    type: 'Value',
                                    value: '=',
                                },
                                value: {
                                    type: 'Value',
                                    value: 'value with "" quotes',
                                },
                            }],
                        }],
                    },
                },
            });
        });
    });

    describe('uBO — parsed mode', () => {
        test('##^script:has-text(adblock) — parsed selector list', () => {
            const ast = parser.parse('##^script:has-text(adblock)', {
                isLocIncluded: true,
                parseHtmlFilteringRuleBodies: true,
            }) as HtmlFilteringRule;

            expect(ast).toMatchObject({
                type: 'HtmlFilteringRule',
                syntax: SYNTAX_UBO,
                exception: false,
                body: {
                    type: 'HtmlFilteringRuleBody',
                    selectorList: {
                        type: 'SelectorList',
                        children: [{
                            type: 'ComplexSelector',
                            children: [
                                {
                                    type: 'TypeSelector',
                                    value: 'script',
                                },
                                {
                                    type: 'PseudoClassSelector',
                                    name: {
                                        type: 'Value',
                                        value: 'has-text',
                                    },
                                    argument: {
                                        type: 'Value',
                                        value: 'adblock',
                                    },
                                },
                            ],
                        }],
                    },
                },
            });
        });

        test('example.com##^script:has-text(adblock) — parsed with domains', () => {
            const ast = parser.parse('example.com##^script:has-text(adblock)', {
                isLocIncluded: true,
                parseHtmlFilteringRuleBodies: true,
            }) as HtmlFilteringRule;

            expect(ast).toMatchObject({
                type: 'HtmlFilteringRule',
                syntax: SYNTAX_UBO,
                domains: {
                    type: 'DomainList',
                    children: [{
                        type: 'Domain',
                        value: 'example.com',
                    }],
                },
                body: {
                    type: 'HtmlFilteringRuleBody',
                    selectorList: {
                        type: 'SelectorList',
                    },
                },
            });
        });

        test('#@#^script:has-text(adblock) — parsed exception', () => {
            const ast = parser.parse('#@#^script:has-text(adblock)', {
                isLocIncluded: true,
                parseHtmlFilteringRuleBodies: true,
            }) as HtmlFilteringRule;

            expect(ast).toMatchObject({
                type: 'HtmlFilteringRule',
                syntax: SYNTAX_UBO,
                exception: true,
                body: {
                    type: 'HtmlFilteringRuleBody',
                },
            });
        });
    });

    describe('uBO responseheader — parsed mode', () => {
        test('##^responseheader(Test) — parsed responseheader', () => {
            const ast = parser.parse('##^responseheader(Test)', {
                isLocIncluded: true,
                parseHtmlFilteringRuleBodies: true,
            }) as HtmlFilteringRule;

            expect(ast).toMatchObject({
                type: 'HtmlFilteringRule',
                syntax: SYNTAX_UBO,
                exception: false,
                body: {
                    type: 'HtmlFilteringRuleBody',
                    selectorList: {
                        type: 'SelectorList',
                        children: [{
                            type: 'ComplexSelector',
                            children: [{
                                type: 'PseudoClassSelector',
                                name: {
                                    type: 'Value',
                                    value: 'responseheader',
                                },
                                argument: {
                                    type: 'Value',
                                    value: 'Test',
                                },
                            }],
                        }],
                    },
                },
            });
        });

        test('example.com##^responseheader(Test) — with domain', () => {
            const ast = parser.parse('example.com##^responseheader(Test)', {
                isLocIncluded: true,
                parseHtmlFilteringRuleBodies: true,
            }) as HtmlFilteringRule;

            expect(ast).toMatchObject({
                type: 'HtmlFilteringRule',
                syntax: SYNTAX_UBO,
                domains: {
                    type: 'DomainList',
                    children: [{
                        type: 'Domain',
                        value: 'example.com',
                    }],
                },
                body: {
                    type: 'HtmlFilteringRuleBody',
                    selectorList: {
                        type: 'SelectorList',
                        children: [{
                            type: 'ComplexSelector',
                            children: [{
                                type: 'PseudoClassSelector',
                                name: {
                                    type: 'Value',
                                    value: 'responseheader',
                                },
                                argument: {
                                    type: 'Value',
                                    value: 'Test',
                                },
                            }],
                        }],
                    },
                },
            });
        });
    });

    describe('without location info', () => {
        test('$$script[tag-content="adblock"] — no start/end', () => {
            const ast = parser.parse('$$script[tag-content="adblock"]') as HtmlFilteringRule;

            expect(ast).toMatchObject({
                type: 'HtmlFilteringRule',
                syntax: SYNTAX_ADG,
            });
            expect(ast).not.toHaveProperty('start');
            expect(ast).not.toHaveProperty('end');
            expect(ast.body).not.toHaveProperty('start');
            expect(ast.body).not.toHaveProperty('end');
        });

        test('##^script:has-text(adblock) — no start/end', () => {
            const ast = parser.parse('##^script:has-text(adblock)') as HtmlFilteringRule;

            expect(ast).toMatchObject({
                type: 'HtmlFilteringRule',
                syntax: SYNTAX_UBO,
            });
            expect(ast).not.toHaveProperty('start');
            expect(ast).not.toHaveProperty('end');
        });
    });
});
