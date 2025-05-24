import {
    describe,
    test,
    expect,
    vi,
} from 'vitest';
import { sprintf } from 'sprintf-js';
import { getFormattedTokenName, TokenType } from '@adguard/css-tokenizer';

import { NodeExpectContext, type NodeExpectFn } from '../../helpers/node-utils.js';
import {
    CosmeticRuleType,
    RuleCategory,
    type CssInjectionRule,
    type ElementHidingRule,
} from '../../../src/nodes/index.js';
import { CosmeticRuleGenerator } from '../../../src/generator/cosmetic/cosmetic-rule-generator.js';
import { CosmeticRuleParser } from '../../../src/parser/cosmetic/cosmetic-rule-parser.js';
import { AdblockSyntax } from '../../../src/utils/adblockers.js';
import { DomainListParser } from '../../../src/parser/misc/domain-list-parser.js';
import { AdblockSyntaxError } from '../../../src/errors/adblock-syntax-error.js';
import { ERROR_MESSAGES as CSS_TOKEN_STREAM_ERROR_MESSAGES, END_OF_INPUT } from '../../../src/parser/css/constants.js';

describe('CosmeticRuleParser', () => {
    describe('CosmeticRuleParser.parse - valid AdblockPlus CSS injection rules', () => {
        test.each<{ actual: string; expected: NodeExpectFn<ElementHidingRule | CssInjectionRule> }>([
            // generic cosmetic rule - without domains
            {
                actual: '##div { display: none !important; }',
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
                                value: 'div',
                                ...context.getRangeFor('div'),
                            },
                            declarationList: {
                                type: 'Value',
                                value: 'display: none !important;',
                                ...context.getRangeFor('display: none !important;'),
                            },
                            ...context.getRangeFor('div { display: none !important; }'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
            {
                actual: '#@#div { display: none !important; }',
                expected: (context: NodeExpectContext): CssInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.CssInjectionRule,
                        syntax: AdblockSyntax.Abp,
                        exception: true,
                        modifiers: undefined,
                        domains: DomainListParser.parse(''),
                        separator: {
                            type: 'Value',
                            value: '#@#',
                            ...context.getRangeFor('#@#'),
                        },
                        body: {
                            type: 'CssInjectionRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: 'div',
                                ...context.getRangeFor('div'),
                            },
                            declarationList: {
                                type: 'Value',
                                value: 'display: none !important;',
                                ...context.getRangeFor('display: none !important;'),
                            },
                            ...context.getRangeFor('div { display: none !important; }'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
            {
                actual: '##.banner { remove: true; }',
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
                            declarationList: {
                                type: 'Value',
                                value: 'remove: true;',
                                ...context.getRangeFor('remove: true;'),
                            },
                            ...context.getRangeFor('.banner { remove: true; }'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
            {
                actual: '#@#.banner { remove: true; }',
                expected: (context: NodeExpectContext): CssInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.CssInjectionRule,
                        syntax: AdblockSyntax.Abp,
                        exception: true,
                        modifiers: undefined,
                        domains: DomainListParser.parse(''),
                        separator: {
                            type: 'Value',
                            value: '#@#',
                            ...context.getRangeFor('#@#'),
                        },
                        body: {
                            type: 'CssInjectionRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: '.banner',
                                ...context.getRangeFor('.banner'),
                            },
                            declarationList: {
                                type: 'Value',
                                value: 'remove: true;',
                                ...context.getRangeFor('remove: true;'),
                            },
                            ...context.getRangeFor('.banner { remove: true; }'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
            {
                actual: '#?#.banner:has(.foo) { display: none !important; }',
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
                            value: '#?#',
                            ...context.getRangeFor('#?#'),
                        },
                        body: {
                            type: 'CssInjectionRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: '.banner:has(.foo)',
                                ...context.getRangeFor('.banner:has(.foo)'),
                            },
                            declarationList: {
                                type: 'Value',
                                value: 'display: none !important;',
                                ...context.getRangeFor('display: none !important;'),
                            },
                            ...context.getRangeFor('.banner:has(.foo) { display: none !important; }'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
            {
                actual: '#@?#.banner:has(.foo) { display: none !important; }',
                expected: (context: NodeExpectContext): CssInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.CssInjectionRule,
                        syntax: AdblockSyntax.Abp,
                        exception: true,
                        modifiers: undefined,
                        domains: DomainListParser.parse(''),
                        separator: {
                            type: 'Value',
                            value: '#@?#',
                            ...context.getRangeFor('#@?#'),
                        },
                        body: {
                            type: 'CssInjectionRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: '.banner:has(.foo)',
                                ...context.getRangeFor('.banner:has(.foo)'),
                            },
                            declarationList: {
                                type: 'Value',
                                value: 'display: none !important;',
                                ...context.getRangeFor('display: none !important;'),
                            },
                            ...context.getRangeFor('.banner:has(.foo) { display: none !important; }'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
            {
                actual: '#?#.banner:contains({) { display: none !important; }',
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
                            value: '#?#',
                            ...context.getRangeFor('#?#'),
                        },
                        body: {
                            type: 'CssInjectionRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: '.banner:contains({)',
                                ...context.getRangeFor('.banner:contains({)'),
                            },
                            declarationList: {
                                type: 'Value',
                                value: 'display: none !important;',
                                ...context.getRangeFor('display: none !important;'),
                            },
                            ...context.getRangeFor('.banner:contains({) { display: none !important; }'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
            {
                actual: '#@?#.banner:contains({) { display: none !important; }',
                expected: (context: NodeExpectContext): CssInjectionRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.CssInjectionRule,
                        syntax: AdblockSyntax.Abp,
                        exception: true,
                        modifiers: undefined,
                        domains: DomainListParser.parse(''),
                        separator: {
                            type: 'Value',
                            value: '#@?#',
                            ...context.getRangeFor('#@?#'),
                        },
                        body: {
                            type: 'CssInjectionRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: '.banner:contains({)',
                                ...context.getRangeFor('.banner:contains({)'),
                            },
                            declarationList: {
                                type: 'Value',
                                value: 'display: none !important;',
                                ...context.getRangeFor('display: none !important;'),
                            },
                            ...context.getRangeFor('.banner:contains({) { display: none !important; }'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
            {
                actual: '##.banner { padding: 10px !important; background: black !important; }',
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
                            declarationList: {
                                type: 'Value',
                                value: 'padding: 10px !important; background: black !important;',
                                ...context.getRangeFor('padding: 10px !important; background: black !important;'),
                            },
                            ...context.getRangeFor(
                                '.banner { padding: 10px !important; background: black !important; }',
                            ),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
            {
                actual: '##div[class^="foo{"]',
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
                            ...context.getRangeFor('##'),
                        },
                        body: {
                            type: 'ElementHidingRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: 'div[class^="foo{"]',
                                ...context.getRangeFor('div[class^="foo{"]'),
                            },
                            ...context.getRangeFor('div[class^="foo{"]'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
            {
                actual: '#@#div[class^="foo{"]',
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
                            ...context.getRangeFor('#@#'),
                        },
                        body: {
                            type: 'ElementHidingRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: 'div[class^="foo{"]',
                                ...context.getRangeFor('div[class^="foo{"]'),
                            },
                            ...context.getRangeFor('div[class^="foo{"]'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
            {
                actual: '#?#.foo:contains({)',
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
                                value: '.foo:contains({)',
                                ...context.getRangeFor('.foo:contains({)'),
                            },
                            ...context.getRangeFor('.foo:contains({)'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
            {
                actual: '#?#.foo[class^="foo{"][href*="}"]',
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
                                value: '.foo[class^="foo{"][href*="}"]',
                                ...context.getRangeFor('.foo[class^="foo{"][href*="}"]'),
                            },
                            ...context.getRangeFor('.foo[class^="foo{"][href*="}"]'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
        ])("should parse '$actual'", ({ actual, expected: expectedFn }) => {
            expect(CosmeticRuleParser.parse(actual)).toMatchObject(expectedFn(new NodeExpectContext(actual)));
        });
    });

    describe('CosmeticRuleParser.generate - AdblockPlus CSS injection rules', () => {
        test.each<{ actual: string; expected: string }>([
            // simple cases - without domains
            {
                actual: '##div { display: none !important; }',
                expected: '##div { display: none !important; }',
            },
            {
                actual: '#@#div { display: none !important; }',
                expected: '#@#div { display: none !important; }',
            },
            {
                actual: '##.banner { remove: true; }',
                expected: '##.banner { remove: true; }',
            },
            {
                actual: '#@#.banner { remove: true; }',
                expected: '#@#.banner { remove: true; }',
            },
            {
                actual: '#?#.banner:has(.foo) { display: none !important; }',
                expected: '#?#.banner:has(.foo) { display: none !important; }',
            },
            {
                actual: '#@?#.banner:has(.foo) { display: none !important; }',
                expected: '#@?#.banner:has(.foo) { display: none !important; }',
            },
            {
                actual: '#?#.banner:contains({) { display: none !important; }',
                expected: '#?#.banner:contains({) { display: none !important; }',
            },
            {
                actual: '#@?#.banner:contains({) { display: none !important; }',
                expected: '#@?#.banner:contains({) { display: none !important; }',
            },
            {
                actual: '##.banner { padding: 10px !important; background: black !important; }',
                expected: '##.banner { padding: 10px !important; background: black !important; }',
            },
            {
                actual: '##div[class^="foo{"]',
                expected: '##div[class^="foo{"]',
            },
            {
                actual: '#@#div[class^="foo{"]',
                expected: '#@#div[class^="foo{"]',
            },
            {
                actual: '#?#.foo:contains({)',
                expected: '#?#.foo:contains({)',
            },
        ])("should generate '$expected' from '$actual'", ({ actual, expected }) => {
            const ruleNode = CosmeticRuleParser.parse(actual);

            if (ruleNode === null) {
                throw new Error(`Failed to parse '${actual}' as cosmetic rule`);
            }

            expect(CosmeticRuleGenerator.generate(ruleNode)).toBe(expected);
        });
    });

    describe('AdgScriptletInjectionBodyParser.parse - invalid cases', () => {
        test.each<{ actual: string; expected: NodeExpectFn<AdblockSyntaxError> }>([
            {
                actual: String.raw`##div { display: none !important`,
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        "Expected '<}-token>', but got 'end of input'",
                        ...context.toTuple(context.getLastSlotRange()),
                    );
                },
            },
            {
                actual: String.raw`#@#div { display: none !important`,
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(
                            CSS_TOKEN_STREAM_ERROR_MESSAGES.EXPECTED_TOKEN_BUT_GOT,
                            getFormattedTokenName(TokenType.CloseCurlyBracket),
                            END_OF_INPUT,
                        ),
                        ...context.toTuple(context.getLastSlotRange()),
                    );
                },
            },
            {
                actual: String.raw`#@#div display: none !important }`,
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        "Expected '<unknown-token>', but got '<}-token>'",
                        ...context.toTuple(context.getLastSlotRange()),
                    );
                },
            },
            {
                actual: String.raw`##div display: none !important }`,
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        "Expected '<unknown-token>', but got '<}-token>'",
                        ...context.toTuple(context.getLastSlotRange()),
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
            expect(error).toHaveProperty('start', (expected.start));
            expect(error).toHaveProperty('end', expected.end);
        });
    });
});
