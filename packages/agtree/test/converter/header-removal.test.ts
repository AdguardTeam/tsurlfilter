import { describe, expect, test } from 'vitest';

import { RuleConverter } from '../../src/converter';
import { HeaderRemovalRuleConverter } from '../../src/converter/cosmetic/header-removal';
import { RuleConversionError } from '../../src/errors/rule-conversion-error';
import { RuleParser } from '../../src/parser/rule-parser';

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

            // Unparseable body - not a responseheader(...) rule, kept as-is
            // so that the main HTML filtering rule converter can handle it
            {
                actual: '$$script:contains((function(g,b,a,c,e,d))',
                expected: [
                    '$$script:contains((function(g,b,a,c,e,d))',
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

    describe('full conversion path (RuleConverter.convertToAdg)', () => {
        test.each([
            // Unparseable HTML filtering rule with special selectors is normalized
            // to a quoted argument by the main HTML filtering rule converter
            {
                actual: '$$script:contains(eval(function(p,a,c,k,e,d))',
                expected: [
                    '$$script:contains("eval(function(p,a,c,k,e,d)")',
                ],
            },

            // Unparseable HTML filtering rule without special selectors is rejected
            {
                actual: 'example.com$$div[class="hotword-container"]com^',
                error: 'Type selector is already set for the compound selector',
            },
        ])("'$actual'", (testData) => {
            if ('error' in testData) {
                expect(() => {
                    RuleConverter.convertToAdg(RuleParser.parse(testData.actual));
                }).toThrowError(testData.error);
            } else {
                expect(testData).toBeConvertedProperly(RuleConverter, 'convertToAdg');
            }
        });
    });
});
