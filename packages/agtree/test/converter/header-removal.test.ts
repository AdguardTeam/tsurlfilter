import { HeaderRemovalRuleConverter } from '../../src/converter/cosmetic/header-removal';
import { RuleConversionError } from '../../src/errors/rule-conversion-error';
import { RuleParser } from '../../src/parser/rule';
import '../matchers/check-conversion';

describe('HeaderRemovalRuleConverter', () => {
    describe('uBO to ADG', () => {
        // Valid rules
        test.each([
            // Leave non-header removal rules as is
            {
                actual: '##+js(foo)',
                expected: [
                    '##+js(foo)',
                ],
                shouldConvert: false,
            },

            // No domain
            {
                actual: '##^responseheader(header-name)',
                expected: [
                    '$removeheader=header-name',
                ],
            },
            {
                actual: '#@#^responseheader(header-name)',
                expected: [
                    '@@$removeheader=header-name',
                ],
            },

            // Single domain
            {
                actual: 'example.com##^responseheader(header-name)',
                expected: [
                    '||example.com^$removeheader=header-name',
                ],
            },
            {
                actual: 'example.com#@#^responseheader(header-name)',
                expected: [
                    '@@||example.com^$removeheader=header-name',
                ],
            },
        ])('should convert \'$actual\' to \'$expected\'', (testData) => {
            expect(testData).toBeConvertedProperly(HeaderRemovalRuleConverter, 'convertToAdg');
        });

        // Invalid rules
        test.each([
            // TODO: Add support for multiple domains
            // Currently, we don't support multiple domains
            {
                actual: 'example.com,example.net,example.org##^responseheader(header-name)',
                expected: 'Multiple domains are not supported yet',
            },
            {
                actual: 'example.com,example.net,example.org#@#^responseheader(header-name)',
                expected: 'Multiple domains are not supported yet',
            },
        ])("should throw '$expected' error when converting '$actual'", ({ actual, expected }) => {
            expect(() => {
                HeaderRemovalRuleConverter.convertToAdg(
                    RuleParser.parse(actual),
                );
            }).toThrowError(new RuleConversionError(expected));
        });
    });
});
