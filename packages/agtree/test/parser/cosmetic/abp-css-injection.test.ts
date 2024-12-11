import { NodeExpectContext, type NodeExpectFn } from '../../helpers/node-utils';
import { CosmeticRuleType, RuleCategory, type CssInjectionRule } from '../../../src/parser/common';
import { CosmeticRuleParser } from '../../../src/parser/cosmetic';
import { AdblockSyntax } from '../../../src/utils/adblockers';
import { DomainListParser } from '../../../src/parser/misc/domain-list';

describe('CosmeticRuleParser', () => {
    describe('CosmeticRuleParser.parse - valid Adblock Plus snippet injection rules', () => {
        test.each<{ actual: string; expected: NodeExpectFn<CssInjectionRule> }>([
            // single snippets - without domains
            {
                actual: '##.banner { display: none !important;}',
                expected: (context: NodeExpectContext): CssInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.CssInjectionRule,
                        syntax: AdblockSyntax.Abp,
                        exception: false,
                        modifiers: undefined,
                        domains: DomainListParser.parse(''),
                        separator: {
                            type: 'Value',
                            value: '##',
                            ...context.getRangeFor('##'),
                        },
                        body: {
                            type: 'CssInjectionRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: '.banner',
                                ...context.getRangeFor('.banner'),
                            },
                        },
                        ...context.getFullRange(),
                    };
                },
            },
            {
                actual: '##.banner { remove: true;}',
                expected: (context: NodeExpectContext): CssInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.CssInjectionRule,
                        syntax: AdblockSyntax.Abp,
                        exception: false,
                        modifiers: undefined,
                        domains: DomainListParser.parse(''),
                        separator: {
                            type: 'Value',
                            value: '##',
                            ...context.getRangeFor('##'),
                        },
                        body: {
                            type: 'CssInjectionRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: '.banner',
                                ...context.getRangeFor('.banner'),
                            },
                        },
                        ...context.getFullRange(),
                    };
                },
            },
        ])("should parse '$actual'", ({ actual, expected: expectedFn }) => {
            expect(CosmeticRuleParser.parse(actual)).toMatchObject(expectedFn(new NodeExpectContext(actual)));
        });
    });
});
