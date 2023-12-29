import { sprintf } from 'sprintf-js';

import { NodeExpectContext, type NodeExpectFn } from '../../helpers/node-utils';
import { CosmeticRuleType, type ElementHidingRule, RuleCategory } from '../../../src/parser/common';
import { AdblockSyntax } from '../../../src/utils/adblockers';
import { DomainListParser } from '../../../src/parser/misc/domain-list';
import { CosmeticRuleParser, ERROR_MESSAGES as COSMETIC_ERROR_MESSAGES } from '../../../src/parser/cosmetic';
import { AdblockSyntaxError } from '../../../src/errors/adblock-syntax-error';
import {
    ERROR_MESSAGES as UBO_SELECTOR_ERROR_MESSAGES,
    UboPseudoName,
    formatPseudoName,
} from '../../../src/parser/css/ubo-selector';
import { CSS_NOT_PSEUDO } from '../../../src/utils/constants';

describe('CosmeticRuleParser', () => {
    describe('CosmeticRuleParser.parse - valid usage of uBlock modifier list', () => {
        test.each<{ actual: string; expected: NodeExpectFn<ElementHidingRule> }>([
            // generic cosmetic rule - without domains
            {
                actual: '##:matches-path(/path) .ad',
                expected: (context: NodeExpectContext): ElementHidingRule => {
                    return {
                        category: RuleCategory.Cosmetic,
                        type: CosmeticRuleType.ElementHidingRule,
                        syntax: AdblockSyntax.Ubo,
                        exception: false,
                        domains: DomainListParser.parse(''),
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
                                        value: '/path',
                                        loc: context.getLocRangeFor('/path'),
                                    },
                                },
                            ],
                            loc: context.getLocRangeFor(':matches-path(/path) .ad'),
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
                                loc: context.getLocRangeFor(':matches-path(/path) .ad'),
                            },
                            loc: context.getLocRangeFor(':matches-path(/path) .ad'),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },
        ])("should parse '$actual'", ({ actual, expected: expectedFn }) => {
            expect(CosmeticRuleParser.parse(actual)).toMatchObject(expectedFn(new NodeExpectContext(actual)));
        });
    });

    describe('CosmeticRuleParser.parse - invalid usage of uBlock modifier list', () => {
        test.each<{ actual: string; expected: NodeExpectFn<AdblockSyntaxError> }>([
            // There is no need to test every possible errors here, because uBO modifiers are well tested in
            // 'tests/parser/css/ubo-selector.test.ts' - this is their separate section
            // We just test that errors are thrown correctly here as well
            {
                actual: '##*:has(:matches-path(/path)) .ad',
                //          ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        // eslint-disable-next-line max-len
                        sprintf(
                            UBO_SELECTOR_ERROR_MESSAGES.PSEUDO_CANNOT_BE_NESTED,
                            formatPseudoName(UboPseudoName.MatchesPath),
                            formatPseudoName('has'),
                            formatPseudoName(CSS_NOT_PSEUDO),
                        ),
                        context.getLocRangeFor(':has(:matches-path(/path)) .ad'),
                    );
                },
            },
            // Cannot use uBO modifiers with AdGuard modifier list
            {
                actual: '[$path=/something]##:matches-path(/path) .ad',
                //       ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(COSMETIC_ERROR_MESSAGES.SYNTAXES_CANNOT_BE_MIXED, AdblockSyntax.Ubo, AdblockSyntax.Adg),
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
                actual: '##:matches-path(/path) .ad',
                expected: '##:matches-path(/path) .ad',
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
