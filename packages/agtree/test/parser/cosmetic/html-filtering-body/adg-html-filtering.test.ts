import { describe, expect, test } from 'vitest';

import { NodeExpectContext, type NodeExpectFn } from '../../../helpers/node-utils';
import { type Value, type HtmlFilteringRuleBody } from '../../../../src';
import {
    AdgHtmlFilteringBodyParser,
} from '../../../../src/parser/cosmetic/html-filtering-body/adg-html-filtering-body-parser';
import {
    AdgHtmlFilteringBodyGenerator,
} from '../../../../src/generator/cosmetic/html-filtering-body/adg-html-filtering-body-generator';
import { defaultParserOptions, type ParserOptions } from '../../../../src/parser/options';

/**
 * Default parser options with HTML filtering rules parsing enabled.
 */
const parsingEnabledDefaultParserOptions: ParserOptions = {
    ...defaultParserOptions,
    parseHtmlFilteringRuleBodies: true,
};

/**
 * Please note that most of the test cases are covered in `html-filtering.test.ts` file,
 * this file is mainly for testing ADG specific cases and ensuring
 * the ADG parser/generator/serializer/deserializer are wired up correctly.
 */
describe('AdgHtmlFilteringBodyParser', () => {
    describe('AdgHtmlFilteringBodyParser.parse - valid cases (parsed)', () => {
        test.each<{ actual: string; expected: NodeExpectFn<HtmlFilteringRuleBody> }>([
            // attribute - double quotes are escaped - in middle
            {
                actual: '[attr="value with "" quotes"]',
                expected: (context) => ({
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
                                    ...context.getRangeFor('attr'),
                                },
                                operator: {
                                    type: 'Value',
                                    value: '=',
                                    ...context.getRangeFor('='),
                                },
                                value: {
                                    type: 'Value',
                                    value: 'value with " quotes',
                                    ...context.getRangeFor('value with "" quotes'),
                                },
                                ...context.getFullRange(),
                            }],
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    },
                    ...context.getFullRange(),
                }),
            },

            // attribute - double quotes are escaped - at beginning
            {
                actual: '[attr=""" value with quotes"]',
                expected: (context) => ({
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
                                    ...context.getRangeFor('attr'),
                                },
                                operator: {
                                    type: 'Value',
                                    value: '=',
                                    ...context.getRangeFor('='),
                                },
                                value: {
                                    type: 'Value',
                                    value: '" value with quotes',
                                    ...context.getRangeFor('"" value with quotes'),
                                },
                                ...context.getFullRange(),
                            }],
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    },
                    ...context.getFullRange(),
                }),
            },

            // attribute - double quotes are escaped - at end
            {
                actual: '[attr="value with quotes """]',
                expected: (context) => ({
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
                                    ...context.getRangeFor('attr'),
                                },
                                operator: {
                                    type: 'Value',
                                    value: '=',
                                    ...context.getRangeFor('='),
                                },
                                value: {
                                    type: 'Value',
                                    value: 'value with quotes "',
                                    ...context.getRangeFor('value with quotes ""'),
                                },
                                ...context.getFullRange(),
                            }],
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    },
                    ...context.getFullRange(),
                }),
            },

            // attribute - double quotes are escaped - attribute pattern inside of the value
            {
                actual: '[attr="[attr=""test""]"]',
                expected: (context) => ({
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
                                    ...context.getRangeFor('attr'),
                                },
                                operator: {
                                    type: 'Value',
                                    value: '=',
                                    ...context.getRangeFor('='),
                                },
                                value: {
                                    type: 'Value',
                                    value: '[attr="test"]',
                                    ...context.getRangeFor('[attr=""test""]'),
                                },
                                ...context.getFullRange(),
                            }],
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    },
                    ...context.getFullRange(),
                }),
            },

            // attribute - double quotes are not escaped - single quotes - in middle
            {
                actual: '[attr=\'value with " quotes\']',
                expected: (context) => ({
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
                                    ...context.getRangeFor('attr'),
                                },
                                operator: {
                                    type: 'Value',
                                    value: '=',
                                    ...context.getRangeFor('='),
                                },
                                value: {
                                    type: 'Value',
                                    value: 'value with " quotes',
                                    ...context.getRangeFor('value with " quotes'),
                                },
                                ...context.getFullRange(),
                            }],
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    },
                    ...context.getFullRange(),
                }),
            },

            // attribute - double quotes are not escaped - single quotes - at beginning
            {
                actual: '[attr=\'" value with quotes\']',
                expected: (context) => ({
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
                                    ...context.getRangeFor('attr'),
                                },
                                operator: {
                                    type: 'Value',
                                    value: '=',
                                    ...context.getRangeFor('='),
                                },
                                value: {
                                    type: 'Value',
                                    value: '" value with quotes',
                                    ...context.getRangeFor('" value with quotes'),
                                },
                                ...context.getFullRange(),
                            }],
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    },
                    ...context.getFullRange(),
                }),
            },

            // attribute - double quotes are not escaped - single quotes - at end
            {
                actual: '[attr=\'value with quotes "\']',
                expected: (context) => ({
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
                                    ...context.getRangeFor('attr'),
                                },
                                operator: {
                                    type: 'Value',
                                    value: '=',
                                    ...context.getRangeFor('='),
                                },
                                value: {
                                    type: 'Value',
                                    value: 'value with quotes "',
                                    ...context.getRangeFor('value with quotes "'),
                                },
                                ...context.getFullRange(),
                            }],
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    },
                    ...context.getFullRange(),
                }),
            },

            // attribute - double quotes are not escaped - single quotes - in middle
            {
                actual: '[attr=\'value with "" quotes\']',
                expected: (context) => ({
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
                                    ...context.getRangeFor('attr'),
                                },
                                operator: {
                                    type: 'Value',
                                    value: '=',
                                    ...context.getRangeFor('='),
                                },
                                value: {
                                    type: 'Value',
                                    value: 'value with "" quotes',
                                    ...context.getRangeFor('value with "" quotes'),
                                },
                                ...context.getFullRange(),
                            }],
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    },
                    ...context.getFullRange(),
                }),
            },

            // attribute - double quotes are not escaped - single quotes - at beginning
            {
                actual: '[attr=\'"" value with quotes\']',
                expected: (context) => ({
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
                                    ...context.getRangeFor('attr'),
                                },
                                operator: {
                                    type: 'Value',
                                    value: '=',
                                    ...context.getRangeFor('='),
                                },
                                value: {
                                    type: 'Value',
                                    value: '"" value with quotes',
                                    ...context.getRangeFor('"" value with quotes'),
                                },
                                ...context.getFullRange(),
                            }],
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    },
                    ...context.getFullRange(),
                }),
            },

            // attribute - double quotes are not escaped - single quotes - at end
            {
                actual: '[attr=\'value with quotes ""\']',
                expected: (context) => ({
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
                                    ...context.getRangeFor('attr'),
                                },
                                operator: {
                                    type: 'Value',
                                    value: '=',
                                    ...context.getRangeFor('='),
                                },
                                value: {
                                    type: 'Value',
                                    value: 'value with quotes ""',
                                    ...context.getRangeFor('value with quotes ""'),
                                },
                                ...context.getFullRange(),
                            }],
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    },
                    ...context.getFullRange(),
                }),
            },

            // attribute - double quotes are not escaped - attribute pattern inside of the value but with single quotes
            {
                actual: '[attr=\'[attr=""test""]\']',
                expected: (context) => ({
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
                                    ...context.getRangeFor('attr'),
                                },
                                operator: {
                                    type: 'Value',
                                    value: '=',
                                    ...context.getRangeFor('='),
                                },
                                value: {
                                    type: 'Value',
                                    value: '[attr=""test""]',
                                    ...context.getRangeFor('[attr=""test""]'),
                                },
                                ...context.getFullRange(),
                            }],
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    },
                    ...context.getFullRange(),
                }),
            },

            // pseudo-class - double quotes are not escaped - in middle
            {
                actual: ':pseudo("value with "" quotes")',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    selectorList: {
                        type: 'SelectorList',
                        children: [{
                            type: 'ComplexSelector',
                            children: [{
                                type: 'PseudoClassSelector',
                                name: {
                                    type: 'Value',
                                    value: 'pseudo',
                                    ...context.getRangeFor('pseudo'),
                                },
                                argument: {
                                    type: 'Value',
                                    value: '"value with "" quotes"',
                                    ...context.getRangeFor('"value with "" quotes"'),
                                },
                                ...context.getFullRange(),
                            }],
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    },
                    ...context.getFullRange(),
                }),
            },

            // pseudo-class - double quotes are not escaped - at beginning
            {
                actual: ':pseudo(""" value with quotes")',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    selectorList: {
                        type: 'SelectorList',
                        children: [{
                            type: 'ComplexSelector',
                            children: [{
                                type: 'PseudoClassSelector',
                                name: {
                                    type: 'Value',
                                    value: 'pseudo',
                                    ...context.getRangeFor('pseudo'),
                                },
                                argument: {
                                    type: 'Value',
                                    value: '""" value with quotes"',
                                    ...context.getRangeFor('""" value with quotes"'),
                                },
                                ...context.getFullRange(),
                            }],
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    },
                    ...context.getFullRange(),
                }),
            },

            // pseudo-class - double quotes are not escaped - at end
            {
                actual: ':pseudo("value with quotes """)',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    selectorList: {
                        type: 'SelectorList',
                        children: [{
                            type: 'ComplexSelector',
                            children: [{
                                type: 'PseudoClassSelector',
                                name: {
                                    type: 'Value',
                                    value: 'pseudo',
                                    ...context.getRangeFor('pseudo'),
                                },
                                argument: {
                                    type: 'Value',
                                    value: '"value with quotes """',
                                    ...context.getRangeFor('"value with quotes """'),
                                },
                                ...context.getFullRange(),
                            }],
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    },
                    ...context.getFullRange(),
                }),
            },

            // pseudo-class - double quotes are not escaped - attribute pattern inside of the value of pseudo-class
            {
                actual: ':pseudo("[attr=""test""]")',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    selectorList: {
                        type: 'SelectorList',
                        children: [{
                            type: 'ComplexSelector',
                            children: [{
                                type: 'PseudoClassSelector',
                                name: {
                                    type: 'Value',
                                    value: 'pseudo',
                                    ...context.getRangeFor('pseudo'),
                                },
                                argument: {
                                    type: 'Value',
                                    value: '"[attr=""test""]"',
                                    ...context.getRangeFor('"[attr=""test""]"'),
                                },
                                ...context.getFullRange(),
                            }],
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    },
                    ...context.getFullRange(),
                }),
            },
        ])("should parse '$actual'", ({ actual, expected: expectedFn }) => {
            expect(AdgHtmlFilteringBodyParser.parse(actual, parsingEnabledDefaultParserOptions)).toEqual(
                expectedFn(new NodeExpectContext(actual)),
            );
        });
    });

    describe('AdgHtmlFilteringBodyGenerator.generate (parsed)', () => {
        test.each<{ actual: string; expected: string }>([
            {
                actual: '[attr="value with "" quotes"]',
                expected: '[attr="value with "" quotes"]',
            },
            {
                actual: '[attr=""" value with quotes"]',
                expected: '[attr=""" value with quotes"]',
            },
            {
                actual: '[attr="value with quotes """]',
                expected: '[attr="value with quotes """]',
            },
            {
                actual: '[attr="[attr=""test""]"]',
                expected: '[attr="[attr=""test""]"]',
            },
            {
                actual: '[attr=\'value with " quotes\']',
                expected: '[attr="value with "" quotes"]',
            },
            {
                actual: '[attr=\'" value with quotes\']',
                expected: '[attr=""" value with quotes"]',
            },
            {
                actual: '[attr=\'value with quotes "\']',
                expected: '[attr="value with quotes """]',
            },
            {
                actual: '[attr=\'value with "" quotes\']',
                expected: '[attr="value with """" quotes"]',
            },
            {
                actual: '[attr=\'"" value with quotes\']',
                expected: '[attr=""""" value with quotes"]',
            },
            {
                actual: '[attr=\'value with quotes ""\']',
                expected: '[attr="value with quotes """""]',
            },
            {
                actual: '[attr=\'[attr=""test""]\']',
                expected: '[attr="[attr=""""test""""]"]',
            },
            {
                actual: ':pseudo("value with "" quotes")',
                expected: ':pseudo("value with "" quotes")',
            },
            {
                actual: ':pseudo(""" value with quotes")',
                expected: ':pseudo(""" value with quotes")',
            },
            {
                actual: ':pseudo("value with quotes """)',
                expected: ':pseudo("value with quotes """)',
            },
            {
                actual: ':pseudo("[attr=""test""]")',
                expected: ':pseudo("[attr=""test""]")',
            },
        ])("should generate '$expected' from '$actual'", ({ actual, expected }) => {
            const ruleNode = AdgHtmlFilteringBodyParser.parse(actual, parsingEnabledDefaultParserOptions);

            if (ruleNode === null) {
                throw new Error(`Failed to parse '${actual}' as cosmetic rule`);
            }

            expect(AdgHtmlFilteringBodyGenerator.generate(ruleNode)).toBe(expected);
        });
    });

    /**
     * Please not that if parsing is disabled, the parser will pass body value as-is,
     * so these test cases are mainly to ensure that the ADG parser/generator/serializer/deserializer
     * are wired up correctly. And since no parsing is done, the expected values are the same as the actual ones.
     * And there is no need to test invalid cases here, as with parsing disabled,
     * the parser will not be able to detect any invalid syntax.
     *
     * Only double quote escaping is handled by the parser even with parsing disabled.
     */
    describe('AdgHtmlFilteringBodyParser.parse - valid cases (raw)', () => {
        test.each<{ actual: string; expected: NodeExpectFn<Value> }>([
            {
                actual: '[attr="value with "" quotes"]',
                expected: (context) => ({
                    type: 'Value',
                    value: '[attr="value with \\" quotes"]',
                    ...context.getFullRange(),
                }),
            },
            {
                actual: '[attr="[attr=""test""]"]',
                expected: (context) => ({
                    type: 'Value',
                    value: '[attr="[attr=\\"test\\"]"]',
                    ...context.getFullRange(),
                }),
            },
            {
                actual: '[attr=\'value with " quotes\']',
                expected: (context) => ({
                    type: 'Value',
                    value: '[attr=\'value with " quotes\']',
                    ...context.getFullRange(),
                }),
            },
            {
                actual: '[attr=\'value with "" quotes\']',
                expected: (context) => ({
                    type: 'Value',
                    value: '[attr=\'value with "" quotes\']',
                    ...context.getFullRange(),
                }),
            },
            {
                actual: '[attr=\'[attr=""test""]\']',
                expected: (context) => ({
                    type: 'Value',
                    value: '[attr=\'[attr=""test""]\']',
                    ...context.getFullRange(),
                }),
            },
            {
                actual: ':pseudo("value with "" quotes")',
                expected: (context) => ({
                    type: 'Value',
                    value: ':pseudo("value with "" quotes")',
                    ...context.getFullRange(),
                }),
            },
            {
                actual: ':pseudo("[attr=""test""]")',
                expected: (context) => ({
                    type: 'Value',
                    value: ':pseudo("[attr=""test""]")',
                    ...context.getFullRange(),
                }),
            },
        ])("should parse '$actual'", ({ actual, expected: expectedFn }) => {
            expect(AdgHtmlFilteringBodyParser.parse(actual)).toEqual(
                expectedFn(new NodeExpectContext(actual)),
            );
        });
    });

    describe('AdgHtmlFilteringBodyGenerator.generate (raw)', () => {
        test.each<{ actual: string; expected: string }>([
            {
                actual: '[attr="value with "" quotes"]',
                expected: '[attr="value with "" quotes"]',
            },
            {
                actual: '[attr="[attr=""test""]"]',
                expected: '[attr="[attr=""test""]"]',
            },
            {
                actual: '[attr=\'value with " quotes\']',
                expected: '[attr=\'value with " quotes\']',
            },
            {
                actual: '[attr=\'value with "" quotes\']',
                expected: '[attr=\'value with "" quotes\']',
            },
            {
                actual: '[attr=\'[attr=""test""]\']',
                expected: '[attr=\'[attr=""test""]\']',
            },
            {
                actual: ':pseudo("value with "" quotes")',
                expected: ':pseudo("value with "" quotes")',
            },
            {
                actual: ':pseudo("[attr=""test""]")',
                expected: ':pseudo("[attr=""test""]")',
            },
        ])("should generate '$expected' from '$actual'", ({ actual, expected }) => {
            const ruleNode = AdgHtmlFilteringBodyParser.parse(actual);

            if (ruleNode === null) {
                throw new Error(`Failed to parse '${actual}' as cosmetic rule`);
            }

            expect(AdgHtmlFilteringBodyGenerator.generate(ruleNode)).toBe(expected);
        });
    });
});
