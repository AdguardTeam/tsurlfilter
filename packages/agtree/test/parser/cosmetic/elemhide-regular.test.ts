import { NodeExpectContext, type NodeExpectFn } from '../../helpers/node-utils';
import { CosmeticRuleType, type ElementHidingRule, RuleCategory } from '../../../src/parser/common';
import { CosmeticRuleParser } from '../../../src/parser/cosmetic';
import { AdblockSyntax } from '../../../src/utils/adblockers';
import { DomainListParser } from '../../../src/parser/misc/domain-list';

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
                            loc: context.getLocRangeFor('##'),
                        },
                        body: {
                            type: 'ElementHidingRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: '.ad',
                                loc: context.getLocRangeFor('.ad'),
                            },
                            loc: context.getLocRangeFor('.ad'),
                        },
                        loc: context.getFullLocRange(),
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
                            loc: context.getLocRangeFor('#@#'),
                        },
                        body: {
                            type: 'ElementHidingRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: '.ad',
                                loc: context.getLocRangeFor('.ad'),
                            },
                            loc: context.getLocRangeFor('.ad'),
                        },
                        loc: context.getFullLocRange(),
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
                            loc: context.getLocRangeFor('##'),
                        },
                        body: {
                            type: 'ElementHidingRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: '.ad',
                                loc: context.getLocRangeFor('.ad'),
                            },
                            loc: context.getLocRangeFor('.ad'),
                        },
                        loc: context.getFullLocRange(),
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
                            loc: context.getLocRangeFor('#@#'),
                        },
                        body: {
                            type: 'ElementHidingRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: '.ad',
                                loc: context.getLocRangeFor('.ad'),
                            },
                            loc: context.getLocRangeFor('.ad'),
                        },
                        loc: context.getFullLocRange(),
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
        ])("should generate '$expected' from '$actual'", ({ actual, expected }) => {
            const ruleNode = CosmeticRuleParser.parse(actual);

            if (ruleNode === null) {
                throw new Error(`Failed to parse '${actual}' as cosmetic rule`);
            }

            expect(CosmeticRuleParser.generate(ruleNode)).toBe(expected);
        });
    });
});
