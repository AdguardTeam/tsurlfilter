import { NodeExpectContext, type NodeExpectFn } from '../../helpers/node-utils';
import {
    CosmeticRuleType,
    RuleCategory,
    defaultLocation,
    type ScriptletInjectionRule,
} from '../../../src/parser/common';
import { CosmeticRuleParser } from '../../../src/parser/cosmetic';
import { AbpSnippetInjectionBodyParser } from '../../../src/parser/cosmetic/body/abp-snippet';
import { AdblockSyntax } from '../../../src/utils/adblockers';
import { DomainListParser } from '../../../src/parser/misc/domain-list';
import { shiftLoc } from '../../../src/utils/location';

describe('CosmeticRuleParser', () => {
    describe('CosmeticRuleParser.parse - valid Adblock Plus snippet injection rules', () => {
        test.each<{ actual: string; expected: NodeExpectFn<ScriptletInjectionRule> }>([
            // single snippets - without domains
            {
                actual: '#$#scriptlet0 arg0 arg1',
                expected: (context: NodeExpectContext): ScriptletInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.ScriptletInjectionRule,
                        syntax: AdblockSyntax.Abp,
                        exception: false,
                        modifiers: undefined,
                        domains: DomainListParser.parse(''),
                        separator: {
                            type: 'Value',
                            value: '#$#',
                            loc: context.getLocRangeFor('#$#'),
                        },
                        body: {
                            ...AbpSnippetInjectionBodyParser.parse(
                                'scriptlet0 arg0 arg1',
                                {
                                    baseLoc: shiftLoc(defaultLocation, '#$#'.length),
                                },
                            ),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },
            {
                actual: '#@$#scriptlet0 arg0 arg1',
                expected: (context: NodeExpectContext): ScriptletInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.ScriptletInjectionRule,
                        syntax: AdblockSyntax.Abp,
                        exception: true,
                        modifiers: undefined,
                        domains: DomainListParser.parse(''),
                        separator: {
                            type: 'Value',
                            value: '#@$#',
                            loc: context.getLocRangeFor('#@$#'),
                        },
                        body: {
                            ...AbpSnippetInjectionBodyParser.parse(
                                'scriptlet0 arg0 arg1',
                                {
                                    baseLoc: shiftLoc(defaultLocation, '#@$#'.length),
                                },
                            ),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },

            // multiple snippets - without domains
            {
                actual: '#$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11',
                expected: (context: NodeExpectContext): ScriptletInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.ScriptletInjectionRule,
                        syntax: AdblockSyntax.Abp,
                        exception: false,
                        modifiers: undefined,
                        domains: DomainListParser.parse(''),
                        separator: {
                            type: 'Value',
                            value: '#$#',
                            loc: context.getLocRangeFor('#$#'),
                        },
                        body: {
                            ...AbpSnippetInjectionBodyParser.parse(
                                'scriptlet0 arg00 arg01; scriptlet1 arg10 arg11',
                                {
                                    baseLoc: shiftLoc(defaultLocation, '#$#'.length),
                                },
                            ),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },
            {
                actual: '#@$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11',
                expected: (context: NodeExpectContext): ScriptletInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.ScriptletInjectionRule,
                        syntax: AdblockSyntax.Abp,
                        exception: true,
                        modifiers: undefined,
                        domains: DomainListParser.parse(''),
                        separator: {
                            type: 'Value',
                            value: '#@$#',
                            loc: context.getLocRangeFor('#@$#'),
                        },
                        body: {
                            ...AbpSnippetInjectionBodyParser.parse(
                                'scriptlet0 arg00 arg01; scriptlet1 arg10 arg11',
                                {
                                    baseLoc: shiftLoc(defaultLocation, '#@$#'.length),
                                },
                            ),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },

            // semicolon at the end - without domains
            {
                actual: '#$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11;',
                expected: (context: NodeExpectContext): ScriptletInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.ScriptletInjectionRule,
                        syntax: AdblockSyntax.Abp,
                        exception: false,
                        modifiers: undefined,
                        domains: DomainListParser.parse(''),
                        separator: {
                            type: 'Value',
                            value: '#$#',
                            loc: context.getLocRangeFor('#$#'),
                        },
                        body: {
                            ...AbpSnippetInjectionBodyParser.parse(
                                'scriptlet0 arg00 arg01; scriptlet1 arg10 arg11;',
                                {
                                    baseLoc: shiftLoc(defaultLocation, '#$#'.length),
                                },
                            ),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },

            // single snippets - with domains
            {
                actual: 'example.com,~example.net#$#scriptlet0 arg0 arg1',
                expected: (context: NodeExpectContext): ScriptletInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.ScriptletInjectionRule,
                        syntax: AdblockSyntax.Abp,
                        exception: false,
                        modifiers: undefined,
                        domains: DomainListParser.parse('example.com,~example.net'),
                        separator: {
                            type: 'Value',
                            value: '#$#',
                            loc: context.getLocRangeFor('#$#'),
                        },
                        body: {
                            ...AbpSnippetInjectionBodyParser.parse(
                                'scriptlet0 arg0 arg1',
                                {
                                    baseLoc: shiftLoc(defaultLocation, 'example.com,~example.net#$#'.length),
                                },
                            ),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },
            {
                actual: 'example.com,~example.net#@$#scriptlet0 arg0 arg1',
                expected: (context: NodeExpectContext): ScriptletInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.ScriptletInjectionRule,
                        syntax: AdblockSyntax.Abp,
                        exception: true,
                        modifiers: undefined,
                        domains: DomainListParser.parse('example.com,~example.net'),
                        separator: {
                            type: 'Value',
                            value: '#@$#',
                            loc: context.getLocRangeFor('#@$#'),
                        },
                        body: {
                            ...AbpSnippetInjectionBodyParser.parse(
                                'scriptlet0 arg0 arg1',
                                {
                                    baseLoc: shiftLoc(defaultLocation, 'example.com,~example.net#@$#'.length),
                                },
                            ),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },

            // multiple snippets - with domains
            {
                actual: 'example.com,~example.net#$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11',
                expected: (context: NodeExpectContext): ScriptletInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.ScriptletInjectionRule,
                        syntax: AdblockSyntax.Abp,
                        exception: false,
                        modifiers: undefined,
                        domains: DomainListParser.parse('example.com,~example.net'),
                        separator: {
                            type: 'Value',
                            value: '#$#',
                            loc: context.getLocRangeFor('#$#'),
                        },
                        body: {
                            ...AbpSnippetInjectionBodyParser.parse(
                                'scriptlet0 arg00 arg01; scriptlet1 arg10 arg11',
                                {
                                    baseLoc: shiftLoc(defaultLocation, 'example.com,~example.net#$#'.length),
                                },
                            ),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },
            {
                actual: 'example.com,~example.net#@$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11',
                expected: (context: NodeExpectContext): ScriptletInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.ScriptletInjectionRule,
                        syntax: AdblockSyntax.Abp,
                        exception: true,
                        modifiers: undefined,
                        domains: DomainListParser.parse('example.com,~example.net'),
                        separator: {
                            type: 'Value',
                            value: '#@$#',
                            loc: context.getLocRangeFor('#@$#'),
                        },
                        body: {
                            ...AbpSnippetInjectionBodyParser.parse(
                                'scriptlet0 arg00 arg01; scriptlet1 arg10 arg11',
                                {
                                    baseLoc: shiftLoc(defaultLocation, 'example.com,~example.net#@$#'.length),
                                },
                            ),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },

            // semicolon at the end - with domains
            {
                actual: 'example.com,~example.net#$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11;',
                expected: (context: NodeExpectContext): ScriptletInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.ScriptletInjectionRule,
                        syntax: AdblockSyntax.Abp,
                        exception: false,
                        modifiers: undefined,
                        domains: DomainListParser.parse('example.com,~example.net'),
                        separator: {
                            type: 'Value',
                            value: '#$#',
                            loc: context.getLocRangeFor('#$#'),
                        },
                        body: {
                            ...AbpSnippetInjectionBodyParser.parse(
                                'scriptlet0 arg00 arg01; scriptlet1 arg10 arg11;',
                                {
                                    baseLoc: shiftLoc(defaultLocation, 'example.com,~example.net#$#'.length),
                                },
                            ),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },
        ])("should parse '$actual'", ({ actual, expected: expectedFn }) => {
            expect(CosmeticRuleParser.parse(actual)).toMatchObject(expectedFn(new NodeExpectContext(actual)));
        });
    });

    describe('CosmeticRuleParser.generate - Adblock Plus snippet injection rules', () => {
        test.each<{ actual: string; expected: string }>([
            // single snippets - without domains
            {
                actual: '#$#scriptlet0 arg0 arg1',
                expected: '#$#scriptlet0 arg0 arg1',
            },
            {
                actual: '#@$#scriptlet0 arg0 arg1',
                expected: '#@$#scriptlet0 arg0 arg1',
            },

            // multiple snippets - without domains
            {
                actual: '#$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11',
                expected: '#$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11',
            },
            {
                actual: '#@$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11',
                expected: '#@$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11',
            },

            // trailing semicolon - without domains
            {
                actual: '#$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11;',
                expected: '#$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11',
            },
            {
                actual: '#@$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11;',
                expected: '#@$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11',
            },

            // single snippets - with domains
            {
                actual: 'example.com,~example.net#$#scriptlet0 arg0 arg1',
                expected: 'example.com,~example.net#$#scriptlet0 arg0 arg1',
            },
            {
                actual: 'example.com,~example.net#@$#scriptlet0 arg0 arg1',
                expected: 'example.com,~example.net#@$#scriptlet0 arg0 arg1',
            },

            // multiple snippets - with domains
            {
                actual: 'example.com,~example.net#$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11',
                expected: 'example.com,~example.net#$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11',
            },
            {
                actual: 'example.com,~example.net#@$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11',
                expected: 'example.com,~example.net#@$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11',
            },

            // trailing semicolon - with domains
            {
                actual: 'example.com,~example.net#$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11;',
                expected: 'example.com,~example.net#$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11',
            },
            {
                actual: 'example.com,~example.net#@$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11;',
                expected: 'example.com,~example.net#@$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11',
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
