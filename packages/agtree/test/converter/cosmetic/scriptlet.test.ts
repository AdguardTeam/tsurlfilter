import { RuleParser } from '../../../src/parser/rule';
import { ScriptletRuleConverter } from '../../../src/converter/cosmetic/scriptlet';
import { type ScriptletInjectionRule } from '../../../src/parser/common';

describe('Scriptlet conversion', () => {
    describe('ABP to ADG', () => {
        test.each([
            // single scriptlet
            {
                actual: '#$#abort-current-inline-script',
                expected: [
                    '#%#//scriptlet(\'abp-abort-current-inline-script\')',
                ],
            },
            // exception status should be kept
            {
                actual: '#@$#abort-current-inline-script',
                expected: [
                    '#@%#//scriptlet(\'abp-abort-current-inline-script\')',
                ],
            },
            // don't add prefix again if it's already there
            {
                actual: '#$#abp-abort-current-inline-script',
                expected: [
                    '#%#//scriptlet(\'abp-abort-current-inline-script\')',
                ],
            },
            // single scriptlet with parameters
            {
                actual: '#$#override-property-read testProp false',
                expected: [
                    '#%#//scriptlet(\'abp-override-property-read\', \'testProp\', \'false\')',
                ],
            },
            // redundant semicolon at the end of the rule
            {
                actual: '#$#override-property-read testProp false;',
                expected: [
                    '#%#//scriptlet(\'abp-override-property-read\', \'testProp\', \'false\')',
                ],
            },
            // multiple scriptlets (ABP supports this, but ADG and uBO doesn't)
            {
                actual: '#$#log; abort-current-inline-script; override-property-read testProp false',
                expected: [
                    '#%#//scriptlet(\'abp-log\')',
                    '#%#//scriptlet(\'abp-abort-current-inline-script\')',
                    '#%#//scriptlet(\'abp-override-property-read\', \'testProp\', \'false\')',
                ],
            },
        ])('should convert \'$actual\' to \'$expected\'', ({ actual, expected }) => {
            // we can assume that the rule is valid
            const ast = RuleParser.parse(actual) as ScriptletInjectionRule;
            const result = ScriptletRuleConverter.convertToAdg(ast);
            expect(result.map(RuleParser.generate)).toEqual(expected);
        });
    });

    describe('uBO to ADG', () => {
        test.each([
            {
                actual: 'example.org##+js(aopr, foo)',
                expected: [
                    'example.org#%#//scriptlet(\'ubo-aopr\', \'foo\')',
                ],
            },
            // exception status should be kept
            {
                actual: 'example.org#@#+js(aopr, foo)',
                expected: [
                    'example.org#@%#//scriptlet(\'ubo-aopr\', \'foo\')',
                ],
            },
            // don't add prefix again if it's already there
            {
                actual: 'example.org##+js(ubo-aopr, foo)',
                expected: [
                    'example.org#%#//scriptlet(\'ubo-aopr\', \'foo\')',
                ],
            },
            {
                actual: 'example.org##+js(abort-current-inline-script, $, popup)',
                expected: [
                    'example.org#%#//scriptlet(\'ubo-abort-current-inline-script\', \'$\', \'popup\')',
                ],
            },
        ])('should convert \'$actual\' to \'$expected\'', ({ actual, expected }) => {
            // we can assume that the rule is valid
            const ast = RuleParser.parse(actual) as ScriptletInjectionRule;
            const result = ScriptletRuleConverter.convertToAdg(ast);
            expect(result.map(RuleParser.generate)).toEqual(expected);
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
            },
            // leave quotes as is
            {
                actual: 'example.org#%#//scriptlet("abort-on-property-read", "foo")',
                expected: [
                    'example.org#%#//scriptlet("abort-on-property-read", "foo")',
                ],
            },
            {
                actual: 'example.org#%#//scriptlet(\'abort-current-inline-script\', \'$\', \'popup\')',
                expected: [
                    'example.org#%#//scriptlet(\'abort-current-inline-script\', \'$\', \'popup\')',
                ],
            },
        ])('should convert \'$actual\' to \'$expected\'', ({ actual, expected }) => {
            // we can assume that the rule is valid
            const ast = RuleParser.parse(actual) as ScriptletInjectionRule;
            const result = ScriptletRuleConverter.convertToAdg(ast);
            expect(result.map(RuleParser.generate)).toEqual(expected);
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
