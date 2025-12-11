import { describe, test, expect } from 'vitest';

import { NodeExpectContext, type NodeExpectFn } from '../../helpers/node-utils';
import { CosmeticRuleType, RuleCategory, type HtmlFilteringRule } from '../../../src/nodes';
import { CosmeticRuleParser } from '../../../src/parser/cosmetic/cosmetic-rule-parser';
import { AdblockSyntax } from '../../../src/utils/adblockers';
import { DomainListParser } from '../../../src/parser/misc/domain-list-parser';
import { CosmeticRuleGenerator } from '../../../src/generator/cosmetic';
import {
    UboHtmlFilteringBodyParser,
} from '../../../src/parser/cosmetic/html-filtering-body/ubo-html-filtering-body-parser';
import { defaultParserOptions } from '../../../src/parser';

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
                        body: UboHtmlFilteringBodyParser.parse(
                            'script:has-text(adblock)',
                            defaultParserOptions,
                            '##^'.length,
                        ),
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
                        body: UboHtmlFilteringBodyParser.parse(
                            'script:has-text(adblock)',
                            defaultParserOptions,
                            '#@#^'.length,
                        ),
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
                        body: UboHtmlFilteringBodyParser.parse(
                            'script:has-text(adblock)',
                            defaultParserOptions,
                            'example.com,~example.net##^'.length,
                        ),
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
                        body: UboHtmlFilteringBodyParser.parse(
                            'script:has-text(adblock)',
                            defaultParserOptions,
                            'example.com,~example.net#@#^'.length,
                        ),
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
