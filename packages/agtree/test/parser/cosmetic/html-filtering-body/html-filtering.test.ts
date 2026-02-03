import {
    describe,
    expect,
    test,
    vi,
} from 'vitest';

import { NodeExpectContext, type NodeExpectFn } from '../../../helpers/node-utils';
import { AdblockSyntaxError, type Value, type HtmlFilteringRuleBody } from '../../../../src';
import {
    HtmlFilteringBodyParser,
} from '../../../../src/parser/cosmetic/html-filtering-body/html-filtering-body-parser';
import {
    HtmlFilteringBodyGenerator,
} from '../../../../src/generator/cosmetic/html-filtering-body/html-filtering-body-generator';
import { SelectorListParser } from '../../../../src/parser/cosmetic/selector/selector-list-parser';
import { defaultParserOptions, type ParserOptions } from '../../../../src/parser/options';

/**
 * Default parser options with HTML filtering rules parsing enabled.
 */
const parsingEnabledDefaultParserOptions: ParserOptions = {
    ...defaultParserOptions,
    parseHtmlFilteringRuleBodies: true,
};

/**
 * Please note that most of the test cases are covered in `css-selector-list.test.ts` file,
 * this file is mainly for ensuring that parser/generator/serializer/deserializer are wired up correctly.
 */
describe('HtmlFilteringBodyParser', () => {
    describe('HtmlFilteringBodyParser.parse - valid cases (parsed)', () => {
        test.each<{ actual: string; expected: NodeExpectFn<HtmlFilteringRuleBody> }>([
            {
                actual: 'div',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    selectorList: SelectorListParser.parse('div'),
                    ...context.getFullRange(),
                }),
            },
            {
                actual: 'div#id.class[attr~="value" i]:pseudo(arg)',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    selectorList: SelectorListParser.parse('div#id.class[attr~="value" i]:pseudo(arg)'),
                    ...context.getFullRange(),
                }),
            },
            {
                actual: 'div > span + a ~ h1',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    selectorList: SelectorListParser.parse('div > span + a ~ h1'),
                    ...context.getFullRange(),
                }),
            },
            {
                actual: 'div > span, .class + #id',
                expected: (context) => ({
                    type: 'HtmlFilteringRuleBody',
                    selectorList: SelectorListParser.parse('div > span, .class + #id'),
                    ...context.getFullRange(),
                }),
            },
        ])("should parse '$actual'", ({ actual, expected: expectedFn }) => {
            expect(HtmlFilteringBodyParser.parse(actual, parsingEnabledDefaultParserOptions)).toEqual(
                expectedFn(new NodeExpectContext(actual)),
            );
        });
    });

    describe('HtmlFilteringBodyParser.parse - invalid cases (parsed)', () => {
        test.each<{ actual: string; expected: NodeExpectFn<AdblockSyntaxError> }>([
            {
                actual: 'div[attr="value"]span',
                expected: (context) => (new AdblockSyntaxError(
                    'Type selector is already set for the compound selector',
                    ...context.toTuple(context.getRangeFor('span')),
                )),
            },
            {
                actual: '[attr="value"',
                expected: (context) => (new AdblockSyntaxError(
                    "Expected '<]-token>', but got 'end of input'",
                    context.getFullRange().end - 1,
                    context.getFullRange().end,
                )),
            },
            {
                actual: ':pseudo(arg',
                expected: (context) => (new AdblockSyntaxError(
                    "Expected '<)-token>', but got 'end of input'",
                    context.getFullRange().end - 1,
                    context.getFullRange().end,
                )),
            },
            {
                actual: 'div > + span',
                expected: (context) => (new AdblockSyntaxError(
                    "Unexpected token '<delim-token>' with value '+'",
                    ...context.toTuple(context.getRangeFor('+')),
                )),
            },
        ])("should throw on input: '$actual'", ({ actual, expected: expectedFn }) => {
            const fn = vi.fn(() => HtmlFilteringBodyParser.parse(actual, parsingEnabledDefaultParserOptions));

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

    describe('HtmlFilteringBodyGenerator.generate (parsed)', () => {
        test.each<{ actual: string; expected: string }>([
            {
                actual: 'div',
                expected: 'div',
            },
            {
                actual: 'div#id.class[attr~="value" i]:pseudo(arg)',
                expected: 'div#id.class[attr~="value" i]:pseudo(arg)',
            },
            {
                actual: 'div > span + a ~ h1',
                expected: 'div > span + a ~ h1',
            },
            {
                actual: 'div > span, .class + #id',
                expected: 'div > span, .class + #id',
            },
        ])("should generate '$expected' from '$actual'", ({ actual, expected }) => {
            const ruleNode = HtmlFilteringBodyParser.parse(actual, parsingEnabledDefaultParserOptions);

            if (ruleNode === null) {
                throw new Error(`Failed to parse '${actual}' as cosmetic rule`);
            }

            expect(HtmlFilteringBodyGenerator.generate(ruleNode)).toBe(expected);
        });
    });

    /**
     * Please not that if parsing is disabled, the parser will pass body value as-is,
     * so these test cases are mainly to ensure that the parser/generator/serializer/deserializer
     * are wired up correctly. And since no parsing is done, the expected values are the same as the actual ones.
     * And there is no need to test invalid cases here, as with parsing disabled,
     * the parser will not be able to detect any invalid syntax.
     */
    describe('HtmlFilteringBodyParser.parse - valid cases (raw)', () => {
        test.each<{ actual: string; expected: NodeExpectFn<Value> }>([
            {
                actual: 'div',
                expected: (context) => ({
                    type: 'Value',
                    value: 'div',
                    ...context.getFullRange(),
                }),
            },
            {
                actual: 'div#id.class[attr~="value" i]:pseudo(arg)',
                expected: (context) => ({
                    type: 'Value',
                    value: 'div#id.class[attr~="value" i]:pseudo(arg)',
                    ...context.getFullRange(),
                }),
            },
            {
                actual: 'div > span + a ~ h1',
                expected: (context) => ({
                    type: 'Value',
                    value: 'div > span + a ~ h1',
                    ...context.getFullRange(),
                }),
            },
            {
                actual: 'div > span, .class + #id',
                expected: (context) => ({
                    type: 'Value',
                    value: 'div > span, .class + #id',
                    ...context.getFullRange(),
                }),
            },
        ])("should parse '$actual'", ({ actual, expected: expectedFn }) => {
            expect(HtmlFilteringBodyParser.parse(actual)).toMatchObject(
                expectedFn(new NodeExpectContext(actual)),
            );
        });
    });

    describe('HtmlFilteringBodyGenerator.generate (raw)', () => {
        test.each<{ actual: string; expected: string }>([
            {
                actual: 'div',
                expected: 'div',
            },
            {
                actual: 'div#id.class[attr~="value" i]:pseudo(arg)',
                expected: 'div#id.class[attr~="value" i]:pseudo(arg)',
            },
            {
                actual: 'div > span + a ~ h1',
                expected: 'div > span + a ~ h1',
            },
            {
                actual: 'div > span, .class + #id',
                expected: 'div > span, .class + #id',
            },
        ])("should generate '$expected' from '$actual'", ({ actual, expected }) => {
            const ruleNode = HtmlFilteringBodyParser.parse(actual);

            if (ruleNode === null) {
                throw new Error(`Failed to parse '${actual}' as cosmetic rule`);
            }

            expect(HtmlFilteringBodyGenerator.generate(ruleNode)).toBe(expected);
        });
    });
});
