import { describe, test, expect } from 'vitest';

import { NodeExpectContext, type NodeExpectFn } from '../../helpers/node-utils.js';
import { CosmeticRuleType, RuleCategory, type CssInjectionRule } from '../../../src/nodes/index.js';
import { CosmeticRuleParser } from '../../../src/parser/cosmetic/cosmetic-rule-parser.js';
import { DomainListParser } from '../../../src/parser/misc/domain-list-parser.js';
import { CosmeticRuleGenerator } from '../../../src/generator/cosmetic/index.js';
import { AdblockSyntax } from '../../../src/utils/adblockers.js';

describe('CosmeticRuleParser', () => {
    describe('CosmeticRuleParser.parse - valid AdGuard CSS injection rules', () => {
        test.each<{ actual: string; expected: NodeExpectFn<CssInjectionRule> }>([
            // generic cosmetic rule - without domains
            {
                actual: '#$#body { padding: 0; }',
                expected: (context: NodeExpectContext): CssInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.CssInjectionRule,
                        syntax: AdblockSyntax.Adg,
                        exception: false,
                        modifiers: undefined,
                        domains: DomainListParser.parse(''),
                        separator: {
                            type: 'Value',
                            value: '#$#',
                            ...context.getRangeFor('#$#'),
                        },
                        body: {
                            type: 'CssInjectionRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: 'body',
                                ...context.getRangeFor('body'),
                            },
                            declarationList: {
                                type: 'Value',
                                value: 'padding: 0;',
                                ...context.getRangeFor('padding: 0;'),
                            },
                            ...context.getRangeFor('body { padding: 0; }'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
            // with media query list
            {
                actual: '#$#@media (min-height: 1024px) and (max-height: 1920px) { body { padding: 0; } }',
                expected: (context: NodeExpectContext): CssInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.CssInjectionRule,
                        syntax: AdblockSyntax.Adg,
                        exception: false,
                        modifiers: undefined,
                        domains: DomainListParser.parse(''),
                        separator: {
                            type: 'Value',
                            value: '#$#',
                            ...context.getRangeFor('#$#'),
                        },
                        body: {
                            type: 'CssInjectionRuleBody',
                            mediaQueryList: {
                                type: 'Value',
                                value: '(min-height: 1024px) and (max-height: 1920px)',
                                ...context.getRangeFor('(min-height: 1024px) and (max-height: 1920px)'),
                            },
                            selectorList: {
                                type: 'Value',
                                value: 'body',
                                ...context.getRangeFor('body'),
                            },
                            declarationList: {
                                type: 'Value',
                                value: 'padding: 0;',
                                ...context.getRangeFor('padding: 0;'),
                            },
                            // eslint-disable-next-line max-len
                            ...context.getRangeFor('@media (min-height: 1024px) and (max-height: 1920px) { body { padding: 0; } }'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
            // exception rule
            {
                actual: '#@$#body { padding: 0; }',
                expected: (context: NodeExpectContext): CssInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.CssInjectionRule,
                        syntax: AdblockSyntax.Adg,
                        exception: true,
                        modifiers: undefined,
                        domains: DomainListParser.parse(''),
                        separator: {
                            type: 'Value',
                            value: '#@$#',
                            ...context.getRangeFor('#@$#'),
                        },
                        body: {
                            type: 'CssInjectionRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: 'body',
                                ...context.getRangeFor('body'),
                            },
                            declarationList: {
                                type: 'Value',
                                value: 'padding: 0;',
                                ...context.getRangeFor('padding: 0;'),
                            },
                            ...context.getRangeFor('body { padding: 0; }'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },

            // specific cosmetic rule - with domains
            {
                actual: 'example.com,~example.net#$#body { padding: 0; }',
                expected: (context: NodeExpectContext): CssInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.CssInjectionRule,
                        syntax: AdblockSyntax.Adg,
                        exception: false,
                        modifiers: undefined,
                        domains: DomainListParser.parse('example.com,~example.net'),
                        separator: {
                            type: 'Value',
                            value: '#$#',
                            ...context.getRangeFor('#$#'),
                        },
                        body: {
                            type: 'CssInjectionRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: 'body',
                                ...context.getRangeFor('body'),
                            },
                            declarationList: {
                                type: 'Value',
                                value: 'padding: 0;',
                                ...context.getRangeFor('padding: 0;'),
                            },
                            ...context.getRangeFor('body { padding: 0; }'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
            // with media query list
            {
                // eslint-disable-next-line max-len
                actual: 'example.com,~example.net#$#@media (min-height: 1024px) and (max-height: 1920px) { body { padding: 0; } }',
                expected: (context: NodeExpectContext): CssInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.CssInjectionRule,
                        syntax: AdblockSyntax.Adg,
                        exception: false,
                        modifiers: undefined,
                        domains: DomainListParser.parse('example.com,~example.net'),
                        separator: {
                            type: 'Value',
                            value: '#$#',
                            ...context.getRangeFor('#$#'),
                        },
                        body: {
                            type: 'CssInjectionRuleBody',
                            mediaQueryList: {
                                type: 'Value',
                                value: '(min-height: 1024px) and (max-height: 1920px)',
                                ...context.getRangeFor('(min-height: 1024px) and (max-height: 1920px)'),
                            },
                            selectorList: {
                                type: 'Value',
                                value: 'body',
                                ...context.getRangeFor('body'),
                            },
                            declarationList: {
                                type: 'Value',
                                value: 'padding: 0;',
                                ...context.getRangeFor('padding: 0;'),
                            },
                            // eslint-disable-next-line max-len
                            ...context.getRangeFor('@media (min-height: 1024px) and (max-height: 1920px) { body { padding: 0; } }'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
            // exception rule
            {
                actual: 'example.com,~example.net#@$#body { padding: 0; }',
                expected: (context: NodeExpectContext): CssInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.CssInjectionRule,
                        syntax: AdblockSyntax.Adg,
                        exception: true,
                        modifiers: undefined,
                        domains: DomainListParser.parse('example.com,~example.net'),
                        separator: {
                            type: 'Value',
                            value: '#@$#',
                            ...context.getRangeFor('#@$#'),
                        },
                        body: {
                            type: 'CssInjectionRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: 'body',
                                ...context.getRangeFor('body'),
                            },
                            declarationList: {
                                type: 'Value',
                                value: 'padding: 0;',
                                ...context.getRangeFor('padding: 0;'),
                            },
                            ...context.getRangeFor('body { padding: 0; }'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
        ])("should parse '$actual'", ({ actual, expected: expectedFn }) => {
            expect(CosmeticRuleParser.parse(actual)).toMatchObject(expectedFn(new NodeExpectContext(actual)));
        });
    });

    describe('CosmeticRuleParser.generate - AdGuard CSS injection rules', () => {
        test.each<{ actual: string; expected: string }>([
            // simple cases - without domains
            {
                actual: '#$?#body { padding: 0; }',
                expected: '#$?#body { padding: 0; }',
            },
            {
                actual: '#@$?#body { padding: 0; }',
                expected: '#@$?#body { padding: 0; }',
            },

            // media query list - without domains
            {
                // eslint-disable-next-line max-len
                actual: '#$?#@media (min-height: 1024px) and (max-height: 1920px) { body { padding: 0; } }',
                // eslint-disable-next-line max-len
                expected: '#$?#@media (min-height: 1024px) and (max-height: 1920px) { body { padding: 0; } }',
            },
            {
                // eslint-disable-next-line max-len
                actual: '#@$?#@media (min-height: 1024px) and (max-height: 1920px) { body { padding: 0; } }',
                // eslint-disable-next-line max-len
                expected: '#@$?#@media (min-height: 1024px) and (max-height: 1920px) { body { padding: 0; } }',
            },

            // simple cases - with domains
            {
                actual: 'example.com,~example.net#$?#body { padding: 0; }',
                expected: 'example.com,~example.net#$?#body { padding: 0; }',
            },
            {
                actual: 'example.com,~example.net#@$?#body { padding: 0; }',
                expected: 'example.com,~example.net#@$?#body { padding: 0; }',
            },

            // media query list - with domains
            {
                // eslint-disable-next-line max-len
                actual: 'example.com,~example.net#$?#@media (min-height: 1024px) and (max-height: 1920px) { body { padding: 0; } }',
                // eslint-disable-next-line max-len
                expected: 'example.com,~example.net#$?#@media (min-height: 1024px) and (max-height: 1920px) { body { padding: 0; } }',
            },
            {
                // eslint-disable-next-line max-len
                actual: 'example.com,~example.net#@$?#@media (min-height: 1024px) and (max-height: 1920px) { body { padding: 0; } }',
                // eslint-disable-next-line max-len
                expected: 'example.com,~example.net#@$?#@media (min-height: 1024px) and (max-height: 1920px) { body { padding: 0; } }',
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
