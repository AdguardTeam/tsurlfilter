import { describe, test, expect } from 'vitest';

import { NodeExpectContext, type NodeExpectFn } from '../../helpers/node-utils.js';
import { CosmeticRuleType, RuleCategory, type HtmlFilteringRule } from '../../../src/nodes/index.js';
import { CosmeticRuleParser } from '../../../src/parser/cosmetic/cosmetic-rule-parser.js';
import { AdblockSyntax } from '../../../src/utils/adblockers.js';
import { DomainListParser } from '../../../src/parser/misc/domain-list-parser.js';
import { CosmeticRuleGenerator } from '../../../src/generator/cosmetic/index.js';

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
                            ...context.getRangeFor('##'),
                        },
                        body: {
                            type: 'Value',
                            value: '^script:has-text(adblock)',
                            ...context.getRangeFor('^script:has-text(adblock)'),
                        },
                        ...context.getFullRange(),
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
                            ...context.getRangeFor('#@#'),
                        },
                        body: {
                            type: 'Value',
                            value: '^script:has-text(adblock)',
                            ...context.getRangeFor('^script:has-text(adblock)'),
                        },
                        ...context.getFullRange(),
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
                            ...context.getRangeFor('##'),
                        },
                        body: {
                            type: 'Value',
                            value: '^script:has-text(adblock)',
                            ...context.getRangeFor('^script:has-text(adblock)'),
                        },
                        ...context.getFullRange(),
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
                            ...context.getRangeFor('#@#'),
                        },
                        body: {
                            type: 'Value',
                            value: '^script:has-text(adblock)',
                            ...context.getRangeFor('^script:has-text(adblock)'),
                        },
                        ...context.getFullRange(),
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

            expect(CosmeticRuleGenerator.generate(ruleNode)).toBe(expected);
        });
    });
});
