import { describe, test, expect } from 'vitest';

import { NodeExpectContext, type NodeExpectFn } from '../../helpers/node-utils';
import { CosmeticRuleType, type ElementHidingRule, RuleCategory } from '../../../src/nodes';
import { CosmeticRuleParser } from '../../../src/parser/cosmetic/cosmetic-rule-parser';
import { AdblockSyntax } from '../../../src/utils/adblockers';
import { DomainListParser } from '../../../src/parser/misc/domain-list-parser';
import { CosmeticRuleGenerator } from '../../../src/generator/cosmetic';

describe('CosmeticRuleParser', () => {
    describe('CosmeticRuleParser.parse - valid element hiding rules', () => {
        test.each<{ actual: string; expected: NodeExpectFn<ElementHidingRule> }>([
            // generic cosmetic rule - without domains
            {
                actual: '##.ad',
                expected: (context: NodeExpectContext): ElementHidingRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.ElementHidingRule,
                        syntax: AdblockSyntax.Common,
                        exception: false,
                        modifiers: undefined,
                        domains: DomainListParser.parse(''),
                        separator: {
                            type: 'Value',
                            value: '##',
                            ...context.getRangeFor('##'),
                        },
                        body: {
                            type: 'ElementHidingRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: '.ad',
                                ...context.getRangeFor('.ad'),
                            },
                            ...context.getRangeFor('.ad'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
            // exception rule
            {
                actual: '#@#.ad',
                expected: (context: NodeExpectContext): ElementHidingRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.ElementHidingRule,
                        syntax: AdblockSyntax.Common,
                        exception: true,
                        modifiers: undefined,
                        domains: DomainListParser.parse(''),
                        separator: {
                            type: 'Value',
                            value: '#@#',
                            ...context.getRangeFor('#@#'),
                        },
                        body: {
                            type: 'ElementHidingRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: '.ad',
                                ...context.getRangeFor('.ad'),
                            },
                            ...context.getRangeFor('.ad'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },

            // specific cosmetic rule - with domains
            {
                actual: 'example.com,~example.net##.ad',
                expected: (context: NodeExpectContext): ElementHidingRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.ElementHidingRule,
                        syntax: AdblockSyntax.Common,
                        exception: false,
                        modifiers: undefined,
                        domains: DomainListParser.parse('example.com,~example.net'),
                        separator: {
                            type: 'Value',
                            value: '##',
                            ...context.getRangeFor('##'),
                        },
                        body: {
                            type: 'ElementHidingRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: '.ad',
                                ...context.getRangeFor('.ad'),
                            },
                            ...context.getRangeFor('.ad'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
            // exception rule
            {
                actual: 'example.com,~example.net#@#.ad',
                expected: (context: NodeExpectContext): ElementHidingRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.ElementHidingRule,
                        syntax: AdblockSyntax.Common,
                        exception: true,
                        modifiers: undefined,
                        domains: DomainListParser.parse('example.com,~example.net'),
                        separator: {
                            type: 'Value',
                            value: '#@#',
                            ...context.getRangeFor('#@#'),
                        },
                        body: {
                            type: 'ElementHidingRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: '.ad',
                                ...context.getRangeFor('.ad'),
                            },
                            ...context.getRangeFor('.ad'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
        ])("should parse '$actual'", ({ actual, expected: expectedFn }) => {
            expect(CosmeticRuleParser.parse(actual)).toMatchObject(expectedFn(new NodeExpectContext(actual)));
        });
    });

    describe('CosmeticRuleParser.generate - element hiding rules', () => {
        test.each<{ actual: string; expected: string }>([
            // without domains
            {
                actual: '##.ad',
                expected: '##.ad',
            },
            {
                actual: '#@#.ad',
                expected: '#@#.ad',
            },

            // with domains
            {
                actual: 'example.com,~example.net##.ad',
                expected: 'example.com,~example.net##.ad',
            },
            {
                actual: 'example.com,~example.net#@#.ad',
                expected: 'example.com,~example.net#@#.ad',
            },

            // Single-letter HTML tag selectors:
            // https://github.com/AdguardTeam/tsurlfilter/issues/172
            {
                actual: '##p',
                expected: '##p',
            },
            {
                actual: '##a',
                expected: '##a',
            },
            {
                actual: '##p > a',
                expected: '##p > a',
            },
            {
                actual: '##p > a[href^="/AllRes/Vlog"]',
                expected: '##p > a[href^="/AllRes/Vlog"]',
            },
            {
                actual: '##a > span',
                expected: '##a > span',
            },
            {
                actual: 'example.com##p > a',
                expected: 'example.com##p > a',
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
