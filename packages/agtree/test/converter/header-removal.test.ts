import { HeaderRemovalRuleConverter } from '../../src/converter/cosmetic/header-removal';
import { RuleConversionError } from '../../src/errors/rule-conversion-error';
import { RuleParser } from '../../src/parser/rule';

describe('HeaderRemovalRuleConverter', () => {
    describe('uBO to ADG', () => {
        // Valid rules
        test.each([
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
        ])("should convert '$actual' to '$expected'", ({ actual, expected }) => {
            expect(
                HeaderRemovalRuleConverter.convertToAdg(
                    RuleParser.parse(actual),
                ).map(RuleParser.generate),
            ).toEqual(expected);
        });

        // Invalid rules
        test.each([
            // Invalid rule type
            {
                actual: '##+js(foo)',
                expected: 'Not a response header rule',
            },
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
