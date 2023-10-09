import { RawRuleConverter } from '../../src/converter/raw-rule';

describe('Raw rule converter wrapper should work correctly', () => {
    describe('should convert rules to ADG', () => {
        // Test some rules, no need to test all possible rule types here, since we already tested them in elsewhere.
        // In this test we just check that the wrapper works correctly.
        test.each([
            // leave as is
            {
                actual: '||example.com^$third-party',
                expected: [
                    '||example.com^$third-party',
                ],
                shouldConvert: false,
            },
            // simple conversion
            {
                actual: '||example.com^$3p',
                expected: [
                    '||example.com^$third-party',
                ],
            },
            {
                actual: 'example.com##^script:has-text(foo)',
                expected: [
                    'example.com$$script[tag-content="foo"][max-length="262144"]',
                ],
            },
            // multiple rules in the result
            {
                actual: 'example.com#$#abp-snippet1 arg0 arg1; abp-snippet2 arg0 arg1',
                expected: [
                    "example.com#%#//scriptlet('abp-snippet1', 'arg0', 'arg1')",
                    "example.com#%#//scriptlet('abp-snippet2', 'arg0', 'arg1')",
                ],
            },
        ])('should convert \'$actual\' to \'$expected\'', ({ actual, expected, shouldConvert = true }) => {
            const converterFn = () => RawRuleConverter.convertToAdg(actual);

            expect(converterFn).not.toThrow();

            const conversionResult = converterFn();

            expect(conversionResult.isConverted).toBe(shouldConvert);
            expect(conversionResult.result).toEqual(expected);
        });
    });
});
