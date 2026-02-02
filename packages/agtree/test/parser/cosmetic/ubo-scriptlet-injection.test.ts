import { describe, test, expect } from 'vitest';

import { NodeExpectContext, type NodeExpectFn } from '../../helpers/node-utils';
import { CosmeticRuleType, RuleCategory, type ScriptletInjectionRule } from '../../../src/nodes';
import {
    UboScriptletInjectionBodyParser,
} from '../../../src/parser/cosmetic/scriptlet-body/ubo-scriptlet-injection-body-parser';
import { CosmeticRuleParser } from '../../../src/parser/cosmetic/cosmetic-rule-parser';
import { AdblockSyntax } from '../../../src/utils/adblockers';
import { DomainListParser } from '../../../src/parser/misc/domain-list-parser';
import { defaultParserOptions } from '../../../src/parser/options';
import { CosmeticRuleGenerator } from '../../../src/generator/cosmetic';

describe('CosmeticRuleParser', () => {
    describe('CosmeticRuleParser.parse - valid uBlock scriptlet injection rules', () => {
        test.each<{ actual: string; expected: NodeExpectFn<ScriptletInjectionRule> }>([
            // without domains
            {
                actual: '##+js(scriptlet0, arg0, arg1)',
                expected: (context: NodeExpectContext): ScriptletInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.ScriptletInjectionRule,
                        syntax: AdblockSyntax.Ubo,
                        exception: false,
                        modifiers: undefined,
                        domains: DomainListParser.parse(''),
                        separator: {
                            type: 'Value',
                            value: '##',
                            ...context.getRangeFor('##'),
                        },
                        body: {
                            ...UboScriptletInjectionBodyParser.parse(
                                '+js(scriptlet0, arg0, arg1)',
                                defaultParserOptions,
                                '##'.length,
                            ),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
            {
                actual: '#@#+js(scriptlet0, arg0, arg1)',
                expected: (context: NodeExpectContext): ScriptletInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.ScriptletInjectionRule,
                        syntax: AdblockSyntax.Ubo,
                        exception: true,
                        modifiers: undefined,
                        domains: DomainListParser.parse(''),
                        separator: {
                            type: 'Value',
                            value: '#@#',
                            ...context.getRangeFor('#@#'),
                        },
                        body: {
                            ...UboScriptletInjectionBodyParser.parse(
                                '+js(scriptlet0, arg0, arg1)',
                                defaultParserOptions,
                                '#@#'.length,
                            ),
                        },
                        ...context.getFullRange(),
                    };
                },
            },

            // with domains
            {
                actual: 'example.com,~example.net##+js(scriptlet0, arg0, arg1)',
                expected: (context: NodeExpectContext): ScriptletInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.ScriptletInjectionRule,
                        syntax: AdblockSyntax.Ubo,
                        exception: false,
                        modifiers: undefined,
                        domains: DomainListParser.parse('example.com,~example.net'),
                        separator: {
                            type: 'Value',
                            value: '##',
                            ...context.getRangeFor('##'),
                        },
                        body: {
                            ...UboScriptletInjectionBodyParser.parse(
                                '+js(scriptlet0, arg0, arg1)',
                                defaultParserOptions,
                                'example.com,~example.net##'.length,
                            ),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
            {
                actual: 'example.com,~example.net#@#+js(scriptlet0, arg0, arg1)',
                expected: (context: NodeExpectContext): ScriptletInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.ScriptletInjectionRule,
                        syntax: AdblockSyntax.Ubo,
                        exception: true,
                        modifiers: undefined,
                        domains: DomainListParser.parse('example.com,~example.net'),
                        separator: {
                            type: 'Value',
                            value: '#@#',
                            ...context.getRangeFor('#@#'),
                        },
                        body: {
                            ...UboScriptletInjectionBodyParser.parse(
                                '+js(scriptlet0, arg0, arg1)',
                                defaultParserOptions,
                                'example.com,~example.net#@#'.length,
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

    describe('CosmeticRuleParser.generate - uBlock scriptlet injection rules', () => {
        test.each<{ actual: string; expected: string }>([
            // without domains
            {
                actual: '##+js(scriptlet0, arg0, arg1)',
                expected: '##+js(scriptlet0, arg0, arg1)',
            },
            {
                actual: '#@#+js(scriptlet0, arg0, arg1)',
                expected: '#@#+js(scriptlet0, arg0, arg1)',
            },

            // with domains
            {
                actual: 'example.com,~example.net##+js(scriptlet0, arg0, arg1)',
                expected: 'example.com,~example.net##+js(scriptlet0, arg0, arg1)',
            },
            {
                actual: 'example.com,~example.net#@#+js(scriptlet0, arg0, arg1)',
                expected: 'example.com,~example.net#@#+js(scriptlet0, arg0, arg1)',
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
