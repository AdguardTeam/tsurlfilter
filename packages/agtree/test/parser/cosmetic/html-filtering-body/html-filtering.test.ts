import {
    describe,
    expect,
    test,
    vi,
} from 'vitest';

import { NodeExpectContext, type NodeExpectFn } from '../../../helpers/node-utils';
import { AdblockSyntaxError, type HtmlFilteringRuleBody } from '../../../../src';
import {
    HtmlFilteringBodyParser,
} from '../../../../src/parser/cosmetic/html-filtering-body/html-filtering-body-parser';
import {
    HtmlFilteringBodyGenerator,
} from '../../../../src/generator/cosmetic/html-filtering-body/html-filtering-body-generator';
import {
    HtmlFilteringBodySerializer,
} from '../../../../src/serializer/cosmetic/html-filtering-body/html-filtering-body-serializer';
import {
    HtmlFilteringBodyDeserializer,
} from '../../../../src/deserializer/cosmetic/html-filtering-body/html-filtering-body-deserializer';

describe('HtmlFilteringBodyParser', () => {
    describe('HtmlFilteringBodyParser.parse - valid cases', () => {
        test.each<{ actual: string; expected: NodeExpectFn<HtmlFilteringRuleBody> }>([
            // tag name only
            {
                actual: 'div',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [{
                            type: 'HtmlFilteringRuleSelector',
                            children: [{
                                type: 'Value',
                                value: 'div',
                                ...context.getRangeFor('div'),
                            }],
                            ...context.getRangeFor('div'),
                        }],
                        ...context.getRangeFor('div'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // tag name only - with hyphen
            {
                actual: 'my-tag',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [{
                            type: 'HtmlFilteringRuleSelector',
                            children: [{
                                type: 'Value',
                                value: 'my-tag',
                                ...context.getRangeFor('my-tag'),
                            }],
                            ...context.getRangeFor('my-tag'),
                        }],
                        ...context.getRangeFor('my-tag'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // tag name only - with underscore
            {
                actual: 'my_tag',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [{
                            type: 'HtmlFilteringRuleSelector',
                            children: [{
                                type: 'Value',
                                value: 'my_tag',
                                ...context.getRangeFor('my_tag'),
                            }],
                            ...context.getRangeFor('my_tag'),
                        }],
                        ...context.getRangeFor('my_tag'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // id only
            {
                actual: '#id',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [{
                            type: 'HtmlFilteringRuleSelector',
                            children: [{
                                type: 'Value',
                                value: '#id',
                                ...context.getRangeFor('#id'),
                            }],
                            ...context.getRangeFor('#id'),
                        }],
                        ...context.getRangeFor('#id'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // id only - with hyphen
            {
                actual: '#my-id',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [{
                            type: 'HtmlFilteringRuleSelector',
                            children: [{
                                type: 'Value',
                                value: '#my-id',
                                ...context.getRangeFor('#my-id'),
                            }],
                            ...context.getRangeFor('#my-id'),
                        }],
                        ...context.getRangeFor('#my-id'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // id only - with underscore
            {
                actual: '#my_id',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [{
                            type: 'HtmlFilteringRuleSelector',
                            children: [{
                                type: 'Value',
                                value: '#my_id',
                                ...context.getRangeFor('#my_id'),
                            }],
                            ...context.getRangeFor('#my_id'),
                        }],
                        ...context.getRangeFor('#my_id'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // id only - start with hyphen
            {
                actual: '#-myid',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [{
                            type: 'HtmlFilteringRuleSelector',
                            children: [{
                                type: 'Value',
                                value: '#-myid',
                                ...context.getRangeFor('#-myid'),
                            }],
                            ...context.getRangeFor('#-myid'),
                        }],
                        ...context.getRangeFor('#-myid'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // class name only
            {
                actual: '.class',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [{
                            type: 'HtmlFilteringRuleSelector',
                            children: [{
                                type: 'Value',
                                value: '.class',
                                ...context.getRangeFor('.class'),
                            }],
                            ...context.getRangeFor('.class'),
                        }],
                        ...context.getRangeFor('.class'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // class name only - with hyphen
            {
                actual: '.my-class',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [{
                            type: 'HtmlFilteringRuleSelector',
                            children: [{
                                type: 'Value',
                                value: '.my-class',
                                ...context.getRangeFor('.my-class'),
                            }],
                            ...context.getRangeFor('.my-class'),
                        }],
                        ...context.getRangeFor('.my-class'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // class name only - with underscore
            {
                actual: '.my_class',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [{
                            type: 'HtmlFilteringRuleSelector',
                            children: [{
                                type: 'Value',
                                value: '.my_class',
                                ...context.getRangeFor('.my_class'),
                            }],
                            ...context.getRangeFor('.my_class'),
                        }],
                        ...context.getRangeFor('.my_class'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // class name only - start with hyphen
            {
                actual: '.-myclass',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [{
                            type: 'HtmlFilteringRuleSelector',
                            children: [{
                                type: 'Value',
                                value: '.-myclass',
                                ...context.getRangeFor('.-myclass'),
                            }],
                            ...context.getRangeFor('.-myclass'),
                        }],
                        ...context.getRangeFor('.-myclass'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only
            {
                actual: '[attr="value"]',
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
                                    value: 'value',
                                    ...context.getRangeFor('value'),
                                },
                                ...context.getRangeFor('[attr="value"]'),
                            }],
                            ...context.getRangeFor('[attr="value"]'),
                        }],
                        ...context.getRangeFor('[attr="value"]'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - no value
            {
                actual: '[attr]',
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
                                ...context.getRangeFor('[attr]'),
                            }],
                            ...context.getRangeFor('[attr]'),
                        }],
                        ...context.getRangeFor('[attr]'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - unquoted value
            {
                actual: '[attr=value]',
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
                                    value: 'value',
                                    ...context.getRangeFor('value'),
                                },
                                ...context.getRangeFor('[attr=value]'),
                            }],
                            ...context.getRangeFor('[attr=value]'),
                        }],
                        ...context.getRangeFor('[attr=value]'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - single quoted value
            {
                actual: "[attr='value']",
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
                                    value: 'value',
                                    ...context.getRangeFor('value'),
                                },
                                ...context.getRangeFor("[attr='value']"),
                            }],
                            ...context.getRangeFor("[attr='value']"),
                        }],
                        ...context.getRangeFor("[attr='value']"),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - with flag
            {
                actual: '[attr="value" i]',
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
                                    value: 'value',
                                    ...context.getRangeFor('value'),
                                },
                                flag: {
                                    type: 'Value',
                                    value: 'i',
                                    ...context.getRangeFor('i'),
                                },
                                ...context.getRangeFor('[attr="value" i]'),
                            }],
                            ...context.getRangeFor('[attr="value" i]'),
                        }],
                        ...context.getRangeFor('[attr="value" i]'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - with flag and without space
            {
                actual: '[attr="value"i]',
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
                                    value: 'value',
                                    ...context.getRangeFor('value'),
                                },
                                flag: {
                                    type: 'Value',
                                    value: 'i',
                                    ...context.getRangeFor('i'),
                                },
                                ...context.getRangeFor('[attr="value"i]'),
                            }],
                            ...context.getRangeFor('[attr="value"i]'),
                        }],
                        ...context.getRangeFor('[attr="value"i]'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - with flag and unquoted value
            {
                actual: '[attr=value i]',
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
                                    value: 'value',
                                    ...context.getRangeFor('value'),
                                },
                                flag: {
                                    type: 'Value',
                                    value: 'i',
                                    ...context.getRangeFor('i'),
                                },
                                ...context.getRangeFor('[attr=value i]'),
                            }],
                            ...context.getRangeFor('[attr=value i]'),
                        }],
                        ...context.getRangeFor('[attr=value i]'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - with flag and single quoted value
            {
                actual: "[attr='value' i]",
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
                                    value: 'value',
                                    ...context.getRangeFor('value'),
                                },
                                flag: {
                                    type: 'Value',
                                    value: 'i',
                                    ...context.getRangeFor('i'),
                                },
                                ...context.getRangeFor("[attr='value' i]"),
                            }],
                            ...context.getRangeFor("[attr='value' i]"),
                        }],
                        ...context.getRangeFor("[attr='value' i]"),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - ~= operator
            {
                actual: '[attr~="value"]',
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
                                    value: '~=',
                                    ...context.getRangeFor('~='),
                                },
                                value: {
                                    type: 'Value',
                                    value: 'value',
                                    ...context.getRangeFor('value'),
                                },
                                ...context.getRangeFor('[attr~="value"]'),
                            }],
                            ...context.getRangeFor('[attr~="value"]'),
                        }],
                        ...context.getRangeFor('[attr~="value"]'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - ^= operator
            {
                actual: '[attr^="value"]',
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
                                    value: '^=',
                                    ...context.getRangeFor('^='),
                                },
                                value: {
                                    type: 'Value',
                                    value: 'value',
                                    ...context.getRangeFor('value'),
                                },
                                ...context.getRangeFor('[attr^="value"]'),
                            }],
                            ...context.getRangeFor('[attr^="value"]'),
                        }],
                        ...context.getRangeFor('[attr^="value"]'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - $= operator
            {
                actual: '[attr$="value"]',
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
                                    value: '$=',
                                    ...context.getRangeFor('$='),
                                },
                                value: {
                                    type: 'Value',
                                    value: 'value',
                                    ...context.getRangeFor('value'),
                                },
                                ...context.getRangeFor('[attr$="value"]'),
                            }],
                            ...context.getRangeFor('[attr$="value"]'),
                        }],
                        ...context.getRangeFor('[attr$="value"]'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - *= operator
            {
                actual: '[attr*="value"]',
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
                                    value: '*=',
                                    ...context.getRangeFor('*='),
                                },
                                value: {
                                    type: 'Value',
                                    value: 'value',
                                    ...context.getRangeFor('value'),
                                },
                                ...context.getRangeFor('[attr*="value"]'),
                            }],
                            ...context.getRangeFor('[attr*="value"]'),
                        }],
                        ...context.getRangeFor('[attr*="value"]'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - |= operator
            {
                actual: '[attr|="value"]',
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
                                    value: '|=',
                                    ...context.getRangeFor('|='),
                                },
                                value: {
                                    type: 'Value',
                                    value: 'value',
                                    ...context.getRangeFor('value'),
                                },
                                ...context.getRangeFor('[attr|="value"]'),
                            }],
                            ...context.getRangeFor('[attr|="value"]'),
                        }],
                        ...context.getRangeFor('[attr|="value"]'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - name with hyphens
            {
                actual: '[data-test-value="x"]',
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
                                    value: 'data-test-value',
                                    ...context.getRangeFor('data-test-value'),
                                },
                                operator: {
                                    type: 'Value',
                                    value: '=',
                                    ...context.getRangeFor('='),
                                },
                                value: {
                                    type: 'Value',
                                    value: 'x',
                                    ...context.getRangeFor('x'),
                                },
                                ...context.getRangeFor('[data-test-value="x"]'),
                            }],
                            ...context.getRangeFor('[data-test-value="x"]'),
                        }],
                        ...context.getRangeFor('[data-test-value="x"]'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - name with underscore
            {
                actual: '[data_test_value="x"]',
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
                                    value: 'data_test_value',
                                    ...context.getRangeFor('data_test_value'),
                                },
                                operator: {
                                    type: 'Value',
                                    value: '=',
                                    ...context.getRangeFor('='),
                                },
                                value: {
                                    type: 'Value',
                                    value: 'x',
                                    ...context.getRangeFor('x'),
                                },
                                ...context.getRangeFor('[data_test_value="x"]'),
                            }],
                            ...context.getRangeFor('[data_test_value="x"]'),
                        }],
                        ...context.getRangeFor('[data_test_value="x"]'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - name starting with hyphen
            {
                actual: '[-data="x"]',
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
                                    value: '-data',
                                    ...context.getRangeFor('-data'),
                                },
                                operator: {
                                    type: 'Value',
                                    value: '=',
                                    ...context.getRangeFor('='),
                                },
                                value: {
                                    type: 'Value',
                                    value: 'x',
                                    ...context.getRangeFor('x'),
                                },
                                ...context.getRangeFor('[-data="x"]'),
                            }],
                            ...context.getRangeFor('[-data="x"]'),
                        }],
                        ...context.getRangeFor('[-data="x"]'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - empty value
            {
                actual: '[attr=""]',
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
                                    value: '',
                                    start: 7,
                                    end: 7,
                                },
                                ...context.getRangeFor('[attr=""]'),
                            }],
                            ...context.getRangeFor('[attr=""]'),
                        }],
                        ...context.getRangeFor('[attr=""]'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - multiple attributes
            {
                actual: '[attr1="value1"][attr2^="value2"][attr3]',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [{
                            type: 'HtmlFilteringRuleSelector',
                            children: [
                                {
                                    type: 'HtmlFilteringRuleSelectorAttribute',
                                    name: {
                                        type: 'Value',
                                        value: 'attr1',
                                        ...context.getRangeFor('attr1'),
                                    },
                                    operator: {
                                        type: 'Value',
                                        value: '=',
                                        ...context.getRangeFor('='),
                                    },
                                    value: {
                                        type: 'Value',
                                        value: 'value1',
                                        ...context.getRangeFor('value1'),
                                    },
                                    ...context.getRangeFor('[attr1="value1"]'),
                                },
                                {
                                    type: 'HtmlFilteringRuleSelectorAttribute',
                                    name: {
                                        type: 'Value',
                                        value: 'attr2',
                                        ...context.getRangeFor('attr2'),
                                    },
                                    operator: {
                                        type: 'Value',
                                        value: '^=',
                                        ...context.getRangeFor('^='),
                                    },
                                    value: {
                                        type: 'Value',
                                        value: 'value2',
                                        ...context.getRangeFor('value2'),
                                    },
                                    ...context.getRangeFor('[attr2^="value2"]'),
                                },
                                {
                                    type: 'HtmlFilteringRuleSelectorAttribute',
                                    name: {
                                        type: 'Value',
                                        value: 'attr3',
                                        ...context.getRangeFor('attr3'),
                                    },
                                    ...context.getRangeFor('[attr3]'),
                                },
                            ],
                            ...context.getRangeFor('[attr1="value1"][attr2^="value2"][attr3]'),
                        }],
                        ...context.getRangeFor('[attr1="value1"][attr2^="value2"][attr3]'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // pseudo-class only
            {
                actual: ':pseudo(arg)',
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
                                    value: 'arg',
                                    ...context.getRangeFor('arg'),
                                },
                                ...context.getRangeFor(':pseudo(arg)'),
                            }],
                            ...context.getRangeFor(':pseudo(arg)'),
                        }],
                        ...context.getRangeFor(':pseudo(arg)'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // pseudo-class only - without argument
            {
                actual: ':pseudo()',
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
                                ...context.getRangeFor(':pseudo()'),
                            }],
                            ...context.getRangeFor(':pseudo()'),
                        }],
                        ...context.getRangeFor(':pseudo()'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // pseudo-class only - non function
            {
                actual: ':pseudo',
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
                                isFunction: false,
                                ...context.getRangeFor(':pseudo'),
                            }],
                            ...context.getRangeFor(':pseudo'),
                        }],
                        ...context.getRangeFor(':pseudo'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // pseudo-class only - name with hyphens
            {
                actual: ':pseudo-class-name(arg)',
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
                                    value: 'pseudo-class-name',
                                    ...context.getRangeFor('pseudo-class-name'),
                                },
                                isFunction: true,
                                argument: {
                                    type: 'Value',
                                    value: 'arg',
                                    ...context.getRangeFor('arg'),
                                },
                                ...context.getRangeFor(':pseudo-class-name(arg)'),
                            }],
                            ...context.getRangeFor(':pseudo-class-name(arg)'),
                        }],
                        ...context.getRangeFor(':pseudo-class-name(arg)'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // pseudo-class only - name with underscore
            {
                actual: ':pseudo_class_name(arg)',
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
                                    value: 'pseudo_class_name',
                                    ...context.getRangeFor('pseudo_class_name'),
                                },
                                isFunction: true,
                                argument: {
                                    type: 'Value',
                                    value: 'arg',
                                    ...context.getRangeFor('arg'),
                                },
                                ...context.getRangeFor(':pseudo_class_name(arg)'),
                            }],
                            ...context.getRangeFor(':pseudo_class_name(arg)'),
                        }],
                        ...context.getRangeFor(':pseudo_class_name(arg)'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // pseudo-class only - name starting with hyphen
            {
                actual: ':-pseudo(arg)',
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
                                    value: '-pseudo',
                                    ...context.getRangeFor('-pseudo'),
                                },
                                isFunction: true,
                                argument: {
                                    type: 'Value',
                                    value: 'arg',
                                    ...context.getRangeFor('arg'),
                                },
                                ...context.getRangeFor(':-pseudo(arg)'),
                            }],
                            ...context.getRangeFor(':-pseudo(arg)'),
                        }],
                        ...context.getRangeFor(':-pseudo(arg)'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // pseudo-class only - multiple pseudo-classes
            {
                actual: ':pseudo1(arg):pseudo2():pseudo3',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [{
                            type: 'HtmlFilteringRuleSelector',
                            children: [
                                {
                                    type: 'HtmlFilteringRuleSelectorPseudoClass',
                                    name: {
                                        type: 'Value',
                                        value: 'pseudo1',
                                        ...context.getRangeFor('pseudo1'),
                                    },
                                    isFunction: true,
                                    argument: {
                                        type: 'Value',
                                        value: 'arg',
                                        ...context.getRangeFor('arg'),
                                    },
                                    ...context.getRangeFor(':pseudo1(arg)'),
                                },
                                {
                                    type: 'HtmlFilteringRuleSelectorPseudoClass',
                                    name: {
                                        type: 'Value',
                                        value: 'pseudo2',
                                        ...context.getRangeFor('pseudo2'),
                                    },
                                    isFunction: true,
                                    ...context.getRangeFor(':pseudo2()'),
                                },
                                {
                                    type: 'HtmlFilteringRuleSelectorPseudoClass',
                                    name: {
                                        type: 'Value',
                                        value: 'pseudo3',
                                        ...context.getRangeFor('pseudo3'),
                                    },
                                    isFunction: false,
                                    ...context.getRangeFor(':pseudo3'),
                                },
                            ],
                            ...context.getRangeFor(':pseudo1(arg):pseudo2():pseudo3'),
                        }],
                        ...context.getRangeFor(':pseudo1(arg):pseudo2():pseudo3'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // pseudo-class only - native pseudo-classes with nested selector
            {
                actual: ':not(div, span.class)',
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
                                    value: 'not',
                                    ...context.getRangeFor('not'),
                                },
                                isFunction: true,
                                argument: {
                                    type: 'Value',
                                    value: 'div, span.class',
                                    ...context.getRangeFor('div, span.class'),
                                },
                                ...context.getRangeFor(':not(div, span.class)'),
                            }],
                            ...context.getRangeFor(':not(div, span.class)'),
                        }],
                        ...context.getRangeFor(':not(div, span.class)'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // combined selector
            {
                actual: 'div#id.class[attr~="value" i]:pseudo(arg)',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [{
                            type: 'HtmlFilteringRuleSelector',
                            children: [
                                {
                                    type: 'Value',
                                    value: 'div',
                                    ...context.getRangeFor('div'),
                                },
                                {
                                    type: 'Value',
                                    value: '#id',
                                    ...context.getRangeFor('#id'),
                                },
                                {
                                    type: 'Value',
                                    value: '.class',
                                    ...context.getRangeFor('.class'),
                                },
                                {
                                    type: 'HtmlFilteringRuleSelectorAttribute',
                                    name: {
                                        type: 'Value',
                                        value: 'attr',
                                        ...context.getRangeFor('attr'),
                                    },
                                    operator: {
                                        type: 'Value',
                                        value: '~=',
                                        ...context.getRangeFor('~='),
                                    },
                                    value: {
                                        type: 'Value',
                                        value: 'value',
                                        ...context.getRangeFor('value'),
                                    },
                                    flag: {
                                        type: 'Value',
                                        value: 'i',
                                        ...context.getRangeFor('i', 3),
                                    },
                                    ...context.getRangeFor('[attr~="value" i]'),
                                },
                                {
                                    type: 'HtmlFilteringRuleSelectorPseudoClass',
                                    name: {
                                        type: 'Value',
                                        value: 'pseudo',
                                        ...context.getRangeFor('pseudo'),
                                    },
                                    isFunction: true,
                                    argument: {
                                        type: 'Value',
                                        value: 'arg',
                                        ...context.getRangeFor('arg'),
                                    },
                                    ...context.getRangeFor(':pseudo(arg)'),
                                },
                            ],
                            ...context.getRangeFor('div#id.class[attr~="value" i]:pseudo(arg)'),
                        }],
                        ...context.getRangeFor('div#id.class[attr~="value" i]:pseudo(arg)'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // combinator - descendant
            {
                actual: 'div span',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [
                            {
                                type: 'HtmlFilteringRuleSelector',
                                children: [{
                                    type: 'Value',
                                    value: 'div',
                                    ...context.getRangeFor('div'),
                                }],
                                ...context.getRangeFor('div'),
                            },
                            {
                                type: 'HtmlFilteringRuleSelector',
                                children: [{
                                    type: 'Value',
                                    value: 'span',
                                    ...context.getRangeFor('span'),
                                }],
                                combinator: {
                                    type: 'Value',
                                    value: ' ',
                                    ...context.getRangeFor(' '),
                                },
                                ...context.getRangeFor('span'),
                            },
                        ],
                        ...context.getRangeFor('div span'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // combinator - child
            {
                actual: 'div > span',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [
                            {
                                type: 'HtmlFilteringRuleSelector',
                                children: [{
                                    type: 'Value',
                                    value: 'div',
                                    ...context.getRangeFor('div'),
                                }],
                                ...context.getRangeFor('div'),
                            },
                            {
                                type: 'HtmlFilteringRuleSelector',
                                children: [{
                                    type: 'Value',
                                    value: 'span',
                                    ...context.getRangeFor('span'),
                                }],
                                combinator: {
                                    type: 'Value',
                                    value: '>',
                                    ...context.getRangeFor('>'),
                                },
                                ...context.getRangeFor('span'),
                            },
                        ],
                        ...context.getRangeFor('div > span'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // combinator - next sibling
            {
                actual: 'div + span',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [
                            {
                                type: 'HtmlFilteringRuleSelector',
                                children: [{
                                    type: 'Value',
                                    value: 'div',
                                    ...context.getRangeFor('div'),
                                }],
                                ...context.getRangeFor('div'),
                            },
                            {
                                type: 'HtmlFilteringRuleSelector',
                                children: [{
                                    type: 'Value',
                                    value: 'span',
                                    ...context.getRangeFor('span'),
                                }],
                                combinator: {
                                    type: 'Value',
                                    value: '+',
                                    ...context.getRangeFor('+'),
                                },
                                ...context.getRangeFor('span'),
                            },
                        ],
                        ...context.getRangeFor('div + span'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // combinator - sibling
            {
                actual: 'div ~ span',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [
                            {
                                type: 'HtmlFilteringRuleSelector',
                                children: [{
                                    type: 'Value',
                                    value: 'div',
                                    ...context.getRangeFor('div'),
                                }],
                                ...context.getRangeFor('div'),
                            },
                            {
                                type: 'HtmlFilteringRuleSelector',
                                children: [{
                                    type: 'Value',
                                    value: 'span',
                                    ...context.getRangeFor('span'),
                                }],
                                combinator: {
                                    type: 'Value',
                                    value: '~',
                                    ...context.getRangeFor('~'),
                                },
                                ...context.getRangeFor('span'),
                            },
                        ],
                        ...context.getRangeFor('div ~ span'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // combinator - mixed
            {
                actual: 'div > span + a ~ h1',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [
                            {
                                type: 'HtmlFilteringRuleSelector',
                                children: [{
                                    type: 'Value',
                                    value: 'div',
                                    ...context.getRangeFor('div'),
                                }],
                                ...context.getRangeFor('div'),
                            },
                            {
                                type: 'HtmlFilteringRuleSelector',
                                children: [{
                                    type: 'Value',
                                    value: 'span',
                                    ...context.getRangeFor('span'),
                                }],
                                combinator: {
                                    type: 'Value',
                                    value: '>',
                                    ...context.getRangeFor('>'),
                                },
                                ...context.getRangeFor('span'),
                            },
                            {
                                type: 'HtmlFilteringRuleSelector',
                                children: [{
                                    type: 'Value',
                                    value: 'a',
                                    ...context.getRangeFor('a', 2),
                                }],
                                combinator: {
                                    type: 'Value',
                                    value: '+',
                                    ...context.getRangeFor('+'),
                                },
                                ...context.getRangeFor('a', 2),
                            },
                            {
                                type: 'HtmlFilteringRuleSelector',
                                children: [{
                                    type: 'Value',
                                    value: 'h1',
                                    ...context.getRangeFor('h1'),
                                }],
                                combinator: {
                                    type: 'Value',
                                    value: '~',
                                    ...context.getRangeFor('~'),
                                },
                                ...context.getRangeFor('h1'),
                            },
                        ],
                        ...context.getRangeFor('div > span + a ~ h1'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // multiple selector lists
            {
                actual: 'div, span[attr="value"]',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [
                        {
                            type: 'HtmlFilteringRuleSelectorList',
                            children: [{
                                type: 'HtmlFilteringRuleSelector',
                                children: [{
                                    type: 'Value',
                                    value: 'div',
                                    ...context.getRangeFor('div'),
                                }],
                                ...context.getRangeFor('div'),
                            }],
                            ...context.getRangeFor('div'),
                        },
                        {
                            type: 'HtmlFilteringRuleSelectorList',
                            children: [{
                                type: 'HtmlFilteringRuleSelector',
                                children: [
                                    {
                                        type: 'Value',
                                        value: 'span',
                                        ...context.getRangeFor('span'),
                                    },
                                    {
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
                                            value: 'value',
                                            ...context.getRangeFor('value'),
                                        },
                                        ...context.getRangeFor('[attr="value"]'),
                                    },
                                ],
                                ...context.getRangeFor('span[attr="value"]'),
                            }],
                            ...context.getRangeFor('span[attr="value"]'),
                        },
                    ],
                    ...context.getFullRange(),
                }),
            },

            // multiple selector lists with combinators
            {
                actual: 'div > span, .class + #id',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [
                        {
                            type: 'HtmlFilteringRuleSelectorList',
                            children: [
                                {
                                    type: 'HtmlFilteringRuleSelector',
                                    children: [{
                                        type: 'Value',
                                        value: 'div',
                                        ...context.getRangeFor('div'),
                                    }],
                                    ...context.getRangeFor('div'),
                                },
                                {
                                    type: 'HtmlFilteringRuleSelector',
                                    children: [{
                                        type: 'Value',
                                        value: 'span',
                                        ...context.getRangeFor('span'),
                                    }],
                                    combinator: {
                                        type: 'Value',
                                        value: '>',
                                        ...context.getRangeFor('>'),
                                    },
                                    ...context.getRangeFor('span'),
                                },
                            ],
                            ...context.getRangeFor('div > span'),
                        },
                        {
                            type: 'HtmlFilteringRuleSelectorList',
                            children: [
                                {
                                    type: 'HtmlFilteringRuleSelector',
                                    children: [{
                                        type: 'Value',
                                        value: '.class',
                                        ...context.getRangeFor('.class'),
                                    }],
                                    ...context.getRangeFor('.class'),
                                },
                                {
                                    type: 'HtmlFilteringRuleSelector',
                                    children: [{
                                        type: 'Value',
                                        value: '#id',
                                        ...context.getRangeFor('#id'),
                                    }],
                                    combinator: {
                                        type: 'Value',
                                        value: '+',
                                        ...context.getRangeFor('+'),
                                    },
                                    ...context.getRangeFor('#id'),
                                },
                            ],
                            ...context.getRangeFor('.class + #id'),
                        },
                    ],
                    ...context.getFullRange(),
                }),
            },

            // edge case - leading and trailing whitespace
            {
                actual: '   div   ',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [{
                            type: 'HtmlFilteringRuleSelector',
                            children: [{
                                type: 'Value',
                                value: 'div',
                                ...context.getRangeFor('div'),
                            }],
                            ...context.getRangeFor('div'),
                        }],
                        ...context.getRangeFor('div'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // edge case - spaces around combinators
            {
                actual: 'div   >    span',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [
                            {
                                type: 'HtmlFilteringRuleSelector',
                                children: [{
                                    type: 'Value',
                                    value: 'div',
                                    ...context.getRangeFor('div'),
                                }],
                                ...context.getRangeFor('div'),
                            },
                            {
                                type: 'HtmlFilteringRuleSelector',
                                children: [{
                                    type: 'Value',
                                    value: 'span',
                                    ...context.getRangeFor('span'),
                                }],
                                combinator: {
                                    type: 'Value',
                                    value: '>',
                                    ...context.getRangeFor('>'),
                                },
                                ...context.getRangeFor('span'),
                            },
                        ],
                        ...context.getRangeFor('div   >    span'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // edge case - spaces around attribute operator
            {
                actual: '[  attr   =   "value"  ]',
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
                                    value: 'value',
                                    ...context.getRangeFor('value'),
                                },
                                ...context.getRangeFor('[  attr   =   "value"  ]'),
                            }],
                            ...context.getRangeFor('[  attr   =   "value"  ]'),
                        }],
                        ...context.getRangeFor('[  attr   =   "value"  ]'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // edge case - spaces around attribute operator and unquoted value
            {
                actual: '[  attr   =   value  ]',
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
                                    value: 'value',
                                    ...context.getRangeFor('value'),
                                },
                                ...context.getRangeFor('[  attr   =   value  ]'),
                            }],
                            ...context.getRangeFor('[  attr   =   value  ]'),
                        }],
                        ...context.getRangeFor('[  attr   =   value  ]'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // edge case - spaces in pseudo-class function argument
            {
                actual: ':pseudo(  arg with spaces  )',
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
                                    value: 'arg with spaces',
                                    ...context.getRangeFor('arg with spaces'),
                                },
                                ...context.getRangeFor(':pseudo(  arg with spaces  )'),
                            }],
                            ...context.getRangeFor(':pseudo(  arg with spaces  )'),
                        }],
                        ...context.getRangeFor(':pseudo(  arg with spaces  )'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // edge case - quote escape - double quotes
            {
                actual: '[attr="value with \\"escaped\\" quotes"]',
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
                                    value: 'value with "escaped" quotes',
                                    ...context.getRangeFor('value with \\"escaped\\" quotes'),
                                },
                            }],
                            ...context.getRangeFor('[attr="value with \\"escaped\\" quotes"]'),
                        }],
                        ...context.getRangeFor('[attr="value with \\"escaped\\" quotes"]'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // edge case - quote escape - double quotes
            {
                actual: "[attr='value with \\'escaped\\' quotes']",
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
                                    value: "value with 'escaped' quotes",
                                    ...context.getRangeFor("value with \\'escaped\\' quotes"),
                                },
                            }],
                            ...context.getRangeFor("[attr='value with \\'escaped\\' quotes']"),
                        }],
                        ...context.getRangeFor("[attr='value with \\'escaped\\' quotes']"),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // edge case - quote escape - single quotes in double quotes (no escape needed)
            {
                actual: '[attr="value with \'escaped\' quotes"]',
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
                                    value: "value with 'escaped' quotes",
                                    ...context.getRangeFor("value with 'escaped' quotes"),
                                },
                            }],
                            ...context.getRangeFor('[attr="value with \'escaped\' quotes"]'),
                        }],
                        ...context.getRangeFor('[attr="value with \'escaped\' quotes"]'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // edge case - quote escape - double quotes in single quotes (no escape needed)
            {
                actual: "[attr='value with \"escaped\" quotes']",
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
                                    value: 'value with "escaped" quotes',
                                    ...context.getRangeFor('value with "escaped" quotes'),
                                },
                            }],
                            ...context.getRangeFor("[attr='value with \"escaped\" quotes']"),
                        }],
                        ...context.getRangeFor("[attr='value with \"escaped\" quotes']"),
                    }],
                    ...context.getFullRange(),
                }),
            },
        ])("should parse '$actual'", ({ actual, expected: expectedFn }) => {
            expect(HtmlFilteringBodyParser.parse(actual)).toMatchObject(
                expectedFn(new NodeExpectContext(actual)),
            );
        });
    });

    describe('HtmlFilteringBodyParser.parse - invalid cases', () => {
        test.each<{ actual: string; expected: NodeExpectFn<AdblockSyntaxError> }>([
            // empty input
            {
                actual: '',
                expected: (context) => (new AdblockSyntaxError(
                    "Expected a token, but got 'end of input'",
                    context.getFullRange().end - 1,
                    context.getFullRange().end,
                )),
            },

            // empty input with whitespace
            {
                actual: '   ',
                expected: (context) => (new AdblockSyntaxError(
                    "Expected a token, but got 'end of input'",
                    context.getFullRange().end - 1,
                    context.getFullRange().end,
                )),
            },

            // universal selector
            {
                actual: '*',
                expected: (context) => (new AdblockSyntaxError(
                    "Unexpected token '<delim-token>' with value '*'",
                    ...context.toTuple(context.getRangeFor('*')),
                )),
            },

            // two tag names
            {
                actual: 'div[attr="value"]span',
                expected: (context) => (new AdblockSyntaxError(
                    'Tag name is already set for the selector',
                    ...context.toTuple(context.getRangeFor('span')),
                )),
            },

            // tag name after attribute
            {
                actual: '[attr="value"]div',
                expected: (context) => (new AdblockSyntaxError(
                    'Tag name must be the first part of the selector',
                    ...context.toTuple(context.getRangeFor('div')),
                )),
            },

            // invalid attribute name - name as string
            {
                actual: '["attr"="value"]',
                expected: (context) => (new AdblockSyntaxError(
                    "Expected '<ident-token>', but got '<string-token>'",
                    ...context.toTuple(context.getRangeFor('"attr"')),
                )),
            },

            // invalid attribute name - starts with digit
            {
                actual: '[1attr="value"]',
                expected: (context) => (new AdblockSyntaxError(
                    "Expected '<ident-token>', but got '<dimension-token>'",
                    ...context.toTuple(context.getRangeFor('1attr')),
                )),
            },

            // invalid attribute name - contains invalid character
            {
                actual: '[at@tr="value"]',
                expected: (context) => (new AdblockSyntaxError(
                    "Expected '<delim-token>', but got '<at-keyword-token>'",
                    ...context.toTuple(context.getRangeFor('@tr')),
                )),
            },

            // invalid attribute name - empty
            {
                actual: '[]',
                expected: (context) => (new AdblockSyntaxError(
                    "Expected '<ident-token>', but got '<]-token>'",
                    ...context.toTuple(context.getRangeFor(']')),
                )),
            },

            // invalid attribute value - missing closing quote
            {
                actual: '[attr="value]',
                expected: (context) => (new AdblockSyntaxError(
                    "Expected '<]-token>', but got 'end of input'",
                    context.getFullRange().end - 1,
                    context.getFullRange().end,
                )),
            },

            // invalid attribute - missing closing bracket
            {
                actual: '[attr="value"',
                expected: (context) => (new AdblockSyntaxError(
                    "Expected '<]-token>', but got 'end of input'",
                    context.getFullRange().end - 1,
                    context.getFullRange().end,
                )),
            },

            // invalid attribute - missing operator
            {
                actual: '[attr "value"]',
                expected: (context) => (new AdblockSyntaxError(
                    "Expected '<delim-token>', but got '<string-token>'",
                    ...context.toTuple(context.getRangeFor('"value"')),
                )),
            },

            // invalid attribute - invalid operator
            {
                actual: '[attr!="value"]',
                expected: (context) => (new AdblockSyntaxError(
                    "Invalid attribute operator '!'",
                    ...context.toTuple(context.getRangeFor('!')),
                )),
            },

            // invalid attribute - invalid operator (not equal sign)
            {
                actual: '[attr~!"value"]',
                expected: (context) => (new AdblockSyntaxError(
                    "Expected '<delim-token>' with value '=', but got '!'",
                    ...context.toTuple(context.getRangeFor('!')),
                )),
            },

            // invalid attribute - missing value
            {
                actual: '[attr=]',
                expected: (context) => (new AdblockSyntaxError(
                    // eslint-disable-next-line max-len
                    "Expected '<ident-token>' or '<string-token>' as attribute value, but got '<]-token>' with value ']'",
                    ...context.toTuple(context.getRangeFor(']')),
                )),
            },

            // invalid attribute - invalid flag
            {
                actual: '[attr="value" "i"]',
                expected: (context) => (new AdblockSyntaxError(
                    "Expected '<ident-token>', but got '<string-token>'",
                    ...context.toTuple(context.getRangeFor('"i"')),
                )),
            },

            // invalid pseudo-class name - empty
            {
                actual: ':',
                expected: (context) => (new AdblockSyntaxError(
                    "Expected a token, but got 'end of input'",
                    context.getFullRange().end - 1,
                    context.getFullRange().end,
                )),
            },

            // invalid pseudo-class name - as string
            {
                actual: ':"pseudo"',
                expected: (context) => (new AdblockSyntaxError(
                    // eslint-disable-next-line max-len
                    "Expected '<ident-token>' or '<function-token>' as pseudo-class name, but got '<string-token>' with value '\"pseudo\"'",
                    ...context.toTuple(context.getRangeFor('"pseudo"')),
                )),
            },

            // invalid pseudo-class function - missing closing parenthesis (without argument)
            {
                actual: ':pseudo(',
                expected: (context) => (new AdblockSyntaxError(
                    "Expected '<)-token>', but got 'end of input'",
                    context.getFullRange().end - 1,
                    context.getFullRange().end,
                )),
            },

            // invalid pseudo-class function - missing closing parenthesis (with argument)
            {
                actual: ':pseudo(arg',
                expected: (context) => (new AdblockSyntaxError(
                    "Expected '<)-token>', but got 'end of input'",
                    context.getFullRange().end - 1,
                    context.getFullRange().end,
                )),
            },

            // invalid class name
            {
                actual: '."class"',
                expected: (context) => (new AdblockSyntaxError(
                    "Expected '<ident-token>', but got '<string-token>'",
                    ...context.toTuple(context.getRangeFor('"class"')),
                )),
            },

            // invalid combinator - empty before
            {
                actual: '>div',
                expected: (context) => (new AdblockSyntaxError(
                    "Unexpected token '<delim-token>' with value '>'",
                    ...context.toTuple(context.getRangeFor('>')),
                )),
            },

            // invalid combinator - empty after
            {
                actual: 'div+',
                expected: (context) => (new AdblockSyntaxError(
                    "Expected a token, but got 'end of input'",
                    context.getFullRange().end - 1,
                    context.getFullRange().end,
                )),
            },

            // invalid combinator - two in a row
            {
                actual: 'div > + span',
                expected: (context) => (new AdblockSyntaxError(
                    "Unexpected token '<delim-token>' with value '+'",
                    ...context.toTuple(context.getRangeFor('+')),
                )),
            },

            // invalid combinator - unknown symbol
            {
                actual: 'div $ span',
                expected: (context) => (new AdblockSyntaxError(
                    "Unexpected token '<delim-token>' with value '$'",
                    ...context.toTuple(context.getRangeFor('$')),
                )),
            },

            // invalid comma separator - empty before
            {
                actual: ',div',
                expected: (context) => (new AdblockSyntaxError(
                    "Unexpected token '<comma-token>' with value ','",
                    ...context.toTuple(context.getRangeFor(',')),
                )),
            },

            // invalid comma separator - empty after
            {
                actual: 'div,',
                expected: (context) => (new AdblockSyntaxError(
                    "Expected a token, but got 'end of input'",
                    context.getFullRange().end - 1,
                    context.getFullRange().end,
                )),
            },

            // invalid comma separator - two in a row
            {
                actual: 'div, ,span',
                expected: (context) => (new AdblockSyntaxError(
                    "Unexpected token '<comma-token>' with value ','",
                    ...context.toTuple(context.getRangeFor(',', 2)),
                )),
            },

            // invalid selector - media query-like input
            {
                actual: '@media screen and (max-width: 600px)',
                expected: (context) => (new AdblockSyntaxError(
                    "Unexpected token '<at-keyword-token>' with value '@media'",
                    ...context.toTuple(context.getRangeFor('@media')),
                )),
            },

            // invalid attribute - unescaped double quote in attribute value (error thrown in tokenizer)
            {
                actual: '[attr="value with " quotes"]',
                expected: (context) => (new AdblockSyntaxError(
                    "Expected '<]-token>', but got 'end of input'",
                    context.getFullRange().end - 1,
                    context.getFullRange().end,
                )),
            },

            // invalid attribute - unescaped single quote in attribute value (error thrown in tokenizer)
            {
                actual: "[attr='value with ' quotes']",
                expected: (context) => (new AdblockSyntaxError(
                    "Expected '<]-token>', but got 'end of input'",
                    context.getFullRange().end - 1,
                    context.getFullRange().end,
                )),
            },
        ])("should throw on input: '$actual'", ({ actual, expected: expectedFn }) => {
            const fn = vi.fn(() => HtmlFilteringBodyParser.parse(actual));

            // parse should throw
            expect(fn).toThrow();

            const expected = expectedFn(new NodeExpectContext(actual));

            // check the thrown error
            const error = fn.mock.results[0].value;
            expect(error).toBeInstanceOf(AdblockSyntaxError);
            expect(error).toHaveProperty('message', expected.message);
            expect(error).toHaveProperty('start', expected.start);
            expect(error).toHaveProperty('end', expected.end);
        });
    });

    describe('HtmlFilteringBodyGenerator.generate', () => {
        test.each<{ actual: string; expected: string }>([
            {
                actual: 'div',
                expected: 'div',
            },
            {
                actual: 'my-tag',
                expected: 'my-tag',
            },
            {
                actual: 'my_tag',
                expected: 'my_tag',
            },
            {
                actual: '#id',
                expected: '#id',
            },
            {
                actual: '#my-id',
                expected: '#my-id',
            },
            {
                actual: '#my_id',
                expected: '#my_id',
            },
            {
                actual: '#-myid',
                expected: '#-myid',
            },
            {
                actual: '.class',
                expected: '.class',
            },
            {
                actual: '.my-class',
                expected: '.my-class',
            },
            {
                actual: '.my_class',
                expected: '.my_class',
            },
            {
                actual: '.-myclass',
                expected: '.-myclass',
            },
            {
                actual: '[attr="value"]',
                expected: '[attr="value"]',
            },
            {
                actual: '[attr]',
                expected: '[attr]',
            },
            {
                actual: '[attr=value]',
                expected: '[attr="value"]',
            },
            {
                actual: "[attr='value']",
                expected: '[attr="value"]',
            },
            {
                actual: '[attr="value" i]',
                expected: '[attr="value" i]',
            },
            {
                actual: '[attr="value"i]',
                expected: '[attr="value" i]',
            },
            {
                actual: '[attr=value i]',
                expected: '[attr="value" i]',
            },
            {
                actual: "[attr='value' i]",
                expected: '[attr="value" i]',
            },
            {
                actual: '[attr~="value"]',
                expected: '[attr~="value"]',
            },
            {
                actual: '[attr^="value"]',
                expected: '[attr^="value"]',
            },
            {
                actual: '[attr$="value"]',
                expected: '[attr$="value"]',
            },
            {
                actual: '[attr*="value"]',
                expected: '[attr*="value"]',
            },
            {
                actual: '[attr|="value"]',
                expected: '[attr|="value"]',
            },
            {
                actual: '[data-test-value="x"]',
                expected: '[data-test-value="x"]',
            },
            {
                actual: '[data_test_value="x"]',
                expected: '[data_test_value="x"]',
            },
            {
                actual: '[-data="x"]',
                expected: '[-data="x"]',
            },
            {
                actual: '[attr=""]',
                expected: '[attr=""]',
            },
            {
                actual: '[attr1="value1"][attr2^="value2"][attr3]',
                expected: '[attr1="value1"][attr2^="value2"][attr3]',
            },
            {
                actual: ':pseudo(arg)',
                expected: ':pseudo(arg)',
            },
            {
                actual: ':pseudo()',
                expected: ':pseudo()',
            },
            {
                actual: ':pseudo',
                expected: ':pseudo',
            },
            {
                actual: ':pseudo-class-name(arg)',
                expected: ':pseudo-class-name(arg)',
            },
            {
                actual: ':pseudo_class_name(arg)',
                expected: ':pseudo_class_name(arg)',
            },
            {
                actual: ':-pseudo(arg)',
                expected: ':-pseudo(arg)',
            },
            {
                actual: ':pseudo1(arg):pseudo2():pseudo3',
                expected: ':pseudo1(arg):pseudo2():pseudo3',
            },
            {
                actual: ':not(div, span.class)',
                expected: ':not(div, span.class)',
            },
            {
                actual: 'div#id.class[attr~="value" i]:pseudo(arg)',
                expected: 'div#id.class[attr~="value" i]:pseudo(arg)',
            },
            {
                actual: 'div span',
                expected: 'div span',
            },
            {
                actual: 'div > span',
                expected: 'div > span',
            },
            {
                actual: 'div + span',
                expected: 'div + span',
            },
            {
                actual: 'div ~ span',
                expected: 'div ~ span',
            },
            {
                actual: 'div > span + a ~ h1',
                expected: 'div > span + a ~ h1',
            },
            {
                actual: 'div, span[attr="value"]',
                expected: 'div, span[attr="value"]',
            },
            {
                actual: 'div > span, .class + #id',
                expected: 'div > span, .class + #id',
            },
            {
                actual: '   div   ',
                expected: 'div',
            },
            {
                actual: 'div   >    span',
                expected: 'div > span',
            },
            {
                actual: '[  attr   =   "value"  ]',
                expected: '[attr="value"]',
            },
            {
                actual: '[  attr   =   value  ]',
                expected: '[attr="value"]',
            },
            {
                actual: ':pseudo(  arg with spaces  )',
                expected: ':pseudo(arg with spaces)',
            },
            {
                actual: '[attr="value with \\"escaped\\" quotes"]',
                expected: '[attr="value with \\"escaped\\" quotes"]',
            },
            {
                actual: "[attr='value with \\'escaped\\' quotes']",
                expected: '[attr="value with \'escaped\' quotes"]',
            },
            {
                actual: '[attr="value with \'escaped\' quotes"]',
                expected: '[attr="value with \'escaped\' quotes"]',
            },
            {
                actual: "[attr='value with \"escaped\" quotes']",
                expected: '[attr="value with \\"escaped\\" quotes"]',
            },
        ])("should generate '$expected' from '$actual'", ({ actual, expected }) => {
            const ruleNode = HtmlFilteringBodyParser.parse(actual);

            if (ruleNode === null) {
                throw new Error(`Failed to parse '${actual}' as cosmetic rule`);
            }

            expect(HtmlFilteringBodyGenerator.generate(ruleNode)).toBe(expected);
        });
    });

    describe('serialize & deserialize', () => {
        test.each([
            'div',
            'my-tag',
            'my_tag',
            '#id',
            '#my-id',
            '#my_id',
            '#-myid',
            '.class',
            '.my-class',
            '.my_class',
            '.-myclass',
            '[attr="value"]',
            '[attr]',
            '[attr=value]',
            "[attr='value']",
            '[attr="value" i]',
            '[attr="value"i]',
            '[attr=value i]',
            "[attr='value' i]",
            '[attr~="value"]',
            '[attr^="value"]',
            '[attr$="value"]',
            '[attr*="value"]',
            '[attr|="value"]',
            '[data-test-value="x"]',
            '[data_test_value="x"]',
            '[-data="x"]',
            '[attr=""]',
            '[attr1="value1"][attr2^="value2"][attr3]',
            ':pseudo(arg)',
            ':pseudo()',
            ':pseudo',
            ':pseudo-class-name(arg)',
            ':pseudo_class_name(arg)',
            ':-pseudo(arg)',
            ':pseudo1(arg):pseudo2():pseudo3',
            ':not(div, span.class)',
            'div#id.class[attr~="value" i]:pseudo(arg)',
            'div span',
            'div > span',
            'div + span',
            'div ~ span',
            'div > span + a ~ h1',
            'div, span[attr="value"]',
            'div > span, .class + #id',
            '   div   ',
            'div   >    span',
            '[  attr   =   "value"  ]',
            '[  attr   =   value  ]',
            ':pseudo(  arg with spaces  )',
            '[attr="value with \\"escaped\\" quotes"]',
            "[attr='value with \\'escaped\\' quotes']",
            '[attr="value with \'escaped\' quotes"]',
            "[attr='value with \"escaped\" quotes']",
        ])("should serialize and deserialize '%p'", async (input) => {
            await expect(input).toBeSerializedAndDeserializedProperly(
                HtmlFilteringBodyParser,
                HtmlFilteringBodyGenerator,
                HtmlFilteringBodySerializer,
                HtmlFilteringBodyDeserializer,
            );
        });
    });
});
