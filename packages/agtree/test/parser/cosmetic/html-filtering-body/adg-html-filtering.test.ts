import { describe, expect, test } from 'vitest';

import { NodeExpectContext, type NodeExpectFn } from '../../../helpers/node-utils';
import { type HtmlFilteringRuleBody } from '../../../../src';
import {
    AdgHtmlFilteringBodyParser,
} from '../../../../src/parser/cosmetic/html-filtering-body/adg-html-filtering-body-parser';
import {
    AdgHtmlFilteringBodyGenerator,
} from '../../../../src/generator/cosmetic/html-filtering-body/adg-html-filtering-body-generator';
import {
    AdgHtmlFilteringBodySerializer,
} from '../../../../src/serializer/cosmetic/html-filtering-body/adg-html-filtering-body-serializer';
import {
    AdgHtmlFilteringBodyDeserializer,
} from '../../../../src/deserializer/cosmetic/html-filtering-body/adg-html-filtering-body-deserializer';

/**
 * Please note that most of the test cases are covered in `html-filtering.test.ts` file,
 * this file is mainly for testing ADG specific cases and ensuring
 * the ADG parser/generator/serializer/deserializer are wired up correctly.
 */
describe('AdgHtmlFilteringBodyParser', () => {
    describe('AdgHtmlFilteringBodyParser.parse - valid cases', () => {
        test.each<{ actual: string; expected: NodeExpectFn<HtmlFilteringRuleBody> }>([
            // attribute - double quotes are escaped - in middle
            {
                actual: '[attr="value with "" quotes"]',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [{
                            type: 'HtmlFilteringRuleSelector',
                            children: [{
                                type: 'HtmlFilteringRuleSelectorAttribute',
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
                                ...context.getRangeFor('[attr="value with "" quotes"]'),
                            }],
                            ...context.getRangeFor('[attr="value with "" quotes"]'),
                        }],
                        ...context.getRangeFor('[attr="value with "" quotes"]'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute - double quotes are escaped - at beginning
            {
                actual: '[attr=""" value with quotes"]',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [{
                            type: 'HtmlFilteringRuleSelector',
                            children: [{
                                type: 'HtmlFilteringRuleSelectorAttribute',
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
                                ...context.getRangeFor('[attr=""" value with quotes"]'),
                            }],
                            ...context.getRangeFor('[attr=""" value with quotes"]'),
                        }],
                        ...context.getRangeFor('[attr=""" value with quotes"]'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute - double quotes are escaped - at end
            {
                actual: '[attr="value with quotes """]',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [{
                            type: 'HtmlFilteringRuleSelector',
                            children: [{
                                type: 'HtmlFilteringRuleSelectorAttribute',
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
                                ...context.getRangeFor('[attr="value with quotes """]'),
                            }],
                            ...context.getRangeFor('[attr="value with quotes """]'),
                        }],
                        ...context.getRangeFor('[attr="value with quotes """]'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute - double quotes are not escaped - single quotes - in middle
            {
                actual: '[attr=\'value with " quotes\']',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [{
                            type: 'HtmlFilteringRuleSelector',
                            children: [{
                                type: 'HtmlFilteringRuleSelectorAttribute',
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
                                ...context.getRangeFor('[attr=\'value with " quotes\']'),
                            }],
                            ...context.getRangeFor('[attr=\'value with " quotes\']'),
                        }],
                        ...context.getRangeFor('[attr=\'value with " quotes\']'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute - double quotes are not escaped - single quotes - at beginning
            {
                actual: '[attr=\'" value with quotes\']',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [{
                            type: 'HtmlFilteringRuleSelector',
                            children: [{
                                type: 'HtmlFilteringRuleSelectorAttribute',
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
                                ...context.getRangeFor('[attr=\'" value with quotes\']'),
                            }],
                            ...context.getRangeFor('[attr=\'" value with quotes\']'),
                        }],
                        ...context.getRangeFor('[attr=\'" value with quotes\']'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute - double quotes are not escaped - single quotes - at end
            {
                actual: '[attr=\'value with quotes "\']',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [{
                            type: 'HtmlFilteringRuleSelector',
                            children: [{
                                type: 'HtmlFilteringRuleSelectorAttribute',
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
                                ...context.getRangeFor('[attr=\'value with quotes "\']'),
                            }],
                            ...context.getRangeFor('[attr=\'value with quotes "\']'),
                        }],
                        ...context.getRangeFor('[attr=\'value with quotes "\']'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute - double quotes are not escaped - single quotes - in middle
            {
                actual: '[attr=\'value with "" quotes\']',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [{
                            type: 'HtmlFilteringRuleSelector',
                            children: [{
                                type: 'HtmlFilteringRuleSelectorAttribute',
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
                                ...context.getRangeFor('[attr=\'value with "" quotes\']'),
                            }],
                            ...context.getRangeFor('[attr=\'value with "" quotes\']'),
                        }],
                        ...context.getRangeFor('[attr=\'value with "" quotes\']'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute - double quotes are not escaped - single quotes - at beginning
            {
                actual: '[attr=\'"" value with quotes\']',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [{
                            type: 'HtmlFilteringRuleSelector',
                            children: [{
                                type: 'HtmlFilteringRuleSelectorAttribute',
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
                                ...context.getRangeFor('[attr=\'"" value with quotes\']'),
                            }],
                            ...context.getRangeFor('[attr=\'"" value with quotes\']'),
                        }],
                        ...context.getRangeFor('[attr=\'"" value with quotes\']'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute - double quotes are not escaped - single quotes - at end
            {
                actual: '[attr=\'value with quotes ""\']',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [{
                            type: 'HtmlFilteringRuleSelector',
                            children: [{
                                type: 'HtmlFilteringRuleSelectorAttribute',
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
                                ...context.getRangeFor('[attr=\'value with quotes ""\']'),
                            }],
                            ...context.getRangeFor('[attr=\'value with quotes ""\']'),
                        }],
                        ...context.getRangeFor('[attr=\'value with quotes ""\']'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // pseudo class - double quotes are not escaped - in middle
            {
                actual: ':pseudo("value with "" quotes")',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [{
                            type: 'HtmlFilteringRuleSelector',
                            children: [{
                                type: 'HtmlFilteringRuleSelectorPseudoClass',
                                name: {
                                    type: 'Value',
                                    value: 'pseudo',
                                    ...context.getRangeFor('pseudo'),
                                },
                                isFunction: true,
                                argument: {
                                    type: 'Value',
                                    value: '"value with "" quotes"',
                                    ...context.getRangeFor('"value with "" quotes"'),
                                },
                                ...context.getRangeFor(':pseudo("value with "" quotes")'),
                            }],
                            ...context.getRangeFor(':pseudo("value with "" quotes")'),
                        }],
                        ...context.getRangeFor(':pseudo("value with "" quotes")'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // pseudo class - double quotes are not escaped - at beginning
            {
                actual: ':pseudo(""" value with quotes")',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [{
                            type: 'HtmlFilteringRuleSelector',
                            children: [{
                                type: 'HtmlFilteringRuleSelectorPseudoClass',
                                name: {
                                    type: 'Value',
                                    value: 'pseudo',
                                    ...context.getRangeFor('pseudo'),
                                },
                                isFunction: true,
                                argument: {
                                    type: 'Value',
                                    value: '""" value with quotes"',
                                    ...context.getRangeFor('""" value with quotes"'),
                                },
                                ...context.getRangeFor(':pseudo(""" value with quotes")'),
                            }],
                            ...context.getRangeFor(':pseudo(""" value with quotes")'),
                        }],
                        ...context.getRangeFor(':pseudo(""" value with quotes")'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // pseudo class - double quotes are not escaped - at end
            {
                actual: ':pseudo("value with quotes """)',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [{
                            type: 'HtmlFilteringRuleSelector',
                            children: [{
                                type: 'HtmlFilteringRuleSelectorPseudoClass',
                                name: {
                                    type: 'Value',
                                    value: 'pseudo',
                                    ...context.getRangeFor('pseudo'),
                                },
                                isFunction: true,
                                argument: {
                                    type: 'Value',
                                    value: '"value with quotes """',
                                    ...context.getRangeFor('"value with quotes """'),
                                },
                                ...context.getRangeFor(':pseudo("value with quotes """)'),
                            }],
                            ...context.getRangeFor(':pseudo("value with quotes """)'),
                        }],
                        ...context.getRangeFor(':pseudo("value with quotes """)'),
                    }],
                    ...context.getFullRange(),
                }),
            },
        ])("should parse '$actual'", ({ actual, expected: expectedFn }) => {
            expect(AdgHtmlFilteringBodyParser.parse(actual)).toEqual(
                expectedFn(new NodeExpectContext(actual)),
            );
        });
    });

    describe('AdgHtmlFilteringBodyGenerator.generate', () => {
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
        ])("should generate '$expected' from '$actual'", ({ actual, expected }) => {
            const ruleNode = AdgHtmlFilteringBodyParser.parse(actual);

            if (ruleNode === null) {
                throw new Error(`Failed to parse '${actual}' as cosmetic rule`);
            }

            expect(AdgHtmlFilteringBodyGenerator.generate(ruleNode)).toBe(expected);
        });
    });

    describe('serialize & deserialize', () => {
        test.each([
            '[attr="value with "" quotes"]',
            '[attr=""" value with quotes"]',
            '[attr="value with quotes """]',
            '[attr=\'value with " quotes\']',
            '[attr=\'" value with quotes\']',
            '[attr=\'value with quotes "\']',
            '[attr=\'value with "" quotes\']',
            '[attr=\'"" value with quotes\']',
            '[attr=\'value with quotes ""\']',
            ':pseudo("value with "" quotes")',
            ':pseudo(""" value with quotes")',
            ':pseudo("value with quotes """)',
        ])("should serialize and deserialize '%p'", async (input) => {
            await expect(input).toBeSerializedAndDeserializedProperly(
                AdgHtmlFilteringBodyParser,
                AdgHtmlFilteringBodyGenerator,
                AdgHtmlFilteringBodySerializer,
                AdgHtmlFilteringBodyDeserializer,
            );
        });
    });
});
