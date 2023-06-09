import { HtmlRuleConverter } from '../../src/converter/html';
import { RuleParser } from '../../src/parser/rule';

describe('HtmlRuleConverter', () => {
    describe('convertToAdg', () => {
        test.each([
            // [bad rule to convert, expected error message]
            [
                'example.com,~example.net##^script:has-text(aaa)div',
                'Tag selector should be the first child, if present',
            ],
            [
                'example.com,~example.net##^div + div',
                'Unsupported node type \'Combinator\'',
            ],
            [
                'example.com##^body > script:has-text(test)',
                'Unsupported node type \'Combinator\'',
            ],
            [
                'example.com##^script:some-another-rule(test)',
                'Unsupported pseudo class \'some-another-rule\'',
            ],
            [
                'example.com##^:aaa',
                'Pseudo class \'aaa\' has no argument',
            ],
            // TODO: add some support for RegExp patterns later
            [
                'example.com##^script:has-text(/^aaa/)',
                'Conversion of RegExp patterns is not yet supported',
            ],
            // Invalid CSS selector
            [
                'example.com##^[identifier-cannot-start-with-a-digit=2bad-identifier]',
                'ECSSTree parsing error: \'Identifier is expected\'',
            ],
        ])('should throw an error for unsupported rule: %s', (rule, error) => {
            expect(() => {
                HtmlRuleConverter.convertToAdg(rule);
            }).toThrowError(error);
        });

        test.each([
            // [rule to convert, [expected conversion result]]
            // Please keep in mind that the converter is an AST -> AST[] function,
            // so the result is always an array of ASTs

            // UBO -> ADG
            [
                'example.com,~example.net##^div',
                ['example.com,~example.net$$div[max-length="262144"]'],
            ],
            [
                'example.com,~example.net##^div[attr]',
                ['example.com,~example.net$$div[attr][max-length="262144"]'],
            ],
            [
                'example.com,~example.net##^div[attr="val"]',
                ['example.com,~example.net$$div[attr="val"][max-length="262144"]'],
            ],
            [
                'example.com,~example.net##^div[attr-1][attr-2="val"]',
                [
                    'example.com,~example.net$$div[attr-1][attr-2="val"][max-length="262144"]',
                ],
            ],
            [
                'example.com,~example.net##^div[attr-1][attr-2="val"][attr-3]',
                [
                    'example.com,~example.net$$div[attr-1][attr-2="val"][attr-3][max-length="262144"]',
                ],
            ],
            [
                'example.com,~example.net##^script:has-text(12313)',
                [
                    'example.com,~example.net$$script[tag-content="12313"][max-length="262144"]',
                ],
            ],
            [
                'example.com,~example.net##^script:has-text(console.log("doubles"))',
                [
                    'example.com,~example.net$$script[tag-content="console.log(""doubles"")"][max-length="262144"]',
                ],
            ],
            [
                'example.com,~example.net##^script[data-test]:has-text(12313)',
                [
                    'example.com,~example.net$$script[data-test][tag-content="12313"][max-length="262144"]',
                ],
            ],
            [
                'example.com,~example.net##^script[data-test="1"][data-test2="2"]:has-text(12313)',
                [
                    // eslint-disable-next-line max-len
                    'example.com,~example.net$$script[data-test="1"][data-test2="2"][tag-content="12313"][max-length="262144"]',
                ],
            ],
            [
                "example.com,~example.net##^script:has-text(d.createElement('script'))",
                [
                    'example.com,~example.net$$script[tag-content="d.createElement(\'script\')"][max-length="262144"]',
                ],
            ],
            [
                "example.com,~example.net##^script:has-text(d.createElement('script')):min-text-length(1234)",
                [
                    // eslint-disable-next-line max-len
                    'example.com,~example.net$$script[tag-content="d.createElement(\'script\')"][min-length="1234"][max-length="262144"]',
                ],
            ],

            // UBO -> ADG, exception rules
            [
                'example.com,~example.net#@#^div',
                ['example.com,~example.net$@$div[max-length="262144"]'],
            ],
            [
                'example.com,~example.net#@#^div[attr]',
                ['example.com,~example.net$@$div[attr][max-length="262144"]'],
            ],
            [
                'example.com,~example.net#@#^div[attr="val"]',
                ['example.com,~example.net$@$div[attr="val"][max-length="262144"]'],
            ],
            [
                'example.com,~example.net#@#^div[attr-1][attr-2="val"]',
                [
                    'example.com,~example.net$@$div[attr-1][attr-2="val"][max-length="262144"]',
                ],
            ],
            [
                'example.com,~example.net#@#^div[attr-1][attr-2="val"][attr-3]',
                [
                    'example.com,~example.net$@$div[attr-1][attr-2="val"][attr-3][max-length="262144"]',
                ],
            ],
            [
                'example.com,~example.net#@#^script:has-text(12313)',
                [
                    'example.com,~example.net$@$script[tag-content="12313"][max-length="262144"]',
                ],
            ],
            [
                'example.com,~example.net#@#^script:has-text(console.log("doubles"))',
                [
                    'example.com,~example.net$@$script[tag-content="console.log(""doubles"")"][max-length="262144"]',
                ],
            ],
            [
                'example.com,~example.net#@#^script[data-test]:has-text(12313)',
                [
                    'example.com,~example.net$@$script[data-test][tag-content="12313"][max-length="262144"]',
                ],
            ],
            [
                'example.com,~example.net#@#^script[data-test="1"][data-test2="2"]:has-text(12313)',
                [
                    // eslint-disable-next-line max-len
                    'example.com,~example.net$@$script[data-test="1"][data-test2="2"][tag-content="12313"][max-length="262144"]',
                ],
            ],
            [
                "example.com,~example.net#@#^script:has-text(d.createElement('script'))",
                [
                    'example.com,~example.net$@$script[tag-content="d.createElement(\'script\')"][max-length="262144"]',
                ],
            ],
            [
                "example.com,~example.net#@#^script:has-text(d.createElement('script')):min-text-length(1234)",
                [
                    // eslint-disable-next-line max-len
                    'example.com,~example.net$@$script[tag-content="d.createElement(\'script\')"][min-length="1234"][max-length="262144"]',
                ],
            ],

            // UBO -> ADG, exception rules, multiple
            [
                'example.com,~example.net#@#^div[attr-1][attr-2="value-2"],script',
                [
                    'example.com,~example.net$@$div[attr-1][attr-2="value-2"][max-length="262144"]',
                    'example.com,~example.net$@$script[max-length="262144"]',
                ],
            ],

            // ADG -> ADG
            [
                'example.com,~example.net$@$div[max-length="262144"]',
                [
                    'example.com,~example.net$@$div[max-length="262144"]',
                ],
            ],
            [
                'example.com,~example.net$@$script[tag-content="console.log(""doubles"")"][max-length="262144"]',
                [
                    'example.com,~example.net$@$script[tag-content="console.log(""doubles"")"][max-length="262144"]',
                ],
            ],
            [
                // eslint-disable-next-line max-len
                'example.com,~example.net$@$script[tag-content="d.createElement(\'script\')"][min-length="1234"][max-length="262144"]',
                [
                    // eslint-disable-next-line max-len
                    'example.com,~example.net$@$script[tag-content="d.createElement(\'script\')"][min-length="1234"][max-length="262144"]',
                ],
            ],
        ])('should convert %s', (raw, expected) => {
            const conversionResult = HtmlRuleConverter.convertToAdg(raw);
            expect(conversionResult).toHaveLength(expected.length);

            for (let i = 0; i < conversionResult.length; i += 1) {
                expect(
                    // Serialize rules just to make them easier to compare
                    RuleParser.generate(conversionResult[i]),
                ).toBe(expected[i]);
            }
        });
    });

    describe('convertToAbp', () => {
        // Adblock Plus currently doesn't support HTML filtering rules
        expect(() => HtmlRuleConverter.convertToAbp('anything')).toThrowError(
            'Not implemented',
        );
    });

    describe('convertToUbo', () => {
        // TODO: We should implement this later
        expect(() => HtmlRuleConverter.convertToUbo('anything')).toThrowError(
            'Not implemented',
        );
    });
});
