import { describe, test, expect } from 'vitest';

import { NodeExpectContext, type NodeExpectFn } from '../../helpers/node-utils.js';
import { CosmeticRuleType, RuleCategory, type ScriptletInjectionRule } from '../../../src/nodes/index.js';
import { AdgScriptletInjectionBodyParser } from '../../../src/parser/cosmetic/body/adg-scriptlet-injection-body-parser.js';
import { CosmeticRuleParser } from '../../../src/parser/cosmetic/cosmetic-rule-parser.js';
import { AdblockSyntax } from '../../../src/utils/adblockers.js';
import { DomainListParser } from '../../../src/parser/misc/domain-list-parser.js';
import { defaultParserOptions } from '../../../src/parser/options.js';
import { CosmeticRuleGenerator } from '../../../src/generator/cosmetic/index.js';

describe('CosmeticRuleParser', () => {
    describe('CosmeticRuleParser.parse - valid AdGuard scriptlet injection rules', () => {
        test.each<{ actual: string; expected: NodeExpectFn<ScriptletInjectionRule> }>([
            // without domains
            {
                actual: "#%#//scriptlet('scriptlet0', 'arg0', 'arg1')",
                expected: (context: NodeExpectContext): ScriptletInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.ScriptletInjectionRule,
                        syntax: AdblockSyntax.Adg,
                        exception: false,
                        modifiers: undefined,
                        domains: DomainListParser.parse(''),
                        separator: {
                            type: 'Value',
                            value: '#%#',
                            ...context.getRangeFor('#%#'),
                        },
                        body: {
                            ...AdgScriptletInjectionBodyParser.parse(
                                "//scriptlet('scriptlet0', 'arg0', 'arg1')",
                                defaultParserOptions,
                                '#%#'.length,
                            ),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
            {
                actual: "#@%#//scriptlet('scriptlet0', 'arg0', 'arg1')",
                expected: (context: NodeExpectContext): ScriptletInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.ScriptletInjectionRule,
                        syntax: AdblockSyntax.Adg,
                        exception: true,
                        modifiers: undefined,
                        domains: DomainListParser.parse(''),
                        separator: {
                            type: 'Value',
                            value: '#@%#',
                            ...context.getRangeFor('#@%#'),
                        },
                        body: {
                            ...AdgScriptletInjectionBodyParser.parse(
                                "//scriptlet('scriptlet0', 'arg0', 'arg1')",
                                defaultParserOptions,
                                '#@%#'.length,
                            ),
                        },
                        ...context.getFullRange(),
                    };
                },
            },

            // with domains
            {
                actual: "example.com,~example.net#%#//scriptlet('scriptlet0', 'arg0', 'arg1')",
                expected: (context: NodeExpectContext): ScriptletInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.ScriptletInjectionRule,
                        syntax: AdblockSyntax.Adg,
                        exception: false,
                        modifiers: undefined,
                        domains: DomainListParser.parse('example.com,~example.net'),
                        separator: {
                            type: 'Value',
                            value: '#%#',
                            ...context.getRangeFor('#%#'),
                        },
                        body: {
                            ...AdgScriptletInjectionBodyParser.parse(
                                "//scriptlet('scriptlet0', 'arg0', 'arg1')",
                                defaultParserOptions,
                                'example.com,~example.net#%#'.length,
                            ),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
            {
                actual: "example.com,~example.net#@%#//scriptlet('scriptlet0', 'arg0', 'arg1')",
                expected: (context: NodeExpectContext): ScriptletInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.ScriptletInjectionRule,
                        syntax: AdblockSyntax.Adg,
                        exception: true,
                        modifiers: undefined,
                        domains: DomainListParser.parse('example.com,~example.net'),
                        separator: {
                            type: 'Value',
                            value: '#@%#',
                            ...context.getRangeFor('#@%#'),
                        },
                        body: {
                            ...AdgScriptletInjectionBodyParser.parse(
                                "//scriptlet('scriptlet0', 'arg0', 'arg1')",
                                defaultParserOptions,
                                'example.com,~example.net#@%#'.length,
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

    describe('CosmeticRuleParser.generate - AdGuard scriptlet injection rules', () => {
        test.each<{ actual: string; expected: string }>([
            // without domains
            {
                actual: "#%#//scriptlet('scriptlet0', 'arg0', 'arg1')",
                expected: "#%#//scriptlet('scriptlet0', 'arg0', 'arg1')",
            },
            {
                actual: "#@%#//scriptlet('scriptlet0', 'arg0', 'arg1')",
                expected: "#@%#//scriptlet('scriptlet0', 'arg0', 'arg1')",
            },

            // with domains
            {
                actual: "example.com,~example.net#%#//scriptlet('scriptlet0', 'arg0', 'arg1')",
                expected: "example.com,~example.net#%#//scriptlet('scriptlet0', 'arg0', 'arg1')",
            },
            {
                actual: "example.com,~example.net#@%#//scriptlet('scriptlet0', 'arg0', 'arg1')",
                expected: "example.com,~example.net#@%#//scriptlet('scriptlet0', 'arg0', 'arg1')",
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
