import { describe, test, expect } from 'vitest';

import { NodeExpectContext, type NodeExpectFn } from '../../helpers/node-utils.js';
import { CosmeticRuleType, RuleCategory, type ScriptletInjectionRule } from '../../../src/nodes/index.js';
import { CosmeticRuleParser } from '../../../src/parser/cosmetic/cosmetic-rule-parser.js';
import { AbpSnippetInjectionBodyParser } from '../../../src/parser/cosmetic/body/abp-snippet-injection-body-parser.js';
import { AdblockSyntax } from '../../../src/utils/adblockers.js';
import { DomainListParser } from '../../../src/parser/misc/domain-list-parser.js';
import { defaultParserOptions } from '../../../src/parser/options.js';
import { CosmeticRuleGenerator } from '../../../src/generator/cosmetic/index.js';

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
                            ...context.getRangeFor('#$#'),
                        },
                        body: {
                            ...AbpSnippetInjectionBodyParser.parse(
                                'scriptlet0 arg0 arg1',
                                defaultParserOptions,
                                '#$#'.length,
                            ),
                        },
                        ...context.getFullRange(),
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
                            ...context.getRangeFor('#@$#'),
                        },
                        body: {
                            ...AbpSnippetInjectionBodyParser.parse(
                                'scriptlet0 arg0 arg1',
                                defaultParserOptions,
                                '#@$#'.length,
                            ),
                        },
                        ...context.getFullRange(),
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
                            ...context.getRangeFor('#$#'),
                        },
                        body: {
                            ...AbpSnippetInjectionBodyParser.parse(
                                'scriptlet0 arg00 arg01; scriptlet1 arg10 arg11',
                                defaultParserOptions,
                                '#$#'.length,
                            ),
                        },
                        ...context.getFullRange(),
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
                            ...context.getRangeFor('#@$#'),
                        },
                        body: {
                            ...AbpSnippetInjectionBodyParser.parse(
                                'scriptlet0 arg00 arg01; scriptlet1 arg10 arg11',
                                defaultParserOptions,
                                '#@$#'.length,
                            ),
                        },
                        ...context.getFullRange(),
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
                            ...context.getRangeFor('#$#'),
                        },
                        body: {
                            ...AbpSnippetInjectionBodyParser.parse(
                                'scriptlet0 arg00 arg01; scriptlet1 arg10 arg11;',
                                defaultParserOptions,
                                '#$#'.length,
                            ),
                        },
                        ...context.getFullRange(),
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
                            ...context.getRangeFor('#$#'),
                        },
                        body: {
                            ...AbpSnippetInjectionBodyParser.parse(
                                'scriptlet0 arg0 arg1',
                                defaultParserOptions,
                                'example.com,~example.net#$#'.length,
                            ),
                        },
                        ...context.getFullRange(),
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
                            ...context.getRangeFor('#@$#'),
                        },
                        body: {
                            ...AbpSnippetInjectionBodyParser.parse(
                                'scriptlet0 arg0 arg1',
                                defaultParserOptions,
                                'example.com,~example.net#@$#'.length,
                            ),
                        },
                        ...context.getFullRange(),
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
                            ...context.getRangeFor('#$#'),
                        },
                        body: {
                            ...AbpSnippetInjectionBodyParser.parse(
                                'scriptlet0 arg00 arg01; scriptlet1 arg10 arg11',
                                defaultParserOptions,
                                'example.com,~example.net#$#'.length,
                            ),
                        },
                        ...context.getFullRange(),
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
                            ...context.getRangeFor('#@$#'),
                        },
                        body: {
                            ...AbpSnippetInjectionBodyParser.parse(
                                'scriptlet0 arg00 arg01; scriptlet1 arg10 arg11',
                                defaultParserOptions,
                                'example.com,~example.net#@$#'.length,
                            ),
                        },
                        ...context.getFullRange(),
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
                            ...context.getRangeFor('#$#'),
                        },
                        body: {
                            ...AbpSnippetInjectionBodyParser.parse(
                                'scriptlet0 arg00 arg01; scriptlet1 arg10 arg11;',
                                defaultParserOptions,
                                'example.com,~example.net#$#'.length,
                            ),
                        },
                        ...context.getFullRange(),
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

            expect(CosmeticRuleGenerator.generate(ruleNode)).toBe(expected);
        });
    });
});
