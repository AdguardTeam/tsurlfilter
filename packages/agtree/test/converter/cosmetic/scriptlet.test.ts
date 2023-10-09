import { RuleParser } from '../../../src/parser/rule';
import { ScriptletRuleConverter } from '../../../src/converter/cosmetic/scriptlet';
import { type ScriptletInjectionRule } from '../../../src/parser/common';
import '../../matchers/check-conversion';

describe('Scriptlet conversion', () => {
    describe('ABP to ADG', () => {
        test.each([
            // single scriptlet
            {
                actual: '#$#abort-current-inline-script',
                expected: [
                    '#%#//scriptlet(\'abp-abort-current-inline-script\')',
                ],
                shouldConvert: true,
            },
            // exception status should be kept
            {
                actual: '#@$#abort-current-inline-script',
                expected: [
                    '#@%#//scriptlet(\'abp-abort-current-inline-script\')',
                ],
                shouldConvert: true,
            },
            // don't add prefix again if it's already there
            {
                actual: '#$#abp-abort-current-inline-script',
                expected: [
                    '#%#//scriptlet(\'abp-abort-current-inline-script\')',
                ],
                shouldConvert: true,
            },
            // single scriptlet with parameters
            {
                actual: '#$#override-property-read testProp false',
                expected: [
                    '#%#//scriptlet(\'abp-override-property-read\', \'testProp\', \'false\')',
                ],
                shouldConvert: true,
            },
            // redundant semicolon at the end of the rule
            {
                actual: '#$#override-property-read testProp false;',
                expected: [
                    '#%#//scriptlet(\'abp-override-property-read\', \'testProp\', \'false\')',
                ],
                shouldConvert: true,
            },
            // multiple scriptlets (ABP supports this, but ADG and uBO doesn't)
            {
                actual: '#$#log; abort-current-inline-script; override-property-read testProp false',
                expected: [
                    '#%#//scriptlet(\'abp-log\')',
                    '#%#//scriptlet(\'abp-abort-current-inline-script\')',
                    '#%#//scriptlet(\'abp-override-property-read\', \'testProp\', \'false\')',
                ],
                shouldConvert: true,
            },
        ])('should convert \'$actual\' to \'$expected\'', (testData) => {
            expect(testData).toBeConvertedProperly(ScriptletRuleConverter, 'convertToAdg');
        });
    });

    describe('uBO to ADG', () => {
        test.each([
            {
                actual: 'example.org##+js(aopr, foo)',
                expected: [
                    'example.org#%#//scriptlet(\'ubo-aopr\', \'foo\')',
                ],
                shouldConvert: true,
            },
            // exception status should be kept
            {
                actual: 'example.org#@#+js(aopr, foo)',
                expected: [
                    'example.org#@%#//scriptlet(\'ubo-aopr\', \'foo\')',
                ],
                shouldConvert: true,
            },
            // don't add prefix again if it's already there
            {
                actual: 'example.org##+js(ubo-aopr, foo)',
                expected: [
                    'example.org#%#//scriptlet(\'ubo-aopr\', \'foo\')',
                ],
                shouldConvert: true,
            },
            {
                actual: 'example.org##+js(abort-current-inline-script, $, popup)',
                expected: [
                    'example.org#%#//scriptlet(\'ubo-abort-current-inline-script\', \'$\', \'popup\')',
                ],
                shouldConvert: true,
            },
        ])('should convert \'$actual\' to \'$expected\'', (testData) => {
            expect(testData).toBeConvertedProperly(ScriptletRuleConverter, 'convertToAdg');
        });
    });

    // leave ADG rules as is
    describe('ADG to ADG', () => {
        test.each([
            {
                actual: 'example.org#%#//scriptlet(\'abort-on-property-read\', \'foo\')',
                expected: [
                    'example.org#%#//scriptlet(\'abort-on-property-read\', \'foo\')',
                ],
                shouldConvert: false,
            },
            // leave quotes as is
            {
                actual: 'example.org#%#//scriptlet("abort-on-property-read", "foo")',
                expected: [
                    'example.org#%#//scriptlet("abort-on-property-read", "foo")',
                ],
                shouldConvert: false,
            },
            {
                actual: 'example.org#%#//scriptlet(\'abort-current-inline-script\', \'$\', \'popup\')',
                expected: [
                    'example.org#%#//scriptlet(\'abort-current-inline-script\', \'$\', \'popup\')',
                ],
                shouldConvert: false,
            },
        ])('should convert \'$actual\' to \'$expected\'', (testData) => {
            expect(testData).toBeConvertedProperly(ScriptletRuleConverter, 'convertToAdg');
        });
    });

    describe('convertToUbo', () => {
        // TODO: We should implement this later
        expect(() => ScriptletRuleConverter.convertToUbo(
            RuleParser.parse('#%#//scriptlet(\'test\')') as ScriptletInjectionRule,
        )).toThrowError(
            'Not implemented',
        );
    });

    describe('convertToAbp', () => {
        // TODO: We should implement this later
        expect(() => ScriptletRuleConverter.convertToAbp(
            RuleParser.parse('#%#//scriptlet(\'test\')') as ScriptletInjectionRule,
        )).toThrowError(
            'Not implemented',
        );
    });
});
