import {
    describe,
    expect,
    test,
    vi,
} from 'vitest';

import { NodeExpectContext, type NodeExpectFn } from '../../../helpers/node-utils';
import { AdblockSyntaxError, type HtmlFilteringRuleBody } from '../../../../src';
import {
    UboHtmlFilteringBodyParser,
} from '../../../../src/parser/cosmetic/html-filtering-body/ubo-html-filtering-body-parser';
import {
    UboHtmlFilteringBodyGenerator,
} from '../../../../src/generator/cosmetic/html-filtering-body/ubo-html-filtering-body-generator';
import {
    UboHtmlFilteringBodySerializer,
} from '../../../../src/serializer/cosmetic/html-filtering-body/ubo-html-filtering-body-serializer';
import {
    UboHtmlFilteringBodyDeserializer,
} from '../../../../src/deserializer/cosmetic/html-filtering-body/ubo-html-filtering-body-deserializer';

describe('UboHtmlFilteringBodyParser', () => {
    describe('UboHtmlFilteringBodyParser.parse - valid cases', () => {
        test.each<{ actual: string; expected: NodeExpectFn<HtmlFilteringRuleBody> }>([
            // basic
            {
                actual: '^div[attr="value"]',
                expected: (context: NodeExpectContext) => ({
                    type: 'HtmlFilteringRuleBody',
                    selectors: [{
                        type: 'HtmlFilteringRuleSelector',
                        tagName: {
                            type: 'Value',
                            value: 'div',
                            ...context.getRangeFor('div'),
                        },
                        attributes: [{
                            type: 'HtmlFilteringRuleSelectorAttribute',
                            name: {
                                type: 'Value',
                                value: 'attr',
                                ...context.getRangeFor('attr'),
                            },
                            value: {
                                type: 'Value',
                                value: 'value',
                                ...context.getRangeFor('value'),
                            },
                            ...context.getRangeFor('[attr="value"]'),
                        }],
                        pseudoClasses: [],
                        ...context.getRangeFor('div[attr="value"]'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // without attributes
            {
                actual: '^div',
                expected: (context: NodeExpectContext) => ({
                    type: 'HtmlFilteringRuleBody',
                    selectors: [{
                        type: 'HtmlFilteringRuleSelector',
                        tagName: {
                            type: 'Value',
                            value: 'div',
                            ...context.getRangeFor('div'),
                        },
                        attributes: [],
                        pseudoClasses: [],
                        ...context.getRangeFor('div'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // without tag name
            {
                actual: '^[attr="value"]',
                expected: (context: NodeExpectContext) => ({
                    type: 'HtmlFilteringRuleBody',
                    selectors: [{
                        type: 'HtmlFilteringRuleSelector',
                        attributes: [{
                            type: 'HtmlFilteringRuleSelectorAttribute',
                            name: {
                                type: 'Value',
                                value: 'attr',
                                ...context.getRangeFor('attr'),
                            },
                            value: {
                                type: 'Value',
                                value: 'value',
                                ...context.getRangeFor('value'),
                            },
                            ...context.getRangeFor('[attr="value"]'),
                        }],
                        pseudoClasses: [],
                        ...context.getRangeFor('[attr="value"]'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // unquoted attribute value
            {
                actual: '^div[attr=value]',
                expected: (context: NodeExpectContext) => ({
                    type: 'HtmlFilteringRuleBody',
                    selectors: [{
                        type: 'HtmlFilteringRuleSelector',
                        tagName: {
                            type: 'Value',
                            value: 'div',
                            ...context.getRangeFor('div'),
                        },
                        attributes: [{
                            type: 'HtmlFilteringRuleSelectorAttribute',
                            name: {
                                type: 'Value',
                                value: 'attr',
                                ...context.getRangeFor('attr'),
                            },
                            value: {
                                type: 'Value',
                                value: 'value',
                                ...context.getRangeFor('value'),
                            },
                            ...context.getRangeFor('[attr=value]'),
                        }],
                        pseudoClasses: [],
                        ...context.getRangeFor('div[attr=value]'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute without value
            {
                actual: '^div[attr]',
                expected: (context: NodeExpectContext) => ({
                    type: 'HtmlFilteringRuleBody',
                    selectors: [{
                        type: 'HtmlFilteringRuleSelector',
                        tagName: {
                            type: 'Value',
                            value: 'div',
                            ...context.getRangeFor('div'),
                        },
                        attributes: [{
                            type: 'HtmlFilteringRuleSelectorAttribute',
                            name: {
                                type: 'Value',
                                value: 'attr',
                                ...context.getRangeFor('attr'),
                            },
                            ...context.getRangeFor('[attr]'),
                        }],
                        pseudoClasses: [],
                        ...context.getRangeFor('div[attr]'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // multiple attributes
            {
                actual: '^div[attr1="value1"][attr2=value2][attr3]',
                expected: (context: NodeExpectContext) => ({
                    type: 'HtmlFilteringRuleBody',
                    selectors: [{
                        type: 'HtmlFilteringRuleSelector',
                        tagName: {
                            type: 'Value',
                            value: 'div',
                            ...context.getRangeFor('div'),
                        },
                        attributes: [{
                            type: 'HtmlFilteringRuleSelectorAttribute',
                            name: {
                                type: 'Value',
                                value: 'attr1',
                                ...context.getRangeFor('attr1'),
                            },
                            value: {
                                type: 'Value',
                                value: 'value1',
                                ...context.getRangeFor('value1'),
                            },
                            ...context.getRangeFor('[attr1="value1"]'),
                        }, {
                            type: 'HtmlFilteringRuleSelectorAttribute',
                            name: {
                                type: 'Value',
                                value: 'attr2',
                                ...context.getRangeFor('attr2'),
                            },
                            value: {
                                type: 'Value',
                                value: 'value2',
                                ...context.getRangeFor('value2'),
                            },
                            ...context.getRangeFor('[attr2=value2]'),
                        }, {
                            type: 'HtmlFilteringRuleSelectorAttribute',
                            name: {
                                type: 'Value',
                                value: 'attr3',
                                ...context.getRangeFor('attr3'),
                            },
                            ...context.getRangeFor('[attr3]'),
                        }],
                        pseudoClasses: [],
                        ...context.getRangeFor('div[attr1="value1"][attr2=value2][attr3]'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // tag name and attribute name with hyphen
            {
                actual: '^my-div[attr-name="value"]',
                expected: (context: NodeExpectContext) => ({
                    type: 'HtmlFilteringRuleBody',
                    selectors: [{
                        type: 'HtmlFilteringRuleSelector',
                        tagName: {
                            type: 'Value',
                            value: 'my-div',
                            ...context.getRangeFor('my-div'),
                        },
                        attributes: [{
                            type: 'HtmlFilteringRuleSelectorAttribute',
                            name: {
                                type: 'Value',
                                value: 'attr-name',
                                ...context.getRangeFor('attr-name'),
                            },
                            value: {
                                type: 'Value',
                                value: 'value',
                                ...context.getRangeFor('value'),
                            },
                            ...context.getRangeFor('[attr-name="value"]'),
                        }],
                        pseudoClasses: [],
                        ...context.getRangeFor('my-div[attr-name="value"]'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // tag name and attribute name with underscore
            {
                actual: '^my_div[attr_name="value"]',
                expected: (context: NodeExpectContext) => ({
                    type: 'HtmlFilteringRuleBody',
                    selectors: [{
                        type: 'HtmlFilteringRuleSelector',
                        tagName: {
                            type: 'Value',
                            value: 'my_div',
                            ...context.getRangeFor('my_div'),
                        },
                        attributes: [{
                            type: 'HtmlFilteringRuleSelectorAttribute',
                            name: {
                                type: 'Value',
                                value: 'attr_name',
                                ...context.getRangeFor('attr_name'),
                            },
                            value: {
                                type: 'Value',
                                value: 'value',
                                ...context.getRangeFor('value'),
                            },
                            ...context.getRangeFor('[attr_name="value"]'),
                        }],
                        pseudoClasses: [],
                        ...context.getRangeFor('my_div[attr_name="value"]'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // with whitespaces
            {
                actual: ' ^ div [ attr1 = " value1 " ] [ attr2 = value2 ] [ attr3 ] :nth-child( 2 ) ',
                expected: (context: NodeExpectContext) => ({
                    type: 'HtmlFilteringRuleBody',
                    selectors: [{
                        type: 'HtmlFilteringRuleSelector',
                        tagName: {
                            type: 'Value',
                            value: 'div',
                            ...context.getRangeFor('div'),
                        },
                        attributes: [{
                            type: 'HtmlFilteringRuleSelectorAttribute',
                            name: {
                                type: 'Value',
                                value: 'attr1',
                                ...context.getRangeFor('attr1'),
                            },
                            value: {
                                type: 'Value',
                                value: ' value1 ',
                                ...context.getRangeFor(' value1 '),
                            },
                            ...context.getRangeFor('[ attr1 = " value1 " ]'),
                        }, {
                            type: 'HtmlFilteringRuleSelectorAttribute',
                            name: {
                                type: 'Value',
                                value: 'attr2',
                                ...context.getRangeFor('attr2'),
                            },
                            value: {
                                type: 'Value',
                                value: 'value2',
                                ...context.getRangeFor('value2'),
                            },
                            ...context.getRangeFor('[ attr2 = value2 ]'),
                        }, {
                            type: 'HtmlFilteringRuleSelectorAttribute',
                            name: {
                                type: 'Value',
                                value: 'attr3',
                                ...context.getRangeFor('attr3'),
                            },
                            ...context.getRangeFor('[ attr3 ]'),
                        }],
                        pseudoClasses: [{
                            type: 'HtmlFilteringRuleSelectorPseudoClass',
                            name: {
                                type: 'Value',
                                value: 'nth-child',
                                ...context.getRangeFor('nth-child'),
                            },
                            content: {
                                type: 'Value',
                                value: ' 2 ',
                                ...context.getRangeFor(' 2 '),
                            },
                            ...context.getRangeFor(':nth-child( 2 )'),
                        }],
                        ...context.getRangeFor(
                            'div [ attr1 = " value1 " ] [ attr2 = value2 ] [ attr3 ] :nth-child( 2 )',
                        ),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // with pseudo class
            {
                actual: '^div:nth-child(2)',
                expected: (context: NodeExpectContext) => ({
                    type: 'HtmlFilteringRuleBody',
                    selectors: [{
                        type: 'HtmlFilteringRuleSelector',
                        tagName: {
                            type: 'Value',
                            value: 'div',
                            ...context.getRangeFor('div'),
                        },
                        attributes: [],
                        pseudoClasses: [{
                            type: 'HtmlFilteringRuleSelectorPseudoClass',
                            name: {
                                type: 'Value',
                                value: 'nth-child',
                                ...context.getRangeFor('nth-child'),
                            },
                            content: {
                                type: 'Value',
                                value: '2',
                                ...context.getRangeFor('2'),
                            },
                            ...context.getRangeFor(':nth-child(2)'),
                        }],
                        ...context.getRangeFor('div:nth-child(2)'),
                    }],
                    ...context.getRangeFor('^div:nth-child(2)'),
                }),
            },

            // multiple pseudo classes
            {
                actual: '^div:nth-child(3):has-text(example)',
                expected: (context: NodeExpectContext) => ({
                    type: 'HtmlFilteringRuleBody',
                    selectors: [{
                        type: 'HtmlFilteringRuleSelector',
                        tagName: {
                            type: 'Value',
                            value: 'div',
                            ...context.getRangeFor('div'),
                        },
                        attributes: [],
                        pseudoClasses: [{
                            type: 'HtmlFilteringRuleSelectorPseudoClass',
                            name: {
                                type: 'Value',
                                value: 'nth-child',
                                ...context.getRangeFor('nth-child'),
                            },
                            content: {
                                type: 'Value',
                                value: '3',
                                ...context.getRangeFor('3'),
                            },
                            ...context.getRangeFor(':nth-child(3)'),
                        }, {
                            type: 'HtmlFilteringRuleSelectorPseudoClass',
                            name: {
                                type: 'Value',
                                value: 'has-text',
                                ...context.getRangeFor('has-text'),
                            },
                            content: {
                                type: 'Value',
                                value: 'example',
                                ...context.getRangeFor('example'),
                            },
                            ...context.getRangeFor(':has-text(example)'),
                        }],
                        ...context.getRangeFor('div:nth-child(3):has-text(example)'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // with attributes and pseudo classes
            {
                actual: '^div[attr="value"]:nth-of-type(4)',
                expected: (context: NodeExpectContext) => ({
                    type: 'HtmlFilteringRuleBody',
                    selectors: [{
                        type: 'HtmlFilteringRuleSelector',
                        tagName: {
                            type: 'Value',
                            value: 'div',
                            ...context.getRangeFor('div'),
                        },
                        attributes: [{
                            type: 'HtmlFilteringRuleSelectorAttribute',
                            name: {
                                type: 'Value',
                                value: 'attr',
                                ...context.getRangeFor('attr'),
                            },
                            value: {
                                type: 'Value',
                                value: 'value',
                                ...context.getRangeFor('value'),
                            },
                            ...context.getRangeFor('[attr="value"]'),
                        }],
                        pseudoClasses: [{
                            type: 'HtmlFilteringRuleSelectorPseudoClass',
                            name: {
                                type: 'Value',
                                value: 'nth-of-type',
                                ...context.getRangeFor('nth-of-type'),
                            },
                            content: {
                                type: 'Value',
                                value: '4',
                                ...context.getRangeFor('4'),
                            },
                            ...context.getRangeFor(':nth-of-type(4)'),
                        }],
                        ...context.getRangeFor('div[attr="value"]:nth-of-type(4)'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // without tag name, with attributes and pseudo classes
            {
                actual: '^[attr="value"]:nth-of-type(4)',
                expected: (context: NodeExpectContext) => ({
                    type: 'HtmlFilteringRuleBody',
                    selectors: [{
                        type: 'HtmlFilteringRuleSelector',
                        attributes: [{
                            type: 'HtmlFilteringRuleSelectorAttribute',
                            name: {
                                type: 'Value',
                                value: 'attr',
                                ...context.getRangeFor('attr'),
                            },
                            value: {
                                type: 'Value',
                                value: 'value',
                                ...context.getRangeFor('value'),
                            },
                            ...context.getRangeFor('[attr="value"]'),
                        }],
                        pseudoClasses: [{
                            type: 'HtmlFilteringRuleSelectorPseudoClass',
                            name: {
                                type: 'Value',
                                value: 'nth-of-type',
                                ...context.getRangeFor('nth-of-type'),
                            },
                            content: {
                                type: 'Value',
                                value: '4',
                                ...context.getRangeFor('4'),
                            },
                            ...context.getRangeFor(':nth-of-type(4)'),
                        }],
                        ...context.getRangeFor('[attr="value"]:nth-of-type(4)'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // multiple selectors
            {
                actual: '^div[attr="value"], span[attr2="value2"], [attr3="value3"]:nth-child(5)',
                expected: (context: NodeExpectContext) => ({
                    type: 'HtmlFilteringRuleBody',
                    selectors: [{
                        type: 'HtmlFilteringRuleSelector',
                        tagName: {
                            type: 'Value',
                            value: 'div',
                            ...context.getRangeFor('div'),
                        },
                        attributes: [{
                            type: 'HtmlFilteringRuleSelectorAttribute',
                            name: {
                                type: 'Value',
                                value: 'attr',
                                ...context.getRangeFor('attr'),
                            },
                            value: {
                                type: 'Value',
                                value: 'value',
                                ...context.getRangeFor('value'),
                            },
                            ...context.getRangeFor('[attr="value"]'),
                        }],
                        pseudoClasses: [],
                    }, {
                        type: 'HtmlFilteringRuleSelector',
                        tagName: {
                            type: 'Value',
                            value: 'span',
                            ...context.getRangeFor('span'),
                        },
                        attributes: [{
                            type: 'HtmlFilteringRuleSelectorAttribute',
                            name: {
                                type: 'Value',
                                value: 'attr2',
                                ...context.getRangeFor('attr2'),
                            },
                            value: {
                                type: 'Value',
                                value: 'value2',
                                ...context.getRangeFor('value2'),
                            },
                            ...context.getRangeFor('[attr2="value2"]'),
                        }],
                        pseudoClasses: [],
                    }, {
                        type: 'HtmlFilteringRuleSelector',
                        attributes: [{
                            type: 'HtmlFilteringRuleSelectorAttribute',
                            name: {
                                type: 'Value',
                                value: 'attr3',
                                ...context.getRangeFor('attr3'),
                            },
                            value: {
                                type: 'Value',
                                value: 'value3',
                                ...context.getRangeFor('value3'),
                            },
                            ...context.getRangeFor('[attr3="value3"]'),
                        }],
                        pseudoClasses: [{
                            type: 'HtmlFilteringRuleSelectorPseudoClass',
                            name: {
                                type: 'Value',
                                value: 'nth-child',
                                ...context.getRangeFor('nth-child'),
                            },
                            content: {
                                type: 'Value',
                                value: '5',
                                ...context.getRangeFor('5'),
                            },
                            ...context.getRangeFor(':nth-child(5)'),
                        }],
                        ...context.getRangeFor('[attr3="value3"]:nth-child(5)'),
                    }],
                }),
            },

            // attribute value with flags
            {
                actual: '^div[attr1="value1" i][attr2=value2 s]',
                expected: (context: NodeExpectContext) => ({
                    type: 'HtmlFilteringRuleBody',
                    selectors: [{
                        type: 'HtmlFilteringRuleSelector',
                        tagName: {
                            type: 'Value',
                            value: 'div',
                            ...context.getRangeFor('div'),
                        },
                        attributes: [{
                            type: 'HtmlFilteringRuleSelectorAttribute',
                            name: {
                                type: 'Value',
                                value: 'attr1',
                                ...context.getRangeFor('attr1'),
                            },
                            value: {
                                type: 'Value',
                                value: 'value1',
                                ...context.getRangeFor('value1'),
                            },
                            flags: {
                                type: 'Value',
                                value: 'i',
                                ...context.getRangeFor('i', 2),
                            },
                            ...context.getRangeFor('[attr1="value1" i]'),
                        }, {
                            type: 'HtmlFilteringRuleSelectorAttribute',
                            name: {
                                type: 'Value',
                                value: 'attr2',
                                ...context.getRangeFor('attr2'),
                            },
                            value: {
                                type: 'Value',
                                value: 'value2',
                                ...context.getRangeFor('value2'),
                            },
                            flags: {
                                type: 'Value',
                                value: 's',
                                ...context.getRangeFor('s'),
                            },
                            ...context.getRangeFor('[attr2=value2 s]'),
                        }],
                        pseudoClasses: [],
                        ...context.getRangeFor('div[attr1="value1" i][attr2=value2 s]'),
                    }],
                    ...context.getFullRange(),
                }),
            },
        ])("should parse '$actual'", ({ actual, expected: expectedFn }) => {
            expect(UboHtmlFilteringBodyParser.parse(actual)).toMatchObject(
                expectedFn(new NodeExpectContext(actual)),
            );
        });
    });

    describe('UboHtmlFilteringBodyParser.parse - invalid cases', () => {
        test.each<{ actual: string; expected: NodeExpectFn<AdblockSyntaxError> }>([
            // empty
            {
                actual: '',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Expected '<delim-token>', but got 'end of input'",
                    ...context.toTuple({
                        start: -1,
                        end: 0,
                    }),
                )),
            },

            // empty body
            {
                actual: '^',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Expected a token, but got 'end of input'",
                    ...context.toTuple(context.getFullRange()),
                )),
            },

            // identifier after tag name
            {
                actual: '^div span[attr="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Unexpected token '<ident-token>' with value 'span'",
                    ...context.toTuple(context.getRangeFor('span')),
                )),
            },

            // tag name after attribute
            {
                actual: '^[attr="value"]div',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Unexpected token '<ident-token>' with value 'div', tag selector should be the first child",
                    ...context.toTuple(context.getRangeFor('div')),
                )),
            },

            // unfinished attribute
            {
                actual: '^div[',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Expected '<]-token>', but got 'end of input'",
                    ...context.toTuple(context.getRangeFor('[')),
                )),
            },

            // empty attribute brackets
            {
                actual: '^div[]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Attribute name should be an identifier, but got '<]-token>' with value ']'",
                    ...context.toTuple(context.getRangeFor(']')),
                )),
            },

            // without attribute name
            {
                actual: '^div[="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Attribute name should be an identifier, but got '<delim-token>' with value '='",
                    ...context.toTuple(context.getRangeFor('=')),
                )),
            },

            // without equals sign
            {
                actual: '^div[attr "value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Expected '<delim-token>', but got '<string-token>'",
                    ...context.toTuple(context.getRangeFor('"value"')),
                )),
            },

            // attribute ~= operator not supported
            {
                actual: '^div[attr~="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Expected '<delim-token>' with value '=', but got '~'",
                    ...context.toTuple(context.getRangeFor('~')),
                )),
            },

            // attribute ^= operator not supported
            {
                actual: '^div[attr^="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Expected '<delim-token>' with value '=', but got '^'",
                    ...context.toTuple(context.getRangeFor('^', 2)),
                )),
            },

            // attribute $= operator not supported
            {
                actual: '^div[attr$="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Expected '<delim-token>' with value '=', but got '$'",
                    ...context.toTuple(context.getRangeFor('$')),
                )),
            },

            // attribute *= operator not supported
            {
                actual: '^div[attr*="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Expected '<delim-token>' with value '=', but got '*'",
                    ...context.toTuple(context.getRangeFor('*')),
                )),
            },

            // attribute |= operator not supported
            {
                actual: '^div[attr|="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Expected '<delim-token>' with value '=', but got '|'",
                    ...context.toTuple(context.getRangeFor('|')),
                )),
            },

            // equal sign without value
            {
                actual: '^div[attr=]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    // eslint-disable-next-line max-len
                    "Expected '<ident-token>' or '<string-token>' as attribute value, but got '<]-token>' with value ']'",
                    ...context.toTuple(context.getRangeFor(']')),
                )),
            },

            // unclosed attribute brackets
            {
                actual: '^div[attr="value"',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Expected '<]-token>', but got 'end of input'",
                    ...context.toTuple({
                        start: context.getFullRange().end - 1,
                        end: context.getFullRange().end,
                    }),
                )),
            },

            // any unexpected token
            {
                actual: '^div[attr="value"] #id',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Unexpected token '<hash-token>' with value '#id'",
                    ...context.toTuple(context.getRangeFor('#id')),
                )),
            },

            // tag name with dot
            {
                actual: '^div.test[attr="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Unexpected token '<delim-token>' with value '.'",
                    ...context.toTuple(context.getRangeFor('.')),
                )),
            },

            // tag name with hash
            {
                actual: '^div#id[attr="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Unexpected token '<hash-token>' with value '#id'",
                    ...context.toTuple(context.getRangeFor('#id')),
                )),
            },

            // tag name with colon
            {
                actual: '^xml:test[attr="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Expected '<function-token>', but got '<ident-token>'",
                    ...context.toTuple(context.getRangeFor('test')),
                )),
            },

            // attribute name with dot
            {
                actual: '^div[attr.name="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Expected '<delim-token>' with value '=', but got '.'",
                    ...context.toTuple(context.getRangeFor('.')),
                )),
            },

            // attribute name with hash
            {
                actual: '^div[attr#name="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Expected '<delim-token>', but got '<hash-token>'",
                    ...context.toTuple(context.getRangeFor('#name')),
                )),
            },

            // attribute name with colon
            {
                actual: '^div[xml:test="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Expected '<delim-token>', but got '<colon-token>'",
                    ...context.toTuple(context.getRangeFor(':')),
                )),
            },

            // class instead of tag name
            {
                actual: '^.class[attr="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Unexpected token '<delim-token>' with value '.'",
                    ...context.toTuple(context.getRangeFor('.')),
                )),
            },

            // id instead of tag name
            {
                actual: '^#id[attr="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Unexpected token '<hash-token>' with value '#id'",
                    ...context.toTuple(context.getRangeFor('#id')),
                )),
            },

            // child combinator not supported
            {
                actual: '^div > span[attr="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Unexpected token '<delim-token>' with value '>'",
                    ...context.toTuple(context.getRangeFor('>')),
                )),
            },

            // sibling combinator not supported
            {
                actual: '^div + span[attr="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Unexpected token '<delim-token>' with value '+'",
                    ...context.toTuple(context.getRangeFor('+')),
                )),
            },

            // bad identifier in attr name
            {
                actual: '^div[1attr="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Attribute name should be an identifier, but got '<dimension-token>' with value '1attr'",
                    ...context.toTuple(context.getRangeFor('1attr')),
                )),
            },

            // bad identifier in attr name
            {
                actual: '^div[attr=1value]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    // eslint-disable-next-line max-len
                    "Expected '<ident-token>' or '<string-token>' as attribute value, but got '<dimension-token>' with value '1value'",
                    ...context.toTuple(context.getRangeFor('1value')),
                )),
            },

            // illegal comma
            {
                actual: '^,span[attr="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    'HTML filtering rule body cannot be empty',
                    ...context.toTuple(context.getRangeFor('^,span[attr="value"]')),
                )),
            },

            // tag after attrs and pseudo classes
            {
                actual: '^[attr="value"]:nth-child(2)div',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Unexpected token '<ident-token>' with value 'div', tag selector should be the first child",
                    ...context.toTuple(context.getRangeFor('div')),
                )),
            },

            // attrs after pseudo classes
            {
                actual: '^div:nth-child(2)[attr="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Unexpected token '<[-token>' with value '[', attributes should be defined before pseudo classes",
                    ...context.toTuple(context.getRangeFor('[')),
                )),
            },

            // empty before pseudo class
            {
                actual: '^:nth-child(2)',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    'Pseudo class cannot be the first child of a selector',
                    ...context.toTuple(context.getRangeFor(':')),
                )),
            },

            // non-function pseudo class
            {
                actual: '^div:first-child',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Expected '<function-token>', but got '<ident-token>'",
                    ...context.toTuple(context.getRangeFor('first-child')),
                )),
            },

            // unclosed pseudo class parentheses
            {
                actual: '^div:nth-child(2',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Expected '<)-token>', but got 'end of input'",
                    ...context.toTuple({
                        start: context.getFullRange().end - 1,
                        end: context.getFullRange().end,
                    }),
                )),
            },
        ])("should throw on input: '$actual'", ({ actual, expected: expectedFn }) => {
            const fn = vi.fn(() => UboHtmlFilteringBodyParser.parse(actual));

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

    describe('UboHtmlFilteringBodyGenerator.generate', () => {
        test.each<{ actual: string; expected: string }>([
            {
                actual: String.raw`^div[attr="value"]`,
                expected: String.raw`^div[attr="value"]`,
            },
            {
                actual: String.raw`^div`,
                expected: String.raw`^div`,
            },
            {
                actual: String.raw`^[attr="value"]`,
                expected: String.raw`^[attr="value"]`,
            },
            {
                actual: String.raw`^div[attr=value]`,
                expected: String.raw`^div[attr="value"]`,
            },
            {
                actual: String.raw`^div[attr]`,
                expected: String.raw`^div[attr]`,
            },
            {
                actual: String.raw`^div[attr1="value1"][attr2=value2][attr3]`,
                expected: String.raw`^div[attr1="value1"][attr2="value2"][attr3]`,
            },
            {
                actual: String.raw`^my-div[attr-name="value"]`,
                expected: String.raw`^my-div[attr-name="value"]`,
            },
            {
                actual: String.raw`^my_div[attr_name="value"]`,
                expected: String.raw`^my_div[attr_name="value"]`,
            },
            {
                actual: String.raw` ^ div [ attr1 = " value1 " ] [ attr2 = value2 ] [ attr3 ] :nth-child( 2 ) `,
                expected: String.raw`^div[attr1=" value1 "][attr2="value2"][attr3]:nth-child( 2 )`,
            },
            {
                actual: String.raw`^div:nth-child(2)`,
                expected: String.raw`^div:nth-child(2)`,
            },
            {
                actual: String.raw`^div:nth-child(3):has-text(example)`,
                expected: String.raw`^div:nth-child(3):has-text(example)`,
            },
            {
                actual: String.raw`^div[attr="value"]:nth-of-type(4)`,
                expected: String.raw`^div[attr="value"]:nth-of-type(4)`,
            },
            {
                actual: String.raw`^[attr="value"]:nth-of-type(4)`,
                expected: String.raw`^[attr="value"]:nth-of-type(4)`,
            },
            {
                actual: String.raw`^div[attr="value"], span[attr2="value2"], [attr3="value3"]:nth-child(5)`,
                expected: String.raw`^div[attr="value"], span[attr2="value2"], [attr3="value3"]:nth-child(5)`,
            },
            {
                actual: String.raw`^div[attr1="value1" i][attr2=value2 s]`,
                expected: String.raw`^div[attr1="value1" i][attr2="value2" s]`,
            },
        ])("should generate '$expected' from '$actual'", ({ actual, expected }) => {
            const ruleNode = UboHtmlFilteringBodyParser.parse(actual);

            if (ruleNode === null) {
                throw new Error(`Failed to parse '${actual}' as cosmetic rule`);
            }

            expect(UboHtmlFilteringBodyGenerator.generate(ruleNode)).toBe(expected);
        });
    });

    describe('serialize & deserialize', () => {
        test.each([
            '^div[attr="value"]',
            '^div',
            '^[attr="value"]',
            '^div[attr=value]',
            '^div[attr]',
            '^div[attr1="value1"][attr2=value2][attr3]',
            '^my-div[attr-name="value"]',
            '^my_div[attr_name="value"]',
            ' ^ div [ attr1 = " value1 " ] [ attr2 = value2 ] [ attr3 ] :nth-child( 2 ) ',
            '^div:nth-child(2)',
            '^div:nth-child(3):has-text(example)',
            '^div[attr="value"]:nth-of-type(4)',
            '^[attr="value"]:nth-of-type(4)',
            '^div[attr="value"], span[attr2="value2"], [attr3="value3"]:nth-child(5)',
            '^div[attr1="value1" i][attr2=value2 s]',
        ])("should serialize and deserialize '%p'", async (input) => {
            await expect(input).toBeSerializedAndDeserializedProperly(
                UboHtmlFilteringBodyParser,
                UboHtmlFilteringBodyGenerator,
                UboHtmlFilteringBodySerializer,
                UboHtmlFilteringBodyDeserializer,
            );
        });
    });
});
