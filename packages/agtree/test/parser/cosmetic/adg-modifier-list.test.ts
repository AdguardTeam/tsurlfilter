import {
    describe,
    test,
    expect,
    vi,
} from 'vitest';
import { sprintf } from 'sprintf-js';

import { AdblockSyntaxError } from '../../../src/errors/adblock-syntax-error';
import { NodeExpectContext, type NodeExpectFn } from '../../helpers/node-utils';
import { CosmeticRuleType, type ElementHidingRule, RuleCategory } from '../../../src/nodes';
import { AdblockSyntax } from '../../../src/utils/adblockers';
import { DomainListParser } from '../../../src/parser/misc/domain-list-parser';
import { CosmeticRuleParser, ERROR_MESSAGES } from '../../../src/parser/cosmetic/cosmetic-rule-parser';
import { CLOSE_SQUARE_BRACKET, DOLLAR_SIGN } from '../../../src/utils/constants';
import { defaultParserOptions } from '../../../src/parser/options';
import { CosmeticRuleGenerator } from '../../../src/generator/cosmetic';

describe('CosmeticRuleParser', () => {
    describe('CosmeticRuleParser.parse - valid usage of AdGuard modifier list', () => {
        test.each<{ actual: string; expected: NodeExpectFn<ElementHidingRule> }>([
            // generic cosmetic rule - without domains
            {
                actual: '[$path=/something]##.ad',
                expected: (context: NodeExpectContext): ElementHidingRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.ElementHidingRule,
                        syntax: AdblockSyntax.Adg,
                        exception: false,
                        domains: DomainListParser.parse('', defaultParserOptions, '[$path=/something]'.length),
                        modifiers: {
                            type: 'ModifierList',
                            children: [
                                {
                                    type: 'Modifier',
                                    name: {
                                        type: 'Value',
                                        value: 'path',
                                        ...context.getRangeFor('path'),
                                    },
                                    value: {
                                        type: 'Value',
                                        value: '/something',
                                        ...context.getRangeFor('/something'),
                                    },
                                },
                            ],
                            ...context.getRangeFor('[$path=/something]'),
                        },
                        separator: {
                            type: 'Value',
                            value: '##',
                            ...context.getRangeFor('##'),
                        },
                        body: {
                            type: 'ElementHidingRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: '.ad',
                                ...context.getRangeFor('.ad'),
                            },
                            ...context.getRangeFor('.ad'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },

            // modifier with regex which contains ] character - it shouldn't be treated as the end of the modifier list
            {
                actual: String.raw`[$domain=/example[0-9]\.(com|org)/]##.ad`,
                expected: (context: NodeExpectContext): ElementHidingRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.ElementHidingRule,
                        syntax: AdblockSyntax.Adg,
                        exception: false,
                        domains: DomainListParser.parse(
                            '',
                            defaultParserOptions,
                            String.raw`[$domain=/example[0-9]\.(com|org)/]`.length,
                        ),
                        modifiers: {
                            type: 'ModifierList',
                            children: [
                                {
                                    type: 'Modifier',
                                    name: {
                                        type: 'Value',
                                        value: 'domain',
                                        ...context.getRangeFor('domain'),
                                    },
                                    value: {
                                        type: 'Value',
                                        value: String.raw`/example[0-9]\.(com|org)/`,
                                        ...context.getRangeFor(String.raw`/example[0-9]\.(com|org)/`),
                                    },
                                },
                            ],
                            ...context.getRangeFor(String.raw`[$domain=/example[0-9]\.(com|org)/]`),
                        },
                        separator: {
                            type: 'Value',
                            value: '##',
                            ...context.getRangeFor('##'),
                        },
                        body: {
                            type: 'ElementHidingRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: '.ad',
                                ...context.getRangeFor('.ad'),
                            },
                            ...context.getRangeFor('.ad'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },

            // modifier with domain regexp containing commas in quantifiers - comma shouldn't split the regexp
            {
                actual: String.raw`[$domain=/example\d{1,}\.(com|org)/]##.ad`,
                expected: (context: NodeExpectContext): ElementHidingRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.ElementHidingRule,
                        syntax: AdblockSyntax.Adg,
                        exception: false,
                        domains: DomainListParser.parse(
                            '',
                            defaultParserOptions,
                            String.raw`[$domain=/example\d{1,}\.(com|org)/]`.length,
                        ),
                        modifiers: {
                            type: 'ModifierList',
                            children: [
                                {
                                    type: 'Modifier',
                                    name: {
                                        type: 'Value',
                                        value: 'domain',
                                        ...context.getRangeFor('domain'),
                                    },
                                    value: {
                                        type: 'Value',
                                        value: String.raw`/example\d{1,}\.(com|org)/`,
                                        ...context.getRangeFor(String.raw`/example\d{1,}\.(com|org)/`),
                                    },
                                },
                            ],
                            ...context.getRangeFor(String.raw`[$domain=/example\d{1,}\.(com|org)/]`),
                        },
                        separator: {
                            type: 'Value',
                            value: '##',
                            ...context.getRangeFor('##'),
                        },
                        body: {
                            type: 'ElementHidingRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: '.ad',
                                ...context.getRangeFor('.ad'),
                            },
                            ...context.getRangeFor('.ad'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },

            // modifier with complex regex containing multiple special characters and character classes with ]
            {
                // eslint-disable-next-line max-len
                actual: String.raw`[$path=/id]/^[a-z0-9]{5,}\.(?=.*[a-z])(?=.*[0-9])[a-z0-9]{17,}\.(cfd|sbs|shop)$/##.ad`,
                expected: (context: NodeExpectContext): ElementHidingRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.ElementHidingRule,
                        syntax: AdblockSyntax.Adg,
                        exception: false,
                        domains: DomainListParser.parse(
                            String.raw`/^[a-z0-9]{5,}\.(?=.*[a-z])(?=.*[0-9])[a-z0-9]{17,}\.(cfd|sbs|shop)$/`,
                            defaultParserOptions,
                            String.raw`[$path=/id]`.length,
                        ),
                        modifiers: {
                            type: 'ModifierList',
                            children: [
                                {
                                    type: 'Modifier',
                                    name: {
                                        type: 'Value',
                                        value: 'path',
                                        ...context.getRangeFor('path'),
                                    },
                                    value: {
                                        type: 'Value',
                                        value: '/id',
                                        ...context.getRangeFor('/id'),
                                    },
                                },
                            ],
                            ...context.getRangeFor('[$path=/id]'),
                        },
                        separator: {
                            type: 'Value',
                            value: '##',
                            ...context.getRangeFor('##'),
                        },
                        body: {
                            type: 'ElementHidingRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: '.ad',
                                ...context.getRangeFor('.ad'),
                            },
                            ...context.getRangeFor('.ad'),
                        },
                        ...context.getFullRange(),
                    };
                },
            },
        ])("should parse '$actual'", ({ actual, expected: expectedFn }) => {
            expect(CosmeticRuleParser.parse(actual)).toMatchObject(expectedFn(new NodeExpectContext(actual)));
        });
    });

    describe('CosmeticRuleParser.parse - invalid usage of AdGuard modifier list', () => {
        test.each<{ actual: string; expected: NodeExpectFn<AdblockSyntaxError> }>([
            {
                actual: '[path=/something]##.ad',
                //        ~~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(ERROR_MESSAGES.MISSING_ADGUARD_MODIFIER_LIST_MARKER, DOLLAR_SIGN, '[path=/something]'),
                        ...context.toTuple(context.getRangeFor('path=/something]')),
                    );
                },
            },
            {
                actual: '[path=/something]example.com##.ad',
                //        ~~~~~~~~~~~~~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        // eslint-disable-next-line max-len
                        "Missing '$' at the beginning of the AdGuard modifier list in pattern '[path=/something]example.com'",
                        ...context.toTuple(context.getRangeFor('path=/something]example.com')),
                    );
                },
            },
            {
                actual: '[$path=/something##.ad',
                //         ~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(
                            ERROR_MESSAGES.MISSING_ADGUARD_MODIFIER_LIST_END,
                            CLOSE_SQUARE_BRACKET,
                            '[$path=/something',
                        ),
                        ...context.toTuple(context.getRangeFor('path=/something')),
                    );
                },
            },

            // mixing different syntaxes
            {
                actual: '[$path=/something]##:matches-path(/path) .ad',
                //       ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(ERROR_MESSAGES.SYNTAXES_CANNOT_BE_MIXED, AdblockSyntax.Ubo, AdblockSyntax.Adg),
                        ...context.toTuple(context.getFullRange()),
                    );
                },
            },
            {
                actual: '[$path=/something]##+js(scriptlet)',
                //       ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(ERROR_MESSAGES.SYNTAXES_CANNOT_BE_MIXED, AdblockSyntax.Ubo, AdblockSyntax.Adg),
                        ...context.toTuple(context.getFullRange()),
                    );
                },
            },
            {
                actual: '[$path=/something]##^script:has-text(adblock)',
                //       ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(ERROR_MESSAGES.SYNTAXES_CANNOT_BE_MIXED, AdblockSyntax.Ubo, AdblockSyntax.Adg),
                        ...context.toTuple(context.getFullRange()),
                    );
                },
            },
            {
                actual: '[$path=/something]#$#abp-snippet',
                //       ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(ERROR_MESSAGES.SYNTAXES_CANNOT_BE_MIXED, AdblockSyntax.Abp, AdblockSyntax.Adg),
                        ...context.toTuple(context.getFullRange()),
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

    describe('CosmeticRuleParser.generate - valid usage of AdGuard modifier list', () => {
        test.each<{ actual: string; expected: string }>([
            {
                actual: '[$path=/something]##.ad',
                expected: '[$path=/something]##.ad',
            },
            {
                actual: '[$domain=example.com,path=/page.html]##.ad',
                expected: '[$domain=example.com,path=/page.html]##.ad',
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
