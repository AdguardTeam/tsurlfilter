import { sprintf } from 'sprintf-js';
import { TokenType, getFormattedTokenName } from '@adguard/css-tokenizer';

import { ERROR_MESSAGES, HtmlRuleConverter } from '../../../src/converter/cosmetic/html';
import { type HtmlFilteringRule } from '../../../src/parser/common';
import { RuleParser } from '../../../src/parser/rule';

import '../../matchers/check-conversion';

describe('HtmlRuleConverter', () => {
    describe('convertToAdg', () => {
        // should throw an error if the rule is invalid
        test.each([
            {
                actual: 'example.com,~example.net##^script:has-text(aaa)div',
                expected: sprintf(
                    ERROR_MESSAGES.TAG_SHOULD_BE_FIRST_CHILD,
                    getFormattedTokenName(TokenType.Ident),
                    'div',
                ),
            },
            {
                actual: 'example.com,~example.net##^div + div',
                expected: sprintf(
                    ERROR_MESSAGES.UNEXPECTED_TOKEN_WITH_VALUE,
                    getFormattedTokenName(TokenType.Delim),
                    '+',
                ),
            },
            // we're only support quite few pseudo classes, and we should
            // discard any invalid ones
            {
                actual: 'example.com##^body > script:has-text(test)',
                expected: sprintf(
                    ERROR_MESSAGES.UNEXPECTED_TOKEN_WITH_VALUE,
                    getFormattedTokenName(TokenType.Delim),
                    '>',
                ),
            },
            {
                actual: 'example.com##^script:some-another-rule(test)',
                expected: 'Unsupported pseudo class \'some-another-rule\'',
            },
            {
                actual: 'example.com##^:aaa',
                expected: "Expected '<function-token>', but got '<ident-token>'",
            },
            // TODO: add some support for RegExp patterns later
            {
                actual: 'example.com##^script:has-text(/^aaa/)',
                expected: sprintf(
                    ERROR_MESSAGES.REGEXP_NOT_SUPPORTED,
                    '/^aaa/',
                    'has-text',
                ),
            },
            // syntax error in the base rule
            {
                actual: 'example.com##^[identifier-cannot-start-with-a-digit=2bad-identifier]',
                expected: sprintf(
                    ERROR_MESSAGES.INVALID_ATTRIBUTE_VALUE,
                    getFormattedTokenName(TokenType.Dimension),
                    '2bad-identifier',
                ),
            },
            // Only '=' operator is supported
            {
                actual: 'example.com##^[attr*="value"]',
                expected: "Expected '<delim-token>' with value '=', but got '*'",
            },
            // Flags are not supported
            {
                actual: 'example.com##^[attr="value"i]',
                expected: ERROR_MESSAGES.FLAGS_NOT_SUPPORTED,
            },
            {
                actual: 'example.com##^[attr="value" i]',
                expected: ERROR_MESSAGES.FLAGS_NOT_SUPPORTED,
            },
        ])('should throw \'$expected\' for \'$actual\'', ({ actual, expected }) => {
            expect(() => {
                HtmlRuleConverter.convertToAdg(RuleParser.parse(actual) as HtmlFilteringRule);
            }).toThrowError(expected);
        });

        test.each([
            // Please keep in mind that the converter is an AST → AST[] function,
            // so the result is always an array of ASTs

            // UBO → ADG, normal blocking rules
            {
                actual: 'example.com,~example.net##^div',
                expected: [
                    'example.com,~example.net$$div[max-length="262144"]',
                ],
                shouldConvert: true,
            },
            {
                actual: 'example.com,~example.net##^div[attr]',
                expected: [
                    'example.com,~example.net$$div[attr][max-length="262144"]',
                ],
                shouldConvert: true,
            },
            {
                actual: 'example.com,~example.net##^div[attr="val"]',
                expected: [
                    'example.com,~example.net$$div[attr="val"][max-length="262144"]',
                ],
                shouldConvert: true,
            },
            {
                actual: 'example.com,~example.net##^div[attr-1][attr-2="val"]',
                expected: [
                    'example.com,~example.net$$div[attr-1][attr-2="val"][max-length="262144"]',
                ],
                shouldConvert: true,
            },
            {
                actual: 'example.com,~example.net##^div[attr-1][attr-2="val"][attr-3]',
                expected: [
                    'example.com,~example.net$$div[attr-1][attr-2="val"][attr-3][max-length="262144"]',
                ],
                shouldConvert: true,
            },
            {
                actual: 'example.com,~example.net##^script:has-text(12313)',
                expected: [
                    'example.com,~example.net$$script[tag-content="12313"][max-length="262144"]',
                ],
                shouldConvert: true,
            },
            {
                actual: 'example.com,~example.net##^script:has-text(console.log("doubles"))',
                expected: [
                    'example.com,~example.net$$script[tag-content="console.log(""doubles"")"][max-length="262144"]',
                ],
                shouldConvert: true,
            },
            {
                actual: 'example.com,~example.net##^script[data-test]:has-text(12313)',
                expected: [
                    'example.com,~example.net$$script[data-test][tag-content="12313"][max-length="262144"]',
                ],
                shouldConvert: true,
            },
            {
                actual: 'example.com,~example.net##^script[data-test="1"][data-test2="2"]:has-text(12313)',
                expected: [
                    // eslint-disable-next-line max-len
                    'example.com,~example.net$$script[data-test="1"][data-test2="2"][tag-content="12313"][max-length="262144"]',
                ],
                shouldConvert: true,
            },
            {
                actual: "example.com,~example.net##^script:has-text(d.createElement('script'))",
                expected: [
                    'example.com,~example.net$$script[tag-content="d.createElement(\'script\')"][max-length="262144"]',
                ],
                shouldConvert: true,
            },
            {
                actual: "example.com,~example.net##^script:has-text(d.createElement('script')):min-text-length(1234)",
                expected: [
                    // eslint-disable-next-line max-len
                    'example.com,~example.net$$script[tag-content="d.createElement(\'script\')"][min-length="1234"][max-length="262144"]',
                ],
                shouldConvert: true,
            },

            // UBO → ADG, exception rules
            {
                actual: 'example.com,~example.net#@#^div',
                expected: [
                    'example.com,~example.net$@$div[max-length="262144"]',
                ],
                shouldConvert: true,
            },
            {
                actual: 'example.com,~example.net#@#^div[attr]',
                expected: [
                    'example.com,~example.net$@$div[attr][max-length="262144"]',
                ],
                shouldConvert: true,
            },
            {
                actual: 'example.com,~example.net#@#^div[attr="val"]',
                expected: [
                    'example.com,~example.net$@$div[attr="val"][max-length="262144"]',
                ],
                shouldConvert: true,
            },
            {
                actual: 'example.com,~example.net#@#^div[attr-1][attr-2="val"]',
                expected: [
                    'example.com,~example.net$@$div[attr-1][attr-2="val"][max-length="262144"]',
                ],
                shouldConvert: true,
            },
            {
                actual: 'example.com,~example.net#@#^div[attr-1][attr-2="val"][attr-3]',
                expected: [
                    'example.com,~example.net$@$div[attr-1][attr-2="val"][attr-3][max-length="262144"]',
                ],
                shouldConvert: true,
            },
            {
                actual: 'example.com,~example.net#@#^script:has-text(12313)',
                expected: [
                    'example.com,~example.net$@$script[tag-content="12313"][max-length="262144"]',
                ],
                shouldConvert: true,
            },
            {
                actual: 'example.com,~example.net#@#^script:has-text(console.log("doubles"))',
                expected: [
                    'example.com,~example.net$@$script[tag-content="console.log(""doubles"")"][max-length="262144"]',
                ],
                shouldConvert: true,
            },
            {
                actual: 'example.com,~example.net#@#^script[data-test]:has-text(12313)',
                expected: [
                    'example.com,~example.net$@$script[data-test][tag-content="12313"][max-length="262144"]',
                ],
                shouldConvert: true,
            },
            {
                actual: 'example.com,~example.net#@#^script[data-test="1"][data-test2="2"]:has-text(12313)',
                expected: [
                    // eslint-disable-next-line max-len
                    'example.com,~example.net$@$script[data-test="1"][data-test2="2"][tag-content="12313"][max-length="262144"]',
                ],
                shouldConvert: true,
            },
            {
                actual: "example.com,~example.net#@#^script:has-text(d.createElement('script'))",
                expected: [
                    'example.com,~example.net$@$script[tag-content="d.createElement(\'script\')"][max-length="262144"]',
                ],
                shouldConvert: true,
            },
            {
                actual: "example.com,~example.net#@#^script:has-text(d.createElement('script')):min-text-length(1234)",
                expected: [
                    // eslint-disable-next-line max-len
                    'example.com,~example.net$@$script[tag-content="d.createElement(\'script\')"][min-length="1234"][max-length="262144"]',
                ],
                shouldConvert: true,
            },

            // UBO → ADG, exception rules, with multiple selectors
            {
                actual: 'example.com,~example.net#@#^div[attr-1][attr-2="value-2"],script',
                // we should split the selector list into individual rules
                expected: [
                    'example.com,~example.net$@$div[attr-1][attr-2="value-2"][max-length="262144"]',
                    'example.com,~example.net$@$script[max-length="262144"]',
                ],
                shouldConvert: true,
            },

            // ADG → ADG
            {
                actual: 'example.com,~example.net$@$div[max-length="262144"]',
                expected: [
                    'example.com,~example.net$@$div[max-length="262144"]',
                ],
                shouldConvert: false,
            },
            {
                // eslint-disable-next-line max-len
                actual: 'example.com,~example.net$@$script[tag-content="console.log(""doubles"")"][max-length="262144"]',
                expected: [
                    'example.com,~example.net$@$script[tag-content="console.log(""doubles"")"][max-length="262144"]',
                ],
                shouldConvert: false,
            },
            {
                // eslint-disable-next-line max-len
                actual: 'example.com,~example.net$@$script[tag-content="d.createElement(\'script\')"][min-length="1234"][max-length="262144"]',
                expected: [
                    // eslint-disable-next-line max-len
                    'example.com,~example.net$@$script[tag-content="d.createElement(\'script\')"][min-length="1234"][max-length="262144"]',
                ],
                shouldConvert: false,
            },
        ])('should convert \'$actual\' to \'$expected\'', (testData) => {
            expect(testData).toBeConvertedProperly(HtmlRuleConverter, 'convertToAdg');
        });
    });

    describe('convertToUbo', () => {
        // TODO: We should implement this later
        expect(() => HtmlRuleConverter.convertToUbo(
            RuleParser.parse('$$script') as HtmlFilteringRule,
        )).toThrowError(
            'Not implemented',
        );
    });

    describe('convertToAbp', () => {
        // Adblock Plus currently doesn't support HTML filtering rules
        expect(() => HtmlRuleConverter.convertToAbp(
            RuleParser.parse('$$script') as HtmlFilteringRule,
        )).toThrowError(
            'Not implemented',
        );
    });
});
