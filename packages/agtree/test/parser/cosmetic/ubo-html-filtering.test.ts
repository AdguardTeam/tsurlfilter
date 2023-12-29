import { NodeExpectContext, type NodeExpectFn } from '../../helpers/node-utils';
import { CosmeticRuleType, RuleCategory, type HtmlFilteringRule } from '../../../src/parser/common';
import { CosmeticRuleParser } from '../../../src/parser/cosmetic';
import { AdblockSyntax } from '../../../src/utils/adblockers';
import { DomainListParser } from '../../../src/parser/misc/domain-list';

describe('CosmeticRuleParser', () => {
    describe('CosmeticRuleParser.parse - valid uBlock HTML filtering rules', () => {
        test.each<{ actual: string; expected: NodeExpectFn<HtmlFilteringRule> }>([
            // without domains
            {
                actual: '##^script:has-text(adblock)',
                expected: (context: NodeExpectContext): HtmlFilteringRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.HtmlFilteringRule,
                        syntax: AdblockSyntax.Ubo,
                        exception: false,
                        modifiers: undefined,
                        domains: DomainListParser.parse(''),
                        separator: {
                            type: 'Value',
                            value: '##',
                            loc: context.getLocRangeFor('##'),
                        },
                        body: {
                            type: 'Value',
                            value: '^script:has-text(adblock)',
                            loc: context.getLocRangeFor('^script:has-text(adblock)'),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },
            {
                actual: '#@#^script:has-text(adblock)',
                expected: (context: NodeExpectContext): HtmlFilteringRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.HtmlFilteringRule,
                        syntax: AdblockSyntax.Ubo,
                        exception: true,
                        modifiers: undefined,
                        domains: DomainListParser.parse(''),
                        separator: {
                            type: 'Value',
                            value: '#@#',
                            loc: context.getLocRangeFor('#@#'),
                        },
                        body: {
                            type: 'Value',
                            value: '^script:has-text(adblock)',
                            loc: context.getLocRangeFor('^script:has-text(adblock)'),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },

            // with domains
            {
                actual: 'example.com,~example.net##^script:has-text(adblock)',
                expected: (context: NodeExpectContext): HtmlFilteringRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.HtmlFilteringRule,
                        syntax: AdblockSyntax.Ubo,
                        exception: false,
                        modifiers: undefined,
                        domains: DomainListParser.parse('example.com,~example.net'),
                        separator: {
                            type: 'Value',
                            value: '##',
                            loc: context.getLocRangeFor('##'),
                        },
                        body: {
                            type: 'Value',
                            value: '^script:has-text(adblock)',
                            loc: context.getLocRangeFor('^script:has-text(adblock)'),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },
            {
                actual: 'example.com,~example.net#@#^script:has-text(adblock)',
                expected: (context: NodeExpectContext): HtmlFilteringRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.HtmlFilteringRule,
                        syntax: AdblockSyntax.Ubo,
                        exception: true,
                        modifiers: undefined,
                        domains: DomainListParser.parse('example.com,~example.net'),
                        separator: {
                            type: 'Value',
                            value: '#@#',
                            loc: context.getLocRangeFor('#@#'),
                        },
                        body: {
                            type: 'Value',
                            value: '^script:has-text(adblock)',
                            loc: context.getLocRangeFor('^script:has-text(adblock)'),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },
        ])("should parse '$actual'", ({ actual, expected: expectedFn }) => {
            expect(CosmeticRuleParser.parse(actual)).toMatchObject(expectedFn(new NodeExpectContext(actual)));
        });
    });

    describe('CosmeticRuleParser.generate - uBlock HTML filtering rules', () => {
        test.each<{ actual: string; expected: string }>([
            // without domains
            {
                actual: '##^script:has-text(adblock)',
                expected: '##^script:has-text(adblock)',
            },
            {
                actual: '#@#^script:has-text(adblock)',
                expected: '#@#^script:has-text(adblock)',
            },

            // with domains
            {
                actual: 'example.com,~example.net##^script:has-text(adblock)',
                expected: 'example.com,~example.net##^script:has-text(adblock)',
            },
            {
                actual: 'example.com,~example.net#@#^script:has-text(adblock)',
                expected: 'example.com,~example.net#@#^script:has-text(adblock)',
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
