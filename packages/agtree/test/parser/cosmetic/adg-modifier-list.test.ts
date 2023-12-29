import { sprintf } from 'sprintf-js';

import { AdblockSyntaxError } from '../../../src/errors/adblock-syntax-error';
import { NodeExpectContext, type NodeExpectFn } from '../../helpers/node-utils';
import {
    CosmeticRuleType,
    type ElementHidingRule,
    RuleCategory,
    defaultLocation,
} from '../../../src/parser/common';
import { AdblockSyntax } from '../../../src/utils/adblockers';
import { DomainListParser } from '../../../src/parser/misc/domain-list';
import { CosmeticRuleParser, ERROR_MESSAGES } from '../../../src/parser/cosmetic';
import { shiftLoc } from '../../../src/utils/location';
import { CLOSE_SQUARE_BRACKET, DOLLAR_SIGN } from '../../../src/utils/constants';

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
                        domains: DomainListParser.parse('', {
                            baseLoc: shiftLoc(defaultLocation, '[$path=/something]'.length),
                        }),
                        modifiers: {
                            type: 'ModifierList',
                            children: [
                                {
                                    type: 'Modifier',
                                    name: {
                                        type: 'Value',
                                        value: 'path',
                                        loc: context.getLocRangeFor('path'),
                                    },
                                    value: {
                                        type: 'Value',
                                        value: '/something',
                                        loc: context.getLocRangeFor('/something'),
                                    },
                                },
                            ],
                            loc: context.getLocRangeFor('[$path=/something]'),
                        },
                        separator: {
                            type: 'Value',
                            value: '##',
                            loc: context.getLocRangeFor('##'),
                        },
                        body: {
                            type: 'ElementHidingRuleBody',
                            selectorList: {
                                type: 'Value',
                                value: '.ad',
                                loc: context.getLocRangeFor('.ad'),
                            },
                            loc: context.getLocRangeFor('.ad'),
                        },
                        loc: context.getFullLocRange(),
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
                        context.getLocRangeFor('path=/something]'),
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
                        context.getLocRangeFor('path=/something]example.com'),
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
                        context.getLocRangeFor('path=/something'),
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
                        context.getFullLocRange(),
                    );
                },
            },
            {
                actual: '[$path=/something]##+js(scriptlet)',
                //       ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(ERROR_MESSAGES.SYNTAXES_CANNOT_BE_MIXED, AdblockSyntax.Ubo, AdblockSyntax.Adg),
                        context.getFullLocRange(),
                    );
                },
            },
            {
                actual: '[$path=/something]##^script:has-text(adblock)',
                //       ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(ERROR_MESSAGES.SYNTAXES_CANNOT_BE_MIXED, AdblockSyntax.Ubo, AdblockSyntax.Adg),
                        context.getFullLocRange(),
                    );
                },
            },
            {
                actual: '[$path=/something]#$#abp-snippet',
                //       ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(ERROR_MESSAGES.SYNTAXES_CANNOT_BE_MIXED, AdblockSyntax.Abp, AdblockSyntax.Adg),
                        context.getFullLocRange(),
                    );
                },
            },
        ])("should throw on input: '$actual'", ({ actual, expected: expectedFn }) => {
            const fn = jest.fn(() => CosmeticRuleParser.parse(actual));

            // parse should throw
            expect(fn).toThrow();

            const expected = expectedFn(new NodeExpectContext(actual));

            // check the thrown error
            const error = fn.mock.results[0].value;
            expect(error).toBeInstanceOf(AdblockSyntaxError);
            expect(error).toHaveProperty('message', expected.message);
            expect(error).toHaveProperty('loc', expected.loc);
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

            expect(CosmeticRuleParser.generate(ruleNode)).toBe(expected);
        });
    });
});
