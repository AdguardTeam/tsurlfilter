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
import { defaultParserOptions, type ParserOptions } from '../../../../src/parser/options';

/**
 * Default parser options with HTML filtering rules parsing enabled.
 */
const parsingEnabledDefaultParserOptions: ParserOptions = {
    ...defaultParserOptions,
    parseHtmlFilteringRules: true,
};

/**
 * Please note that most of the test cases are covered in `html-filtering.test.ts` file,
 * this file is mainly for testing UBO specific cases and ensuring
 * the UBO parser/generator/serializer/deserializer are wired up correctly.
 */
describe('UboHtmlFilteringBodyParser', () => {
    describe('UboHtmlFilteringBodyParser.parse - valid cases', () => {
        test.each<{ actual: string; expected: NodeExpectFn<HtmlFilteringRuleBody> }>([
            // responseheader removal rule
            {
                actual: 'responseheader(Test)',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBodyParsed',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [{
                            type: 'HtmlFilteringRuleSelector',
                            children: [{
                                type: 'HtmlFilteringRuleSelectorPseudoClass',
                                name: {
                                    type: 'Value',
                                    value: 'responseheader',
                                    ...context.getRangeFor('responseheader'),
                                },
                                isFunction: true,
                                argument: {
                                    type: 'Value',
                                    value: 'Test',
                                    ...context.getRangeFor('Test'),
                                },
                                ...context.getRangeFor('responseheader(Test)'),
                            }],
                            ...context.getRangeFor('responseheader(Test)'),
                        }],
                        ...context.getRangeFor('responseheader(Test)'),
                    }],
                    ...context.getFullRange(),
                }),
            },

            // responseheader removal rule - with extra spaces
            {
                actual: '  responseheader(  Test  )  ',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBodyParsed',
                    children: [{
                        type: 'HtmlFilteringRuleSelectorList',
                        children: [{
                            type: 'HtmlFilteringRuleSelector',
                            children: [{
                                type: 'HtmlFilteringRuleSelectorPseudoClass',
                                name: {
                                    type: 'Value',
                                    value: 'responseheader',
                                    ...context.getRangeFor('responseheader'),
                                },
                                isFunction: true,
                                argument: {
                                    type: 'Value',
                                    value: 'Test',
                                    ...context.getRangeFor('Test'),
                                },
                                ...context.getRangeFor('responseheader(  Test  )'),
                            }],
                            ...context.getRangeFor('responseheader(  Test  )'),
                        }],
                        ...context.getRangeFor('responseheader(  Test  )'),
                    }],
                    ...context.getFullRange(),
                }),
            },
        ])("should parse '$actual'", ({ actual, expected: expectedFn }) => {
            expect(UboHtmlFilteringBodyParser.parse(actual, parsingEnabledDefaultParserOptions)).toMatchObject(
                expectedFn(new NodeExpectContext(actual)),
            );
        });
    });

    describe('UboHtmlFilteringBodyParser.parse - invalid cases', () => {
        test.each<{ actual: string; expected: NodeExpectFn<AdblockSyntaxError> }>([
            // missing argument and closing parenthesis
            {
                actual: 'responseheader(',
                expected: (context) => new AdblockSyntaxError(
                    "Expected '<)-token>', but got 'end of input'",
                    context.getFullRange().end - 1,
                    context.getFullRange().end,
                ),
            },

            // missing closing parenthesis
            {
                actual: 'responseheader(Test',
                expected: (context) => new AdblockSyntaxError(
                    "Expected '<)-token>', but got 'end of input'",
                    context.getFullRange().end - 1,
                    context.getFullRange().end,
                ),
            },

            // missing argument
            {
                actual: 'responseheader()',
                expected: (context) => new AdblockSyntaxError(
                    "Empty parameter for 'responseheader' function",
                    context.getFullRange().end - 1,
                    context.getFullRange().end - 1,
                ),
            },

            // unexpected token after closing parenthesis
            {
                actual: 'responseheader(Test) unexpected',
                expected: (context) => new AdblockSyntaxError(
                    "Expected end of rule, but got '<ident-token>'",
                    ...context.toTuple(context.getRangeFor('unexpected')),
                ),
            },
        ])("should throw on input: '$actual'", ({ actual, expected: expectedFn }) => {
            const fn = vi.fn(() => UboHtmlFilteringBodyParser.parse(actual, parsingEnabledDefaultParserOptions));

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
                actual: 'responseheader(Test)',
                expected: 'responseheader(Test)',
            },
            {
                actual: '  responseheader(  Test  )  ',
                expected: 'responseheader(Test)',
            },
        ])("should generate '$expected' from '$actual'", ({ actual, expected }) => {
            const ruleNode = UboHtmlFilteringBodyParser.parse(actual, parsingEnabledDefaultParserOptions);

            if (ruleNode === null) {
                throw new Error(`Failed to parse '${actual}' as cosmetic rule`);
            }

            expect(UboHtmlFilteringBodyGenerator.generate(ruleNode)).toBe(expected);
        });
    });

    describe('serialize & deserialize', () => {
        test.each([
            'responseheader(Test)',
            '  responseheader(  Test  )  ',
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

// FIXME: Add tests for raw body here
