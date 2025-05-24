import {
    describe,
    test,
    expect,
    vi,
} from 'vitest';
import { sprintf } from 'sprintf-js';

import { NodeExpectContext, type NodeExpectFn } from '../../helpers/node-utils.js';
import { CosmeticRuleType, RuleCategory, type CssInjectionRule } from '../../../src/nodes/index.js';
import { CosmeticRuleParser, ERROR_MESSAGES } from '../../../src/parser/cosmetic/cosmetic-rule-parser.js';
import { AdblockSyntax } from '../../../src/utils/adblockers.js';
import { DomainListParser } from '../../../src/parser/misc/domain-list-parser.js';
import { AdblockSyntaxError } from '../../../src/errors/adblock-syntax-error.js';
import { CosmeticRuleGenerator } from '../../../src/generator/cosmetic/index.js';

describe('CosmeticRuleParser', () => {
    describe('CosmeticRuleParser.parse - valid AdGuard CSS injection rules with extended CSS', () => {
        test.each<{ actual: string; expected: NodeExpectFn<CssInjectionRule> }>([
            // generic cosmetic rule - without domains
            {
                actual: '#$?#body:-abp-has(.ad) { padding: 0; }',
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
                            value: '#$?#',
                            ...context.getRangeFor('#$?#'),
                        },
                        body: {
                            type: 'CssInjectionRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: 'body:-abp-has(.ad)',
                                ...context.getRangeFor('body:-abp-has(.ad)'),
                            },
                            declarationList: {
                                type: 'Value',
                                value: 'padding: 0;',
                                ...context.getRangeFor('padding: 0;'),
                            },
                            ...context.getRangeFor('body:-abp-has(.ad) { padding: 0; }'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
            // with media query list
            {
                // eslint-disable-next-line max-len
                actual: '#$?#@media (min-height: 1024px) and (max-height: 1920px) { body:-abp-has(.ad) { padding: 0; } }',
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
                            value: '#$?#',
                            ...context.getRangeFor('#$?#'),
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
                                value: 'body:-abp-has(.ad)',
                                ...context.getRangeFor('body:-abp-has(.ad)'),
                            },
                            declarationList: {
                                type: 'Value',
                                value: 'padding: 0;',
                                ...context.getRangeFor('padding: 0;'),
                            },
                            // eslint-disable-next-line max-len
                            ...context.getRangeFor('@media (min-height: 1024px) and (max-height: 1920px) { body:-abp-has(.ad) { padding: 0; } }'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
            // exception rule
            {
                actual: '#@$?#body:-abp-has(.ad) { padding: 0; }',
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
                            value: '#@$?#',
                            ...context.getRangeFor('#@$?#'),
                        },
                        body: {
                            type: 'CssInjectionRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: 'body:-abp-has(.ad)',
                                ...context.getRangeFor('body:-abp-has(.ad)'),
                            },
                            declarationList: {
                                type: 'Value',
                                value: 'padding: 0;',
                                ...context.getRangeFor('padding: 0;'),
                            },
                            ...context.getRangeFor('body:-abp-has(.ad) { padding: 0; }'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },

            // specific cosmetic rule - with domains
            {
                actual: 'example.com,~example.net#$?#body:-abp-has(.ad) { padding: 0; }',
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
                            value: '#$?#',
                            ...context.getRangeFor('#$?#'),
                        },
                        body: {
                            type: 'CssInjectionRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: 'body:-abp-has(.ad)',
                                ...context.getRangeFor('body:-abp-has(.ad)'),
                            },
                            declarationList: {
                                type: 'Value',
                                value: 'padding: 0;',
                                ...context.getRangeFor('padding: 0;'),
                            },
                            ...context.getRangeFor('body:-abp-has(.ad) { padding: 0; }'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
            // with media query list
            {
                // eslint-disable-next-line max-len
                actual: 'example.com,~example.net#$?#@media (min-height: 1024px) and (max-height: 1920px) { body:-abp-has(.ad) { padding: 0; } }',
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
                            value: '#$?#',
                            ...context.getRangeFor('#$?#'),
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
                                value: 'body:-abp-has(.ad)',
                                ...context.getRangeFor('body:-abp-has(.ad)'),
                            },
                            declarationList: {
                                type: 'Value',
                                value: 'padding: 0;',
                                ...context.getRangeFor('padding: 0;'),
                            },
                            // eslint-disable-next-line max-len
                            ...context.getRangeFor('@media (min-height: 1024px) and (max-height: 1920px) { body:-abp-has(.ad) { padding: 0; } }'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
            // exception rule
            {
                actual: 'example.com,~example.net#@$?#body:-abp-has(.ad) { padding: 0; }',
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
                            value: '#@$?#',
                            ...context.getRangeFor('#@$?#'),
                        },
                        body: {
                            type: 'CssInjectionRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: 'body:-abp-has(.ad)',
                                ...context.getRangeFor('body:-abp-has(.ad)'),
                            },
                            declarationList: {
                                type: 'Value',
                                value: 'padding: 0;',
                                ...context.getRangeFor('padding: 0;'),
                            },
                            ...context.getRangeFor('body:-abp-has(.ad) { padding: 0; }'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
        ])("should parse '$actual'", ({ actual, expected: expectedFn }) => {
            expect(CosmeticRuleParser.parse(actual)).toMatchObject(expectedFn(new NodeExpectContext(actual)));
        });
    });

    describe('CosmeticRuleParser.parse - invalid AdGuard CSS injection rules', () => {
        test.each<{ actual: string; expected: NodeExpectFn<AdblockSyntaxError> }>([
            // ABP-snippet with Extended CSS separator
            {
                actual: '#$?#abp-snippet',
                //           ~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(ERROR_MESSAGES.INVALID_BODY_FOR_SEPARATOR, 'abp-snippet', '#$?#'),
                        ...context.toTuple(context.getRangeFor('abp-snippet')),
                    );
                },
            },
            {
                actual: '#@$?#abp-snippet',
                //            ~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(ERROR_MESSAGES.INVALID_BODY_FOR_SEPARATOR, 'abp-snippet', '#@$?#'),
                        ...context.toTuple(context.getRangeFor('abp-snippet')),
                    );
                },
            },
        ])("should throw on input: '$actual'", ({ actual, expected: expectedFn }) => {
            const fn = vi.fn(() => CosmeticRuleParser.parse(actual));

            // parse should throw
            expect(fn).toThrow();

            const expected = expectedFn(new NodeExpectContext(actual));

            // check the thrown error
            const error = fn.mock.results[0].value;
            expect(error).toBeInstanceOf(AdblockSyntaxError);
            expect(error).toHaveProperty('message', expected.message);
            expect(error).toHaveProperty('start', expected.start);
            expect(error).toHaveProperty('end', expected.end);
        });
    });

    describe('CosmeticRuleParser.generate - AdGuard CSS injection rules with extended CSS', () => {
        test.each<{ actual: string; expected: string }>([
            // simple cases - without domains
            {
                actual: '#$?#body:-abp-has(.ad) { padding: 0; }',
                expected: '#$?#body:-abp-has(.ad) { padding: 0; }',
            },
            {
                actual: '#@$?#body:-abp-has(.ad) { padding: 0; }',
                expected: '#@$?#body:-abp-has(.ad) { padding: 0; }',
            },

            // media query list - without domains
            {
                // eslint-disable-next-line max-len
                actual: '#$?#@media (min-height: 1024px) and (max-height: 1920px) { body:-abp-has(.ad) { padding: 0; } }',
                // eslint-disable-next-line max-len
                expected: '#$?#@media (min-height: 1024px) and (max-height: 1920px) { body:-abp-has(.ad) { padding: 0; } }',
            },
            {
                // eslint-disable-next-line max-len
                actual: '#@$?#@media (min-height: 1024px) and (max-height: 1920px) { body:-abp-has(.ad) { padding: 0; } }',
                // eslint-disable-next-line max-len
                expected: '#@$?#@media (min-height: 1024px) and (max-height: 1920px) { body:-abp-has(.ad) { padding: 0; } }',
            },

            // simple cases - with domains
            {
                actual: 'example.com,~example.net#$?#body:-abp-has(.ad) { padding: 0; }',
                expected: 'example.com,~example.net#$?#body:-abp-has(.ad) { padding: 0; }',
            },
            {
                actual: 'example.com,~example.net#@$?#body:-abp-has(.ad) { padding: 0; }',
                expected: 'example.com,~example.net#@$?#body:-abp-has(.ad) { padding: 0; }',
            },

            // media query list - with domains
            {
                // eslint-disable-next-line max-len
                actual: 'example.com,~example.net#$?#@media (min-height: 1024px) and (max-height: 1920px) { body:-abp-has(.ad) { padding: 0; } }',
                // eslint-disable-next-line max-len
                expected: 'example.com,~example.net#$?#@media (min-height: 1024px) and (max-height: 1920px) { body:-abp-has(.ad) { padding: 0; } }',
            },
            {
                // eslint-disable-next-line max-len
                actual: 'example.com,~example.net#@$?#@media (min-height: 1024px) and (max-height: 1920px) { body:-abp-has(.ad) { padding: 0; } }',
                // eslint-disable-next-line max-len
                expected: 'example.com,~example.net#@$?#@media (min-height: 1024px) and (max-height: 1920px) { body:-abp-has(.ad) { padding: 0; } }',
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
