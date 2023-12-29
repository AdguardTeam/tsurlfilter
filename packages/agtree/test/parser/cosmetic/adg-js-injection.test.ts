import { NodeExpectContext, type NodeExpectFn } from '../../helpers/node-utils';
import { CosmeticRuleType, RuleCategory, type JsInjectionRule } from '../../../src/parser/common';
import { CosmeticRuleParser } from '../../../src/parser/cosmetic';
import { AdblockSyntax } from '../../../src/utils/adblockers';
import { DomainListParser } from '../../../src/parser/misc/domain-list';

describe('CosmeticRuleParser', () => {
    describe('CosmeticRuleParser.parse - valid AdGuard JS injection rules', () => {
        test.each<{ actual: string; expected: NodeExpectFn<JsInjectionRule> }>([
            // without domains
            {
                actual: '#%#const a = 2;',
                expected: (context: NodeExpectContext): JsInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.JsInjectionRule,
                        syntax: AdblockSyntax.Adg,
                        exception: false,
                        modifiers: undefined,
                        domains: DomainListParser.parse(''),
                        separator: {
                            type: 'Value',
                            value: '#%#',
                            loc: context.getLocRangeFor('#%#'),
                        },
                        body: {
                            type: 'Value',
                            value: 'const a = 2;',
                            loc: context.getLocRangeFor('const a = 2;'),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },
            {
                actual: '#@%#const a = 2;',
                expected: (context: NodeExpectContext): JsInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.JsInjectionRule,
                        syntax: AdblockSyntax.Adg,
                        exception: true,
                        modifiers: undefined,
                        domains: DomainListParser.parse(''),
                        separator: {
                            type: 'Value',
                            value: '#@%#',
                            loc: context.getLocRangeFor('#@%#'),
                        },
                        body: {
                            type: 'Value',
                            value: 'const a = 2;',
                            loc: context.getLocRangeFor('const a = 2;'),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },

            // with domains
            {
                actual: 'example.com,~example.net#%#const a = 2;',
                expected: (context: NodeExpectContext): JsInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.JsInjectionRule,
                        syntax: AdblockSyntax.Adg,
                        exception: false,
                        modifiers: undefined,
                        domains: DomainListParser.parse('example.com,~example.net'),
                        separator: {
                            type: 'Value',
                            value: '#%#',
                            loc: context.getLocRangeFor('#%#'),
                        },
                        body: {
                            type: 'Value',
                            value: 'const a = 2;',
                            loc: context.getLocRangeFor('const a = 2;'),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },
            {
                actual: 'example.com,~example.net#@%#const a = 2;',
                expected: (context: NodeExpectContext): JsInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.JsInjectionRule,
                        syntax: AdblockSyntax.Adg,
                        exception: true,
                        modifiers: undefined,
                        domains: DomainListParser.parse('example.com,~example.net'),
                        separator: {
                            type: 'Value',
                            value: '#@%#',
                            loc: context.getLocRangeFor('#@%#'),
                        },
                        body: {
                            type: 'Value',
                            value: 'const a = 2;',
                            loc: context.getLocRangeFor('const a = 2;'),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },
        ])("should parse '$actual'", ({ actual, expected: expectedFn }) => {
            expect(CosmeticRuleParser.parse(actual)).toMatchObject(expectedFn(new NodeExpectContext(actual)));
        });
    });

    describe('CosmeticRuleParser.generate - AdGuard JS injection rules', () => {
        test.each<{ actual: string; expected: string }>([
            // simple cases - without domains
            {
                actual: '#%#const a = 2;',
                expected: '#%#const a = 2;',
            },
            {
                actual: '#@%#const a = 2;',
                expected: '#@%#const a = 2;',
            },

            // simple cases - with domains
            {
                actual: 'example.com,~example.net#%#const a = 2;',
                expected: 'example.com,~example.net#%#const a = 2;',
            },
            {
                actual: 'example.com,~example.net#@%#const a = 2;',
                expected: 'example.com,~example.net#@%#const a = 2;',
            },
        ])("should generate '$expected' from '$actual'", ({ actual, expected }) => {
            const ruleNode = CosmeticRuleParser.parse(actual);

            if (ruleNode === null) {
                throw new Error(`Failed to parse '${actual}' as cosmetic rule`);
            }

            expect(CosmeticRuleParser.generate(ruleNode)).toBe(expected);
        });
    });
});
