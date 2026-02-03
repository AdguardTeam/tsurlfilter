import {
    describe,
    expect,
    test,
    vi,
} from 'vitest';

import { NodeExpectContext, type NodeExpectFn } from '../../../helpers/node-utils';
import { AdblockSyntaxError, type Value, type HtmlFilteringRuleBody } from '../../../../src';
import {
    UboHtmlFilteringBodyParser,
} from '../../../../src/parser/cosmetic/html-filtering-body/ubo-html-filtering-body-parser';
import {
    UboHtmlFilteringBodyGenerator,
} from '../../../../src/generator/cosmetic/html-filtering-body/ubo-html-filtering-body-generator';
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
 * this file is mainly for testing UBO specific cases and ensuring
 * the UBO parser/generator/serializer/deserializer are wired up correctly.
 */
describe('UboHtmlFilteringBodyParser', () => {
    describe('UboHtmlFilteringBodyParser.parse - valid cases (parsed)', () => {
        test.each<{ actual: string; expected: NodeExpectFn<HtmlFilteringRuleBody> }>([
            // responseheader removal rule
            {
                actual: 'responseheader(Test)',
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
                                    value: 'responseheader',
                                    ...context.getRangeFor('responseheader'),
                                },
                                argument: {
                                    type: 'Value',
                                    value: 'Test',
                                    ...context.getRangeFor('Test'),
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

            // responseheader removal rule - with extra spaces
            {
                actual: '  responseheader(  Test  )  ',
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
                                    value: 'responseheader',
                                    ...context.getRangeFor('responseheader'),
                                },
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
                    },
                    ...context.getFullRange(),
                }),
            },
        ])("should parse '$actual'", ({ actual, expected: expectedFn }) => {
            expect(UboHtmlFilteringBodyParser.parse(actual, parsingEnabledDefaultParserOptions)).toEqual(
                expectedFn(new NodeExpectContext(actual)),
            );
        });
    });

    describe('UboHtmlFilteringBodyParser.parse - invalid cases (parsed)', () => {
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

    describe('UboHtmlFilteringBodyGenerator.generate (parsed)', () => {
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

    /**
     * Please not that if parsing is disabled, the parser will pass body value as-is,
     * so these test cases are mainly to ensure that the uBO parser/generator/serializer/deserializer
     * are wired up correctly. And since no parsing is done, the expected values are the same as the actual ones.
     * And there is no need to test invalid cases here, as with parsing disabled,
     * the parser will not be able to detect any invalid syntax.
     */
    describe('UboHtmlFilteringBodyParser.parse - valid cases (raw)', () => {
        test.each<{ actual: string; expected: NodeExpectFn<Value> }>([
            // responseheader removal rule
            {
                actual: 'responseheader(Test)',
                expected: (context) => ({
                    type: 'Value',
                    value: 'responseheader(Test)',
                    ...context.getFullRange(),
                }),
            },

            // responseheader removal rule - with extra spaces
            {
                actual: '  responseheader(  Test  )  ',
                expected: (context) => ({
                    type: 'Value',
                    value: '  responseheader(  Test  )  ',
                    ...context.getFullRange(),
                }),
            },
        ])("should parse '$actual'", ({ actual, expected: expectedFn }) => {
            expect(UboHtmlFilteringBodyParser.parse(actual)).toEqual(
                expectedFn(new NodeExpectContext(actual)),
            );
        });
    });

    describe('UboHtmlFilteringBodyGenerator.generate (raw)', () => {
        test.each<{ actual: string; expected: string }>([
            {
                actual: 'responseheader(Test)',
                expected: 'responseheader(Test)',
            },
            {
                actual: '  responseheader(  Test  )  ',
                expected: '  responseheader(  Test  )  ',
            },
        ])("should generate '$expected' from '$actual'", ({ actual, expected }) => {
            const ruleNode = UboHtmlFilteringBodyParser.parse(actual);

            if (ruleNode === null) {
                throw new Error(`Failed to parse '${actual}' as cosmetic rule`);
            }

            expect(UboHtmlFilteringBodyGenerator.generate(ruleNode)).toBe(expected);
        });
    });
});
