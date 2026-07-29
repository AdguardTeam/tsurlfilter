import {
    describe,
    expect,
    test,
    vi,
} from 'vitest';

import { AdblockSyntaxError } from '../../../src/errors/adblock-syntax-error';
import { type SelectorList } from '../../../src/nodes';
import { NodeExpectContext, type NodeExpectFn } from '../../helpers/node-utils';
import { parseSelectorList } from '../../helpers/parse-helpers';

describe('SelectorListAstBuilder (parser-new)', () => {
    describe('parseSelectorList - valid cases', () => {
        test.each<{ actual: string; expected: NodeExpectFn<SelectorList> }>([
            // universal type selector only
            {
                actual: '*',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'TypeSelector',
                            value: '*',
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // tag name only
            {
                actual: 'div',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'TypeSelector',
                            value: 'div',
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // tag name only - with hyphen
            {
                actual: 'my-tag',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'TypeSelector',
                            value: 'my-tag',
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // tag name only - with underscore
            {
                actual: 'my_tag',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'TypeSelector',
                            value: 'my_tag',
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // id only
            {
                actual: '#id',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'IdSelector',
                            value: 'id',
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // id only - with hyphen
            {
                actual: '#my-id',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'IdSelector',
                            value: 'my-id',
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // id only - with underscore
            {
                actual: '#my_id',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'IdSelector',
                            value: 'my_id',
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // id only - start with hyphen
            {
                actual: '#-myid',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'IdSelector',
                            value: '-myid',
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // class name only
            {
                actual: '.class',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'ClassSelector',
                            value: 'class',
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // class name only - with hyphen
            {
                actual: '.my-class',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'ClassSelector',
                            value: 'my-class',
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // class name only - with underscore
            {
                actual: '.my_class',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'ClassSelector',
                            value: 'my_class',
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // class name only - start with hyphen
            {
                actual: '.-myclass',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'ClassSelector',
                            value: '-myclass',
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only
            {
                actual: '[attr="value"]',
                expected: (context) => ({
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
                                value: 'value',
                                ...context.getRangeFor('value'),
                            },
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - no value
            {
                actual: '[attr]',
                expected: (context) => ({
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
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - unquoted value
            {
                actual: '[attr=value]',
                expected: (context) => ({
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
                                value: 'value',
                                ...context.getRangeFor('value'),
                            },
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - single quoted value
            {
                actual: "[attr='value']",
                expected: (context) => ({
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
                                value: 'value',
                                ...context.getRangeFor('value'),
                            },
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - with flag
            {
                actual: '[attr="value" i]',
                expected: (context) => ({
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
                                value: 'value',
                                ...context.getRangeFor('value'),
                            },
                            flag: {
                                type: 'Value',
                                value: 'i',
                                ...context.getRangeFor('i'),
                            },
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - with flag and without space
            {
                actual: '[attr="value"i]',
                expected: (context) => ({
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
                                value: 'value',
                                ...context.getRangeFor('value'),
                            },
                            flag: {
                                type: 'Value',
                                value: 'i',
                                ...context.getRangeFor('i'),
                            },
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - with flag and unquoted value
            {
                actual: '[attr=value i]',
                expected: (context) => ({
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
                                value: 'value',
                                ...context.getRangeFor('value'),
                            },
                            flag: {
                                type: 'Value',
                                value: 'i',
                                ...context.getRangeFor('i'),
                            },
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - with flag and single quoted value
            {
                actual: "[attr='value' i]",
                expected: (context) => ({
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
                                value: 'value',
                                ...context.getRangeFor('value'),
                            },
                            flag: {
                                type: 'Value',
                                value: 'i',
                                ...context.getRangeFor('i'),
                            },
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - ~= operator
            {
                actual: '[attr~="value"]',
                expected: (context) => ({
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
                                value: '~=',
                                ...context.getRangeFor('~='),
                            },
                            value: {
                                type: 'Value',
                                value: 'value',
                                ...context.getRangeFor('value'),
                            },
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - ^= operator
            {
                actual: '[attr^="value"]',
                expected: (context) => ({
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
                                value: '^=',
                                ...context.getRangeFor('^='),
                            },
                            value: {
                                type: 'Value',
                                value: 'value',
                                ...context.getRangeFor('value'),
                            },
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - $= operator
            {
                actual: '[attr$="value"]',
                expected: (context) => ({
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
                                value: '$=',
                                ...context.getRangeFor('$='),
                            },
                            value: {
                                type: 'Value',
                                value: 'value',
                                ...context.getRangeFor('value'),
                            },
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - *= operator
            {
                actual: '[attr*="value"]',
                expected: (context) => ({
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
                                value: '*=',
                                ...context.getRangeFor('*='),
                            },
                            value: {
                                type: 'Value',
                                value: 'value',
                                ...context.getRangeFor('value'),
                            },
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - |= operator
            {
                actual: '[attr|="value"]',
                expected: (context) => ({
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
                                value: '|=',
                                ...context.getRangeFor('|='),
                            },
                            value: {
                                type: 'Value',
                                value: 'value',
                                ...context.getRangeFor('value'),
                            },
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - name with hyphens
            {
                actual: '[data-test-value="x"]',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'AttributeSelector',
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
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - name with underscore
            {
                actual: '[data_test_value="x"]',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'AttributeSelector',
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
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - name starting with hyphen
            {
                actual: '[-data="x"]',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'AttributeSelector',
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
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - empty value
            {
                actual: '[attr=""]',
                expected: (context) => ({
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
                                value: '',
                                start: 7,
                                end: 7,
                            },
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute only - multiple attributes
            {
                actual: '[attr1="value1"][attr2^="value2"][attr3]',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'AttributeSelector',
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
                        }, {
                            type: 'AttributeSelector',
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
                        }, {
                            type: 'AttributeSelector',
                            name: {
                                type: 'Value',
                                value: 'attr3',
                                ...context.getRangeFor('attr3'),
                            },
                            ...context.getRangeFor('[attr3]'),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // pseudo-class only
            {
                actual: ':pseudo(arg)',
                expected: (context) => ({
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
                                value: 'arg',
                                ...context.getRangeFor('arg'),
                            },
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // pseudo-class only - without argument
            {
                actual: ':pseudo()',
                expected: (context) => ({
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
                                value: '',
                                start: 8,
                                end: 8,
                            },
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // pseudo-class only - non function
            {
                actual: ':pseudo',
                expected: (context) => ({
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
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // pseudo-class only - name with hyphens
            {
                actual: ':pseudo-class-name(arg)',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'PseudoClassSelector',
                            name: {
                                type: 'Value',
                                value: 'pseudo-class-name',
                                ...context.getRangeFor('pseudo-class-name'),
                            },
                            argument: {
                                type: 'Value',
                                value: 'arg',
                                ...context.getRangeFor('arg'),
                            },
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // pseudo-class only - name with underscore
            {
                actual: ':pseudo_class_name(arg)',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'PseudoClassSelector',
                            name: {
                                type: 'Value',
                                value: 'pseudo_class_name',
                                ...context.getRangeFor('pseudo_class_name'),
                            },
                            argument: {
                                type: 'Value',
                                value: 'arg',
                                ...context.getRangeFor('arg'),
                            },
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // pseudo-class only - name starting with hyphen
            {
                actual: ':-pseudo(arg)',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'PseudoClassSelector',
                            name: {
                                type: 'Value',
                                value: '-pseudo',
                                ...context.getRangeFor('-pseudo'),
                            },
                            argument: {
                                type: 'Value',
                                value: 'arg',
                                ...context.getRangeFor('arg'),
                            },
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // pseudo-class only - multiple pseudo-classes
            {
                actual: ':pseudo1(arg):pseudo2():pseudo3',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'PseudoClassSelector',
                            name: {
                                type: 'Value',
                                value: 'pseudo1',
                                ...context.getRangeFor('pseudo1'),
                            },
                            argument: {
                                type: 'Value',
                                value: 'arg',
                                ...context.getRangeFor('arg'),
                            },
                            ...context.getRangeFor(':pseudo1(arg)'),
                        }, {
                            type: 'PseudoClassSelector',
                            name: {
                                type: 'Value',
                                value: 'pseudo2',
                                ...context.getRangeFor('pseudo2'),
                            },
                            argument: {
                                type: 'Value',
                                value: '',
                                start: 22,
                                end: 22,
                            },
                            ...context.getRangeFor(':pseudo2()'),
                        }, {
                            type: 'PseudoClassSelector',
                            name: {
                                type: 'Value',
                                value: 'pseudo3',
                                ...context.getRangeFor('pseudo3'),
                            },
                            ...context.getRangeFor(':pseudo3'),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // pseudo-class only - native pseudo-classes with nested selector
            {
                actual: ':not(div, span.class)',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'PseudoClassSelector',
                            name: {
                                type: 'Value',
                                value: 'not',
                                ...context.getRangeFor('not'),
                            },
                            argument: {
                                type: 'Value',
                                value: 'div, span.class',
                                ...context.getRangeFor('div, span.class'),
                            },
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // pseudo-class with nested attribute selector - :not([class])
            {
                actual: 'div:not([class])',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'TypeSelector',
                            value: 'div',
                            ...context.getRangeFor('div'),
                        }, {
                            type: 'PseudoClassSelector',
                            name: {
                                type: 'Value',
                                value: 'not',
                                ...context.getRangeFor('not'),
                            },
                            argument: {
                                type: 'Value',
                                value: '[class]',
                                ...context.getRangeFor('[class]'),
                            },
                            ...context.getRangeFor(':not([class])'),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // pseudo-class with nested attribute selector - multiple :not() with attributes
            {
                actual: 'a:not([href]):not([id])',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'TypeSelector',
                            value: 'a',
                            ...context.getRangeFor('a'),
                        }, {
                            type: 'PseudoClassSelector',
                            name: {
                                type: 'Value',
                                value: 'not',
                                ...context.getRangeFor('not'),
                            },
                            argument: {
                                type: 'Value',
                                value: '[href]',
                                ...context.getRangeFor('[href]'),
                            },
                            ...context.getRangeFor(':not([href])'),
                        }, {
                            type: 'PseudoClassSelector',
                            name: {
                                type: 'Value',
                                value: 'not',
                                ...context.getRangeFor('not', 2),
                            },
                            argument: {
                                type: 'Value',
                                value: '[id]',
                                ...context.getRangeFor('[id]'),
                            },
                            ...context.getRangeFor(':not([id])'),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // pseudo-class with nested attribute selector - :has([data-value="test"])
            {
                actual: 'span:has([data-value="test"])',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'TypeSelector',
                            value: 'span',
                            ...context.getRangeFor('span'),
                        }, {
                            type: 'PseudoClassSelector',
                            name: {
                                type: 'Value',
                                value: 'has',
                                ...context.getRangeFor('has'),
                            },
                            argument: {
                                type: 'Value',
                                value: '[data-value="test"]',
                                ...context.getRangeFor('[data-value="test"]'),
                            },
                            ...context.getRangeFor(':has([data-value="test"])'),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // pseudo-class with nested attribute selector - :is([type="text"])
            {
                actual: 'p:is([type="text"])',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'TypeSelector',
                            value: 'p',
                            ...context.getRangeFor('p'),
                        }, {
                            type: 'PseudoClassSelector',
                            name: {
                                type: 'Value',
                                value: 'is',
                                ...context.getRangeFor('is'),
                            },
                            argument: {
                                type: 'Value',
                                value: '[type="text"]',
                                ...context.getRangeFor('[type="text"]'),
                            },
                            ...context.getRangeFor(':is([type="text"])'),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // pseudo-class with nested attribute selector - exact reported selector body
            {
                actual: 'iframe[name]:not([class]):not([id]):not([src])[style="display:none"]',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'TypeSelector',
                            value: 'iframe',
                            ...context.getRangeFor('iframe'),
                        }, {
                            type: 'AttributeSelector',
                            name: {
                                type: 'Value',
                                value: 'name',
                                ...context.getRangeFor('name'),
                            },
                            ...context.getRangeFor('[name]'),
                        }, {
                            type: 'PseudoClassSelector',
                            name: {
                                type: 'Value',
                                value: 'not',
                                ...context.getRangeFor('not'),
                            },
                            argument: {
                                type: 'Value',
                                value: '[class]',
                                ...context.getRangeFor('[class]'),
                            },
                            ...context.getRangeFor(':not([class])'),
                        }, {
                            type: 'PseudoClassSelector',
                            name: {
                                type: 'Value',
                                value: 'not',
                                ...context.getRangeFor('not', 2),
                            },
                            argument: {
                                type: 'Value',
                                value: '[id]',
                                ...context.getRangeFor('[id]'),
                            },
                            ...context.getRangeFor(':not([id])'),
                        }, {
                            type: 'PseudoClassSelector',
                            name: {
                                type: 'Value',
                                value: 'not',
                                ...context.getRangeFor('not', 3),
                            },
                            argument: {
                                type: 'Value',
                                value: '[src]',
                                ...context.getRangeFor('[src]'),
                            },
                            ...context.getRangeFor(':not([src])'),
                        }, {
                            type: 'AttributeSelector',
                            name: {
                                type: 'Value',
                                value: 'style',
                                ...context.getRangeFor('style'),
                            },
                            operator: {
                                type: 'Value',
                                value: '=',
                                ...context.getRangeFor('='),
                            },
                            value: {
                                type: 'Value',
                                value: 'display:none',
                                ...context.getRangeFor('display:none'),
                            },
                            ...context.getRangeFor('[style="display:none"]'),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // pseudo-class with nested attribute selector - nested brackets in attribute value
            {
                actual: 'div:not([attr="value with [brackets]"])',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'TypeSelector',
                            value: 'div',
                            ...context.getRangeFor('div'),
                        }, {
                            type: 'PseudoClassSelector',
                            name: {
                                type: 'Value',
                                value: 'not',
                                ...context.getRangeFor('not'),
                            },
                            argument: {
                                type: 'Value',
                                value: '[attr="value with [brackets]"]',
                                ...context.getRangeFor('[attr="value with [brackets]"]'),
                            },
                            ...context.getRangeFor(':not([attr="value with [brackets]"])'),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // combined selector
            {
                actual: 'div#id.class[attr~="value" i]:pseudo(arg)',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'TypeSelector',
                            value: 'div',
                            ...context.getRangeFor('div'),
                        }, {
                            type: 'IdSelector',
                            value: 'id',
                            ...context.getRangeFor('#id'),
                        }, {
                            type: 'ClassSelector',
                            value: 'class',
                            ...context.getRangeFor('.class'),
                        }, {
                            type: 'AttributeSelector',
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
                        }, {
                            type: 'PseudoClassSelector',
                            name: {
                                type: 'Value',
                                value: 'pseudo',
                                ...context.getRangeFor('pseudo'),
                            },
                            argument: {
                                type: 'Value',
                                value: 'arg',
                                ...context.getRangeFor('arg'),
                            },
                            ...context.getRangeFor(':pseudo(arg)'),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // combinator - descendant
            {
                actual: 'div span',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'TypeSelector',
                            value: 'div',
                            ...context.getRangeFor('div'),
                        }, {
                            type: 'SelectorCombinator',
                            value: ' ',
                            ...context.getRangeFor(' '),
                        }, {
                            type: 'TypeSelector',
                            value: 'span',
                            ...context.getRangeFor('span'),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // combinator - child
            {
                actual: 'div > span',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'TypeSelector',
                            value: 'div',
                            ...context.getRangeFor('div'),
                        }, {
                            type: 'SelectorCombinator',
                            value: '>',
                            ...context.getRangeFor('>'),
                        }, {
                            type: 'TypeSelector',
                            value: 'span',
                            ...context.getRangeFor('span'),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // combinator - next sibling
            {
                actual: 'div + span',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'TypeSelector',
                            value: 'div',
                            ...context.getRangeFor('div'),
                        }, {
                            type: 'SelectorCombinator',
                            value: '+',
                            ...context.getRangeFor('+'),
                        }, {
                            type: 'TypeSelector',
                            value: 'span',
                            ...context.getRangeFor('span'),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // combinator - sibling
            {
                actual: 'div ~ span',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'TypeSelector',
                            value: 'div',
                            ...context.getRangeFor('div'),
                        }, {
                            type: 'SelectorCombinator',
                            value: '~',
                            ...context.getRangeFor('~'),
                        }, {
                            type: 'TypeSelector',
                            value: 'span',
                            ...context.getRangeFor('span'),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // combinator - mixed
            {
                actual: 'div > span + a ~ h1',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'TypeSelector',
                            value: 'div',
                            ...context.getRangeFor('div'),
                        }, {
                            type: 'SelectorCombinator',
                            value: '>',
                            ...context.getRangeFor('>'),
                        }, {
                            type: 'TypeSelector',
                            value: 'span',
                            ...context.getRangeFor('span'),
                        }, {
                            type: 'SelectorCombinator',
                            value: '+',
                            ...context.getRangeFor('+'),
                        }, {
                            type: 'TypeSelector',
                            value: 'a',
                            ...context.getRangeFor('a', 2),
                        }, {
                            type: 'SelectorCombinator',
                            value: '~',
                            ...context.getRangeFor('~'),
                        }, {
                            type: 'TypeSelector',
                            value: 'h1',
                            ...context.getRangeFor('h1'),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // multiple complex selectors
            {
                actual: 'div, span[attr="value"]',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'TypeSelector',
                            value: 'div',
                            ...context.getRangeFor('div'),
                        }],
                        ...context.getRangeFor('div'),
                    }, {
                        type: 'ComplexSelector',
                        children: [{
                            type: 'TypeSelector',
                            value: 'span',
                            ...context.getRangeFor('span'),
                        }, {
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
                                value: 'value',
                                ...context.getRangeFor('value'),
                            },
                            ...context.getRangeFor('[attr="value"]'),
                        }],
                        ...context.getRangeFor('span[attr="value"]'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // multiple selector lists with combinators
            {
                actual: 'div > span, .class + #id',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'TypeSelector',
                            value: 'div',
                            ...context.getRangeFor('div'),
                        }, {
                            type: 'SelectorCombinator',
                            value: '>',
                            ...context.getRangeFor('>'),
                        }, {
                            type: 'TypeSelector',
                            value: 'span',
                            ...context.getRangeFor('span'),
                        }],
                        ...context.getRangeFor('div > span'),
                    }, {
                        type: 'ComplexSelector',
                        children: [{
                            type: 'ClassSelector',
                            value: 'class',
                            ...context.getRangeFor('.class'),
                        }, {
                            type: 'SelectorCombinator',
                            value: '+',
                            ...context.getRangeFor('+'),
                        }, {
                            type: 'IdSelector',
                            value: 'id',
                            ...context.getRangeFor('#id'),
                        }],
                        ...context.getRangeFor('.class + #id'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // edge case - leading and trailing whitespace
            {
                actual: '   div   ',
                expected: (context) => ({
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'TypeSelector',
                            value: 'div',
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
                    type: 'SelectorList',
                    children: [{
                        type: 'ComplexSelector',
                        children: [{
                            type: 'TypeSelector',
                            value: 'div',
                            ...context.getRangeFor('div'),
                        }, {
                            type: 'SelectorCombinator',
                            value: '>',
                            ...context.getRangeFor('>'),
                        }, {
                            type: 'TypeSelector',
                            value: 'span',
                            ...context.getRangeFor('span'),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // edge case - spaces around attribute operator
            {
                actual: '[  attr   =   "value"  ]',
                expected: (context) => ({
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
                                value: 'value',
                                ...context.getRangeFor('value'),
                            },
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // edge case - spaces around attribute operator and unquoted value
            {
                actual: '[  attr   =   value  ]',
                expected: (context) => ({
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
                                value: 'value',
                                ...context.getRangeFor('value'),
                            },
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // edge case - spaces in pseudo-class function argument
            {
                actual: ':pseudo(  arg with spaces  )',
                expected: (context) => ({
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
                                value: 'arg with spaces',
                                ...context.getRangeFor('arg with spaces'),
                            },
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // edge case - quote escape - double quotes
            // NOTE: the new parser-based parser preserves raw backslash-escape sequences in value
            {
                actual: '[attr="value with \\"escaped\\" quotes"]',
                expected: (context) => ({
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
                                value: 'value with \\"escaped\\" quotes',
                                ...context.getRangeFor('value with \\"escaped\\" quotes'),
                            },
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // edge case - quote escape - single quotes
            // NOTE: the new parser-based parser preserves raw backslash-escape sequences in value
            {
                actual: "[attr='value with \\'escaped\\' quotes']",
                expected: (context) => ({
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
                                value: "value with \\'escaped\\' quotes",
                                ...context.getRangeFor("value with \\'escaped\\' quotes"),
                            },
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // edge case - quote escape - single quotes in double quotes (no escape needed)
            {
                actual: '[attr="value with \'escaped\' quotes"]',
                expected: (context) => ({
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
                                value: "value with 'escaped' quotes",
                                ...context.getRangeFor("value with 'escaped' quotes"),
                            },
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // edge case - quote escape - double quotes in single quotes (no escape needed)
            {
                actual: "[attr='value with \"escaped\" quotes']",
                expected: (context) => ({
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
                                value: 'value with "escaped" quotes',
                                ...context.getRangeFor('value with "escaped" quotes'),
                            },
                            ...context.getFullRange(),
                        }],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },
        ])("should parse '$actual'", ({ actual, expected: expectedFn }) => {
            expect(parseSelectorList(actual)).toEqual(
                expectedFn(new NodeExpectContext(actual)),
            );
        });
    });

    describe('parseSelectorList - invalid cases', () => {
        test.each<{ actual: string; expected: NodeExpectFn<AdblockSyntaxError> }>([
            // empty input
            {
                actual: '',
                expected: () => (new AdblockSyntaxError(
                    'Empty selector',
                    0,
                    1,
                )),
            },

            // empty input with whitespace
            {
                actual: '   ',
                expected: () => (new AdblockSyntaxError(
                    'Empty selector',
                    0,
                    1,
                )),
            },

            // two tag names
            {
                actual: 'div[attr="value"]span',
                expected: (context) => (new AdblockSyntaxError(
                    'Type selector is already set for the compound selector',
                    ...context.toTuple(context.getRangeFor('span')),
                )),
            },

            // tag name after attribute
            {
                actual: '[attr="value"]div',
                expected: (context) => (new AdblockSyntaxError(
                    'Type selector must be first in the compound selector',
                    ...context.toTuple(context.getRangeFor('div')),
                )),
            },

            // invalid attribute name - name as string (quoted)
            {
                actual: '["attr"="value"]',
                expected: (context) => (new AdblockSyntaxError(
                    'Expected attribute name identifier',
                    ...context.toTuple(context.getRangeFor('"')),
                )),
            },

            // invalid attribute name - starts with digit
            {
                actual: '[1attr="value"]',
                expected: (context) => (new AdblockSyntaxError(
                    'Expected attribute name identifier',
                    ...context.toTuple(context.getRangeFor('1')),
                )),
            },

            // invalid attribute name - contains invalid character
            {
                actual: '[at@tr="value"]',
                expected: (context) => (new AdblockSyntaxError(
                    'Invalid attribute selector operator',
                    ...context.toTuple(context.getRangeFor('@')),
                )),
            },

            // invalid attribute name - empty
            {
                actual: '[]',
                expected: (context) => (new AdblockSyntaxError(
                    'Expected attribute name identifier',
                    ...context.toTuple(context.getRangeFor(']')),
                )),
            },

            // invalid attribute value - missing closing quote
            {
                actual: '[attr="value]',
                expected: (context) => (new AdblockSyntaxError(
                    'Missing ] in attribute selector',
                    ...context.toTuple(context.getRangeFor('[')),
                )),
            },

            // invalid attribute - missing closing bracket
            {
                actual: '[attr="value"',
                expected: (context) => (new AdblockSyntaxError(
                    'Missing ] in attribute selector',
                    ...context.toTuple(context.getRangeFor('[')),
                )),
            },

            // invalid attribute - missing operator
            {
                actual: '[attr "value"]',
                expected: (context) => (new AdblockSyntaxError(
                    'Invalid attribute selector operator',
                    ...context.toTuple(context.getRangeFor('"')),
                )),
            },

            // invalid attribute - invalid operator !
            {
                actual: '[attr!="value"]',
                expected: (context) => (new AdblockSyntaxError(
                    'Invalid attribute selector operator',
                    ...context.toTuple(context.getRangeFor('!')),
                )),
            },

            // invalid attribute - invalid operator (not equal sign)
            {
                actual: '[attr~!"value"]',
                expected: (context) => (new AdblockSyntaxError(
                    'Invalid attribute selector operator',
                    ...context.toTuple(context.getRangeFor('~')),
                )),
            },

            // invalid attribute - missing value
            {
                actual: '[attr=]',
                expected: (context) => (new AdblockSyntaxError(
                    'Expected attribute selector value after operator',
                    ...context.toTuple(context.getRangeFor(']')),
                )),
            },

            // invalid attribute - invalid flag (value as string)
            {
                actual: '[attr="value" "i"]',
                expected: (context) => (new AdblockSyntaxError(
                    'Expected ] or case flag after attribute value',
                    ...context.toTuple(context.getRangeFor('"', 3)),
                )),
            },

            // invalid pseudo-class name - empty
            {
                actual: ':',
                expected: (context) => (new AdblockSyntaxError(
                    'Empty pseudo-class: expected name after :',
                    ...context.toTuple(context.getRangeFor(':')),
                )),
            },

            // invalid pseudo-class name - as string
            {
                actual: ':"pseudo"',
                expected: (context) => (new AdblockSyntaxError(
                    'Empty pseudo-class: expected identifier after :',
                    ...context.toTuple(context.getRangeFor('"')),
                )),
            },

            // invalid pseudo-class function - missing closing parenthesis (without argument)
            {
                actual: ':pseudo(',
                expected: (context) => (new AdblockSyntaxError(
                    'Missing ) in pseudo-class functional argument',
                    ...context.toTuple(context.getRangeFor('(')),
                )),
            },

            // invalid pseudo-class function - missing closing parenthesis (with argument)
            {
                actual: ':pseudo(arg',
                expected: (context) => (new AdblockSyntaxError(
                    'Missing ) in pseudo-class functional argument',
                    ...context.toTuple(context.getRangeFor('(')),
                )),
            },

            // invalid class name
            {
                actual: '."class"',
                expected: (context) => (new AdblockSyntaxError(
                    'Invalid class selector: expected identifier after .',
                    ...context.toTuple(context.getRangeFor('"')),
                )),
            },

            // invalid combinator - empty before
            {
                actual: '>div',
                expected: (context) => (new AdblockSyntaxError(
                    'Combinator at the start of a selector',
                    ...context.toTuple(context.getRangeFor('>')),
                )),
            },

            // invalid combinator - empty after (trailing)
            // NOTE: parser reports position one past end of string
            {
                actual: 'div+',
                expected: () => (new AdblockSyntaxError(
                    'Trailing combinator at the end of selector',
                    4,
                    5,
                )),
            },

            // invalid combinator - two in a row
            {
                actual: 'div > + span',
                expected: (context) => (new AdblockSyntaxError(
                    'Consecutive combinators in selector',
                    ...context.toTuple(context.getRangeFor('+')),
                )),
            },

            // invalid combinator - unknown symbol
            {
                actual: 'div $ span',
                expected: (context) => (new AdblockSyntaxError(
                    "Unexpected token in selector: '$'",
                    ...context.toTuple(context.getRangeFor('$')),
                )),
            },

            // invalid comma separator - empty before
            {
                actual: ',div',
                expected: (context) => (new AdblockSyntaxError(
                    'Empty selector in selector list',
                    ...context.toTuple(context.getRangeFor(',')),
                )),
            },

            // invalid comma separator - empty after (trailing)
            // NOTE: parser reports position one past end of string
            {
                actual: 'div,',
                expected: () => (new AdblockSyntaxError(
                    'Empty selector after comma in selector list',
                    4,
                    5,
                )),
            },

            // invalid comma separator - two in a row
            {
                actual: 'div, ,span',
                expected: (context) => (new AdblockSyntaxError(
                    'Empty selector in selector list',
                    ...context.toTuple(context.getRangeFor(',', 2)),
                )),
            },

            // invalid selector - media query-like input
            {
                actual: '@media screen and (max-width: 600px)',
                expected: (context) => (new AdblockSyntaxError(
                    "Unexpected token in selector: '@'",
                    ...context.toTuple(context.getRangeFor('@')),
                )),
            },

            // invalid attribute - unescaped double quote in value
            // NOTE: parser sees 'quotes' as an invalid flag identifier
            {
                actual: '[attr="value with " quotes"]',
                expected: (context) => (new AdblockSyntaxError(
                    "Invalid attribute selector flag 'quotes': expected i, I, s, or S",
                    ...context.toTuple(context.getRangeFor('quotes')),
                )),
            },

            // invalid attribute - unescaped single quote in value
            // NOTE: parser sees 'quotes' as an invalid flag identifier
            {
                actual: "[attr='value with ' quotes']",
                expected: (context) => (new AdblockSyntaxError(
                    "Invalid attribute selector flag 'quotes': expected i, I, s, or S",
                    ...context.toTuple(context.getRangeFor('quotes')),
                )),
            },
        ])("should throw on input: '$actual'", ({ actual, expected: expectedFn }) => {
            const fn = vi.fn(() => parseSelectorList(actual));

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
});
