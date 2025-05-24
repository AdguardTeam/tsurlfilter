import { describe, test, expect } from 'vitest';

import { NodeExpectContext, type NodeExpectFn } from '../../helpers/node-utils.js';
import { CosmeticRuleType, type ElementHidingRule, RuleCategory } from '../../../src/nodes/index.js';
import { CosmeticRuleParser } from '../../../src/parser/cosmetic/cosmetic-rule-parser.js';
import { AdblockSyntax } from '../../../src/utils/adblockers.js';
import { DomainListParser } from '../../../src/parser/misc/domain-list-parser.js';
import { CosmeticRuleGenerator } from '../../../src/generator/cosmetic/index.js';

describe('CosmeticRuleParser', () => {
    describe('CosmeticRuleParser.parse - valid element hiding rules with extended CSS', () => {
        test.each<{ actual: string; expected: NodeExpectFn<ElementHidingRule> }>([
            // generic cosmetic rule - without domains
            {
                actual: '#?#.ad:-abp-has(.ad)',
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
                            value: '#?#',
                            ...context.getRangeFor('#?#'),
                        },
                        body: {
                            type: 'ElementHidingRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: '.ad:-abp-has(.ad)',
                                ...context.getRangeFor('.ad:-abp-has(.ad)'),
                            },
                            ...context.getRangeFor('.ad:-abp-has(.ad)'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
            // exception rule
            {
                actual: '#@?#.ad:-abp-has(.ad)',
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
                            value: '#@?#',
                            ...context.getRangeFor('#@?#'),
                        },
                        body: {
                            type: 'ElementHidingRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: '.ad:-abp-has(.ad)',
                                ...context.getRangeFor('.ad:-abp-has(.ad)'),
                            },
                            ...context.getRangeFor('.ad:-abp-has(.ad)'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },

            // specific cosmetic rule - with domains
            {
                actual: 'example.com,~example.net#?#.ad:-abp-has(.ad)',
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
                            value: '#?#',
                            ...context.getRangeFor('#?#'),
                        },
                        body: {
                            type: 'ElementHidingRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: '.ad:-abp-has(.ad)',
                                ...context.getRangeFor('.ad:-abp-has(.ad)'),
                            },
                            ...context.getRangeFor('.ad:-abp-has(.ad)'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
            // exception rule
            {
                actual: 'example.com,~example.net#@?#.ad:-abp-has(.ad)',
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
                            value: '#@?#',
                            ...context.getRangeFor('#@?#'),
                        },
                        body: {
                            type: 'ElementHidingRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: '.ad:-abp-has(.ad)',
                                ...context.getRangeFor('.ad:-abp-has(.ad)'),
                            },
                            ...context.getRangeFor('.ad:-abp-has(.ad)'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
        ])("should parse '$actual'", ({ actual, expected: expectedFn }) => {
            expect(CosmeticRuleParser.parse(actual)).toMatchObject(expectedFn(new NodeExpectContext(actual)));
        });
    });

    describe('CosmeticRuleParser.generate - element hiding rules with extended CSS', () => {
        test.each<{ actual: string; expected: string }>([
            // without domains
            {
                actual: '#?#.ad:-abp-has(.ad)',
                expected: '#?#.ad:-abp-has(.ad)',
            },
            {
                actual: '#@?#.ad:-abp-has(.ad)',
                expected: '#@?#.ad:-abp-has(.ad)',
            },

            // with domains
            {
                actual: 'example.com,~example.net#?#.ad:-abp-has(.ad)',
                expected: 'example.com,~example.net#?#.ad:-abp-has(.ad)',
            },
            {
                actual: 'example.com,~example.net#@?#.ad:-abp-has(.ad)',
                expected: 'example.com,~example.net#@?#.ad:-abp-has(.ad)',
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
