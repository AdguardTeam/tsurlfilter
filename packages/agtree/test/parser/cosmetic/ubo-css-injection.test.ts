import { NodeExpectContext, type NodeExpectFn } from '../../helpers/node-utils';
import { CosmeticRuleType, RuleCategory, type CssInjectionRule } from '../../../src/parser/common';
import { CosmeticRuleParser } from '../../../src/parser/cosmetic';
import { AdblockSyntax } from '../../../src/utils/adblockers';
import { DomainListParser } from '../../../src/parser/misc/domain-list';

describe('CosmeticRuleParser', () => {
    describe('CosmeticRuleParser.parse - valid uBlock CSS injection rules', () => {
        test.each<{ actual: string; expected: NodeExpectFn<CssInjectionRule> }>([
            // generic cosmetic rule - without domains
            {
                actual: '##body:style(padding: 0;)',
                expected: (context: NodeExpectContext): CssInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.CssInjectionRule,
                        syntax: AdblockSyntax.Ubo,
                        exception: false,
                        domains: DomainListParser.parse(''),
                        separator: {
                            type: 'Value',
                            value: '##',
                            loc: context.getLocRangeFor('##'),
                        },
                        body: {
                            type: 'CssInjectionRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: 'body',
                                loc: context.getLocRangeFor('body:style(padding: 0;)'),
                            },
                            declarationList: {
                                type: 'Value',
                                value: 'padding: 0;',
                                loc: context.getLocRangeFor('padding: 0;'),
                            },
                            loc: context.getLocRangeFor('body:style(padding: 0;)'),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },
            // with media query list
            {
                // eslint-disable-next-line max-len
                actual: '##body > .container:has-text(/ad/):matches-media((min-width: 1024px) and (max-width: 1920px)):style(padding: 0 !important;)',
                expected: (context: NodeExpectContext): CssInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.CssInjectionRule,
                        syntax: AdblockSyntax.Ubo,
                        exception: false,
                        domains: DomainListParser.parse(''),
                        separator: {
                            type: 'Value',
                            value: '##',
                            loc: context.getLocRangeFor('##'),
                        },
                        body: {
                            type: 'CssInjectionRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: 'body > .container:has-text(/ad/)',
                                // eslint-disable-next-line max-len
                                loc: context.getLocRangeFor('body > .container:has-text(/ad/):matches-media((min-width: 1024px) and (max-width: 1920px)):style(padding: 0 !important;)'),
                            },
                            mediaQueryList: {
                                type: 'Value',
                                value: '(min-width: 1024px) and (max-width: 1920px)',
                                loc: context.getLocRangeFor('(min-width: 1024px) and (max-width: 1920px)'),
                            },
                            declarationList: {
                                type: 'Value',
                                value: 'padding: 0 !important;',
                                loc: context.getLocRangeFor('padding: 0 !important;'),
                            },
                            // eslint-disable-next-line max-len
                            loc: context.getLocRangeFor('body > .container:has-text(/ad/):matches-media((min-width: 1024px) and (max-width: 1920px)):style(padding: 0 !important;)'),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },
            // exception rule
            {
                actual: '#@#body:style(padding: 0;)',
                expected: (context: NodeExpectContext): CssInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.CssInjectionRule,
                        syntax: AdblockSyntax.Ubo,
                        exception: true,
                        domains: DomainListParser.parse(''),
                        separator: {
                            type: 'Value',
                            value: '#@#',
                            loc: context.getLocRangeFor('#@#'),
                        },
                        body: {
                            type: 'CssInjectionRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: 'body',
                                loc: context.getLocRangeFor('body:style(padding: 0;)'),
                            },
                            declarationList: {
                                type: 'Value',
                                value: 'padding: 0;',
                                loc: context.getLocRangeFor('padding: 0;'),
                            },
                            loc: context.getLocRangeFor('body:style(padding: 0;)'),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },

            // complicated case
            {
                // eslint-disable-next-line max-len
                actual: 'example.com,~example.net#@#:matches-path(/something) body > .container:has-text(/ad/):matches-media((min-width: 1024px) and (max-width: 1920px)):style(padding: 0 !important;)',
                expected: (context: NodeExpectContext): CssInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.CssInjectionRule,
                        syntax: AdblockSyntax.Ubo,
                        exception: true,
                        domains: DomainListParser.parse('example.com,~example.net'),
                        modifiers: {
                            type: 'ModifierList',
                            children: [
                                {
                                    type: 'Modifier',
                                    name: {
                                        type: 'Value',
                                        value: 'matches-path',
                                        loc: context.getLocRangeFor('matches-path'),
                                    },
                                    value: {
                                        type: 'Value',
                                        value: '/something',
                                        loc: context.getLocRangeFor('/something'),
                                    },
                                },
                            ],
                        },
                        separator: {
                            type: 'Value',
                            value: '#@#',
                            loc: context.getLocRangeFor('#@#'),
                        },
                        body: {
                            type: 'CssInjectionRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: 'body > .container:has-text(/ad/)',
                                // eslint-disable-next-line max-len
                                loc: context.getLocRangeFor(':matches-path(/something) body > .container:has-text(/ad/):matches-media((min-width: 1024px) and (max-width: 1920px)):style(padding: 0 !important;)'),
                            },
                            mediaQueryList: {
                                type: 'Value',
                                value: '(min-width: 1024px) and (max-width: 1920px)',
                                loc: context.getLocRangeFor('(min-width: 1024px) and (max-width: 1920px)'),
                            },
                            declarationList: {
                                type: 'Value',
                                value: 'padding: 0 !important;',
                                loc: context.getLocRangeFor('padding: 0 !important;'),
                            },
                            // eslint-disable-next-line max-len
                            loc: context.getLocRangeFor(':matches-path(/something) body > .container:has-text(/ad/):matches-media((min-width: 1024px) and (max-width: 1920px)):style(padding: 0 !important;)'),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },
        ])("should parse '$actual'", ({ actual, expected: expectedFn }) => {
            expect(CosmeticRuleParser.parse(actual)).toMatchObject(expectedFn(new NodeExpectContext(actual)));
        });
    });

    describe('CosmeticRuleParser.generate - uBlock CSS injection rules', () => {
        test.each<{ actual: string; expected: string }>([
            // simple cases - without domains
            {
                actual: '##body:style(padding: 0;)',
                expected: '##body:style(padding: 0;)',
            },
            {
                actual: '#@#body:style(padding: 0;)',
                expected: '#@#body:style(padding: 0;)',
            },

            // media query list - without domains
            {
                // eslint-disable-next-line max-len
                actual: '##body > .container:has-text(/ad/):matches-media((min-width: 1024px) and (max-width: 1920px)):style(padding: 0 !important;)',
                // Note: matches-media() moved to the beginning
                // eslint-disable-next-line max-len
                expected: '##:matches-media((min-width: 1024px) and (max-width: 1920px)) body > .container:has-text(/ad/):style(padding: 0 !important;)',
            },

            // complicated case
            {
                // eslint-disable-next-line max-len
                actual: 'example.com,~example.net#@#:matches-path(/something) body > .container:has-text(/ad/):matches-media((min-width: 1024px) and (max-width: 1920px)):style(padding: 0 !important;)',
                // Note: matches-media() moved to the beginning
                // eslint-disable-next-line max-len
                expected: 'example.com,~example.net#@#:matches-path(/something) :matches-media((min-width: 1024px) and (max-width: 1920px)) body > .container:has-text(/ad/):style(padding: 0 !important;)',
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
