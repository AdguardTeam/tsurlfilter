import { NodeExpectContext, type NodeExpectFn } from '../../helpers/node-utils';
import {
    CosmeticRuleType,
    RuleCategory,
    defaultLocation,
    type ScriptletInjectionRule,
} from '../../../src/parser/common';
import { AdgScriptletInjectionBodyParser } from '../../../src/parser/cosmetic/body/adg-scriptlet';
import { CosmeticRuleParser } from '../../../src/parser/cosmetic';
import { AdblockSyntax } from '../../../src/utils/adblockers';
import { DomainListParser } from '../../../src/parser/misc/domain-list';
import { shiftLoc } from '../../../src/utils/location';

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
                            loc: context.getLocRangeFor('#%#'),
                        },
                        body: {
                            ...AdgScriptletInjectionBodyParser.parse(
                                "//scriptlet('scriptlet0', 'arg0', 'arg1')",
                                {
                                    baseLoc: shiftLoc(defaultLocation, '#%#'.length),
                                },
                            ),
                        },
                        loc: context.getFullLocRange(),
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
                            loc: context.getLocRangeFor('#@%#'),
                        },
                        body: {
                            ...AdgScriptletInjectionBodyParser.parse(
                                "//scriptlet('scriptlet0', 'arg0', 'arg1')",
                                {
                                    baseLoc: shiftLoc(defaultLocation, '#@%#'.length),
                                },
                            ),
                        },
                        loc: context.getFullLocRange(),
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
                            loc: context.getLocRangeFor('#%#'),
                        },
                        body: {
                            ...AdgScriptletInjectionBodyParser.parse(
                                "//scriptlet('scriptlet0', 'arg0', 'arg1')",
                                {
                                    baseLoc: shiftLoc(defaultLocation, 'example.com,~example.net#%#'.length),
                                },
                            ),
                        },
                        loc: context.getFullLocRange(),
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
                            loc: context.getLocRangeFor('#@%#'),
                        },
                        body: {
                            ...AdgScriptletInjectionBodyParser.parse(
                                "//scriptlet('scriptlet0', 'arg0', 'arg1')",
                                {
                                    baseLoc: shiftLoc(defaultLocation, 'example.com,~example.net#@%#'.length),
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

            expect(CosmeticRuleParser.generate(ruleNode)).toBe(expected);
        });
    });
});
