import {
    describe,
    test,
    expect,
    vi,
} from 'vitest';
import { sprintf } from 'sprintf-js';

import { NodeExpectContext, type NodeExpectFn } from '../../helpers/node-utils';
import { CosmeticRuleType, type ElementHidingRule, RuleCategory } from '../../../src/nodes';
import { AdblockSyntax } from '../../../src/utils/adblockers';
import { DomainListParser } from '../../../src/parser/misc/domain-list-parser';
import {
    CosmeticRuleParser,
    ERROR_MESSAGES as COSMETIC_ERROR_MESSAGES,
} from '../../../src/parser/cosmetic/cosmetic-rule-parser';
import { AdblockSyntaxError } from '../../../src/errors/adblock-syntax-error';
import {
    ERROR_MESSAGES as UBO_SELECTOR_ERROR_MESSAGES,
    formatPseudoName,
} from '../../../src/parser/css/ubo-selector-parser';
import { CSS_NOT_PSEUDO } from '../../../src/utils/constants';
import { CosmeticRuleGenerator } from '../../../src/generator/cosmetic';
import { UboPseudoName } from '../../../src/common/ubo-selector-common';

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
                                        ...context.getRangeFor('matches-path'),
                                    },
                                    value: {
                                        type: 'Value',
                                        value: '/path',
                                        ...context.getRangeFor('/path'),
                                    },
                                },
                            ],
                            ...context.getRangeFor(':matches-path(/path) .ad'),
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
                                ...context.getRangeFor(':matches-path(/path) .ad'),
                            },
                            ...context.getRangeFor(':matches-path(/path) .ad'),
                        },
                        ...context.getFullRange(),
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
                        ...context.toTuple(context.getRangeFor(':has(:matches-path(/path)) .ad')),
                    );
                },
            },
            // Cannot use uBO modifiers with AdGuard modifier list
            {
                actual: '[$path=/something]##:matches-path(/path) .ad',
                //       ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(
                            COSMETIC_ERROR_MESSAGES.SYNTAXES_CANNOT_BE_MIXED,
                            AdblockSyntax.Ubo,
                            AdblockSyntax.Adg,
                        ),
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
                actual: '##:matches-path(/path) .ad',
                expected: '##:matches-path(/path) .ad',
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
