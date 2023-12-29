import { NodeExpectContext, type NodeExpectFn } from '../../helpers/node-utils';
import { CosmeticRuleType, RuleCategory, type HtmlFilteringRule } from '../../../src/parser/common';
import { CosmeticRuleParser } from '../../../src/parser/cosmetic';
import { AdblockSyntax } from '../../../src/utils/adblockers';
import { DomainListParser } from '../../../src/parser/misc/domain-list';

describe('CosmeticRuleParser', () => {
    describe('CosmeticRuleParser.parse - valid AdGuard HTML filtering rules', () => {
        test.each<{ actual: string; expected: NodeExpectFn<HtmlFilteringRule> }>([
            // without domains
            {
                actual: '$$script[tag-content="adblock"]',
                expected: (context: NodeExpectContext): HtmlFilteringRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.HtmlFilteringRule,
                        syntax: AdblockSyntax.Adg,
                        exception: false,
                        modifiers: undefined,
                        domains: DomainListParser.parse(''),
                        separator: {
                            type: 'Value',
                            value: '$$',
                            loc: context.getLocRangeFor('$$'),
                        },
                        body: {
                            type: 'Value',
                            value: 'script[tag-content="adblock"]',
                            loc: context.getLocRangeFor('script[tag-content="adblock"]'),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },
            {
                actual: '$@$script[tag-content="adblock"]',
                expected: (context: NodeExpectContext): HtmlFilteringRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.HtmlFilteringRule,
                        syntax: AdblockSyntax.Adg,
                        exception: true,
                        modifiers: undefined,
                        domains: DomainListParser.parse(''),
                        separator: {
                            type: 'Value',
                            value: '$@$',
                            loc: context.getLocRangeFor('$@$'),
                        },
                        body: {
                            type: 'Value',
                            value: 'script[tag-content="adblock"]',
                            loc: context.getLocRangeFor('script[tag-content="adblock"]'),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },

            // with domains
            {
                actual: 'example.com,~example.net$$script[tag-content="adblock"]',
                expected: (context: NodeExpectContext): HtmlFilteringRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.HtmlFilteringRule,
                        syntax: AdblockSyntax.Adg,
                        exception: false,
                        modifiers: undefined,
                        domains: DomainListParser.parse('example.com,~example.net'),
                        separator: {
                            type: 'Value',
                            value: '$$',
                            loc: context.getLocRangeFor('$$'),
                        },
                        body: {
                            type: 'Value',
                            value: 'script[tag-content="adblock"]',
                            loc: context.getLocRangeFor('script[tag-content="adblock"]'),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },
            {
                actual: 'example.com,~example.net$@$script[tag-content="adblock"]',
                expected: (context: NodeExpectContext): HtmlFilteringRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.HtmlFilteringRule,
                        syntax: AdblockSyntax.Adg,
                        exception: true,
                        modifiers: undefined,
                        domains: DomainListParser.parse('example.com,~example.net'),
                        separator: {
                            type: 'Value',
                            value: '$@$',
                            loc: context.getLocRangeFor('$@$'),
                        },
                        body: {
                            type: 'Value',
                            value: 'script[tag-content="adblock"]',
                            loc: context.getLocRangeFor('script[tag-content="adblock"]'),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },
        ])("should parse '$actual'", ({ actual, expected: expectedFn }) => {
            expect(CosmeticRuleParser.parse(actual)).toMatchObject(expectedFn(new NodeExpectContext(actual)));
        });
    });

    describe('CosmeticRuleParser.generate - AdGuard HTML filtering rules', () => {
        test.each<{ actual: string; expected: string }>([
            // without domains
            {
                actual: '$$script[tag-content="adblock"]',
                expected: '$$script[tag-content="adblock"]',
            },
            {
                actual: '$@$script[tag-content="adblock"]',
                expected: '$@$script[tag-content="adblock"]',
            },

            // with domains
            {
                actual: 'example.com,~example.net$$script[tag-content="adblock"]',
                expected: 'example.com,~example.net$$script[tag-content="adblock"]',
            },
            {
                actual: 'example.com,~example.net$@$script[tag-content="adblock"]',
                expected: 'example.com,~example.net$@$script[tag-content="adblock"]',
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
