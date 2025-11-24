import {
    describe,
    expect,
    test,
    vi,
} from 'vitest';

import { NodeExpectContext, type NodeExpectFn } from '../../../helpers/node-utils';
import { AdblockSyntaxError, type HtmlFilteringRuleBody } from '../../../../src';
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

describe('AdgHtmlFilteringBodyParser', () => {
    describe('AdgHtmlFilteringBodyParser.parse - valid cases', () => {
        test.each<{ actual: string; expected: NodeExpectFn<HtmlFilteringRuleBody> }>([
            // basic
            {
                actual: 'div[attr="value"]',
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
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // without attributes
            {
                actual: 'div',
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
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // without tag name
            {
                actual: '[attr="value"]',
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
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // unquoted attribute value
            {
                actual: 'div[attr=value]',
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
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // attribute without value
            {
                actual: 'div[attr]',
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
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // multiple attributes
            {
                actual: 'div[attr1="value1"][attr2=value2][attr3]',
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
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // escaped double quote in attribute value
            {
                actual: 'div[attr1="1""2""3"][attr2="4""5""6"][attr3="7""8""9"]',
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
                                value: '1\\"2\\"3',
                                ...context.getRangeFor('1""2""3'),
                            },
                            ...context.getRangeFor('[attr1="1""2""3"]'),
                        }, {
                            type: 'HtmlFilteringRuleSelectorAttribute',
                            name: {
                                type: 'Value',
                                value: 'attr2',
                                ...context.getRangeFor('attr2'),
                            },
                            value: {
                                type: 'Value',
                                value: '4\\"5\\"6',
                                ...context.getRangeFor('4""5""6'),
                            },
                            ...context.getRangeFor('[attr2="4""5""6"]'),
                        }, {
                            type: 'HtmlFilteringRuleSelectorAttribute',
                            name: {
                                type: 'Value',
                                value: 'attr3',
                                ...context.getRangeFor('attr3'),
                            },
                            value: {
                                type: 'Value',
                                value: '7\\"8\\"9',
                                ...context.getRangeFor('7""8""9'),
                            },
                            ...context.getRangeFor('[attr3="7""8""9"]'),
                        }],
                        pseudoClasses: [],
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // tag name and attribute name with hyphen
            {
                actual: 'my-div[attr-name="value"]',
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
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // tag name and attribute name with underscore
            {
                actual: 'my_div[attr_name="value"]',
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
                        ...context.getFullRange(),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // with whitespaces
            {
                actual: ' div [ attr1 = " value1 " ] [ attr2 = value2 ] [ attr3 ] ',
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
                        pseudoClasses: [],
                        ...context.getFullRange(),
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

    describe('AdgHtmlFilteringBodyParser.parse - invalid cases', () => {
        test.each<{ actual: string; expected: NodeExpectFn<AdblockSyntaxError> }>([
            // empty
            {
                actual: '',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    'HTML filtering rule body cannot be empty',
                    ...context.toTuple(context.getFullRange()),
                )),
            },

            // identifier after tag name
            {
                actual: 'div span[attr="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Unexpected token '<ident-token>' with value 'span'",
                    ...context.toTuple(context.getRangeFor('span')),
                )),
            },

            // tag name after attribute
            {
                actual: '[attr="value"]div',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Unexpected token '<ident-token>' with value 'div', tag selector should be the first child",
                    ...context.toTuple(context.getRangeFor('div')),
                )),
            },

            // unfinished attribute
            {
                actual: 'div[',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Expected '<]-token>', but got 'end of input'",
                    ...context.toTuple(context.getRangeFor('[')),
                )),
            },

            // empty attribute brackets
            {
                actual: 'div[]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Attribute name should be an identifier, but got '<]-token>' with value ']'",
                    ...context.toTuple(context.getRangeFor(']')),
                )),
            },

            // without attribute name
            {
                actual: 'div[="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Attribute name should be an identifier, but got '<delim-token>' with value '='",
                    ...context.toTuple(context.getRangeFor('=')),
                )),
            },

            // without equals sign
            {
                actual: 'div[attr "value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Expected '<delim-token>', but got '<string-token>'",
                    ...context.toTuple(context.getRangeFor('"value"')),
                )),
            },

            // attribute ~= operator not supported
            {
                actual: 'div[attr~="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Expected '<delim-token>' with value '=', but got '~'",
                    ...context.toTuple(context.getRangeFor('~')),
                )),
            },

            // attribute ^= operator not supported
            {
                actual: 'div[attr^="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Expected '<delim-token>' with value '=', but got '^'",
                    ...context.toTuple(context.getRangeFor('^')),
                )),
            },

            // attribute $= operator not supported
            {
                actual: 'div[attr$="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Expected '<delim-token>' with value '=', but got '$'",
                    ...context.toTuple(context.getRangeFor('$')),
                )),
            },

            // attribute *= operator not supported
            {
                actual: 'div[attr*="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Expected '<delim-token>' with value '=', but got '*'",
                    ...context.toTuple(context.getRangeFor('*')),
                )),
            },

            // attribute |= operator not supported
            {
                actual: 'div[attr|="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Expected '<delim-token>' with value '=', but got '|'",
                    ...context.toTuple(context.getRangeFor('|')),
                )),
            },

            // attribute value flags not supported
            {
                actual: 'span[attr="value"i]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Expected '<]-token>', but got '<ident-token>'",
                    ...context.toTuple(context.getRangeFor('i')),
                )),
            },

            // equal sign without value
            {
                actual: 'div[attr=]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    // eslint-disable-next-line max-len
                    "Expected '<ident-token>' or '<string-token>' as attribute value, but got '<]-token>' with value ']'",
                    ...context.toTuple(context.getRangeFor(']')),
                )),
            },

            // unclosed attribute brackets
            {
                actual: 'div[attr="value"',
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
                actual: 'div[attr="value"] #id',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Unexpected token '<hash-token>' with value '#id'",
                    ...context.toTuple(context.getRangeFor('#id')),
                )),
            },

            // unquoted attribute value with spaces
            {
                actual: 'div[attr=value spaces]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Expected '<]-token>', but got '<ident-token>'",
                    ...context.toTuple(context.getRangeFor('spaces')),
                )),
            },

            // tag name with dot
            {
                actual: 'div.test[attr="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Unexpected token '<delim-token>' with value '.'",
                    ...context.toTuple(context.getRangeFor('.')),
                )),
            },

            // tag name with hash
            {
                actual: 'div#id[attr="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Unexpected token '<hash-token>' with value '#id'",
                    ...context.toTuple(context.getRangeFor('#id')),
                )),
            },

            // tag name with colon
            {
                actual: 'xml:test[attr="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Unexpected token '<colon-token>' with value ':'",
                    ...context.toTuple(context.getRangeFor(':')),
                )),
            },

            // attribute name with dot
            {
                actual: 'div[attr.name="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Expected '<delim-token>' with value '=', but got '.'",
                    ...context.toTuple(context.getRangeFor('.')),
                )),
            },

            // attribute name with hash
            {
                actual: 'div[attr#name="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Expected '<delim-token>', but got '<hash-token>'",
                    ...context.toTuple(context.getRangeFor('#name')),
                )),
            },

            // attribute name with colon
            {
                actual: 'div[xml:test="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Expected '<delim-token>', but got '<colon-token>'",
                    ...context.toTuple(context.getRangeFor(':')),
                )),
            },

            // class instead of tag name
            {
                actual: '.class[attr="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Unexpected token '<delim-token>' with value '.'",
                    ...context.toTuple(context.getRangeFor('.')),
                )),
            },

            // id instead of tag name
            {
                actual: '#id[attr="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Unexpected token '<hash-token>' with value '#id'",
                    ...context.toTuple(context.getRangeFor('#id')),
                )),
            },

            // child combinator not supported
            {
                actual: 'div > span[attr="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Unexpected token '<delim-token>' with value '>'",
                    ...context.toTuple(context.getRangeFor('>')),
                )),
            },

            // sibling combinator not supported
            {
                actual: 'div + span[attr="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Unexpected token '<delim-token>' with value '+'",
                    ...context.toTuple(context.getRangeFor('+')),
                )),
            },

            // bad identifier in attr name
            {
                actual: 'div[1attr="value"]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    "Attribute name should be an identifier, but got '<dimension-token>' with value '1attr'",
                    ...context.toTuple(context.getRangeFor('1attr')),
                )),
            },

            // bad identifier in attr name
            {
                actual: 'div[attr=1value]',
                expected: (context: NodeExpectContext) => (new AdblockSyntaxError(
                    // eslint-disable-next-line max-len
                    "Expected '<ident-token>' or '<string-token>' as attribute value, but got '<dimension-token>' with value '1value'",
                    ...context.toTuple(context.getRangeFor('1value')),
                )),
            },
        ])("should throw on input: '$actual'", ({ actual, expected: expectedFn }) => {
            const fn = vi.fn(() => AdgHtmlFilteringBodyParser.parse(actual));

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

    describe('AdgHtmlFilteringBodyGenerator.generate', () => {
        test.each<{ actual: string; expected: string }>([
            {
                actual: String.raw`div[attr="value"]`,
                expected: String.raw`div[attr="value"]`,
            },
            {
                actual: String.raw`div`,
                expected: String.raw`div`,
            },
            {
                actual: String.raw`[attr="value"]`,
                expected: String.raw`[attr="value"]`,
            },
            {
                actual: String.raw`div[attr=value]`,
                expected: String.raw`div[attr="value"]`,
            },
            {
                actual: String.raw`div[attr]`,
                expected: String.raw`div[attr]`,
            },
            {
                actual: String.raw`div[attr1="value1"][attr2=value2][attr3]`,
                expected: String.raw`div[attr1="value1"][attr2="value2"][attr3]`,
            },
            {
                actual: String.raw`div[attr1="1""2""3"][attr2="4""5""6"][attr3="7""8""9"]`,
                expected: String.raw`div[attr1="1""2""3"][attr2="4""5""6"][attr3="7""8""9"]`,
            },
            {
                actual: String.raw`my-div[attr-name="value"]`,
                expected: String.raw`my-div[attr-name="value"]`,
            },
            {
                actual: String.raw`my_div[attr_name="value"]`,
                expected: String.raw`my_div[attr_name="value"]`,
            },
            {
                actual: String.raw` div [ attr1 = " value1 " ] [ attr2 = value2 ] [ attr3 ] `,
                expected: String.raw`div[attr1=" value1 "][attr2="value2"][attr3]`,
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
            'div[attr="value"]',
            'div',
            '[attr="value"]',
            'div[attr=value]',
            'div[attr]',
            'div[attr1="value1"][attr2=value2][attr3]',
            'div[attr1="1""2""3"][attr2="4""5""6"][attr3="7""8""9"]',
            'my-div[attr-name="value"]',
            'my_div[attr_name="value"]',
            ' div [ attr1 = " value1 " ] [ attr2 = value2 ] [ attr3 ] ',
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
