import { sprintf } from 'sprintf-js';
import { TokenType, getFormattedTokenName } from '@adguard/css-tokenizer';

import { AdblockSyntaxError } from '../../../src/errors/adblock-syntax-error';
import {
    type UboSelector,
    UboSelectorParser,
    ERROR_MESSAGES,
    UboPseudoName,
    formatPseudoName,
} from '../../../src/parser/css/ubo-selector';
import { CSS_NOT_PSEUDO, EMPTY, SPACE } from '../../../src/utils/constants';
import { NodeExpectContext, type NodeExpectFn } from '../../helpers/node-utils';

describe('UboSelectorParser', () => {
    describe('UboSelectorParser.parse - valid', () => {
        test.each<{ actual: string; expected: NodeExpectFn<UboSelector> }>([
            // empty selector
            {
                actual: EMPTY,
                expected: (context: NodeExpectContext): UboSelector => ({
                    type: 'UboSelector',
                    selector: {
                        type: 'Value',
                        value: EMPTY,
                        loc: context.getFullLocRange(),
                    },
                    modifiers: {
                        type: 'ModifierList',
                        children: [],
                        loc: context.getFullLocRange(),
                    },
                    loc: context.getFullLocRange(),
                }),
            },
            {
                actual: SPACE,
                expected: (context: NodeExpectContext): UboSelector => (
                    {
                        type: 'UboSelector',
                        selector: {
                            type: 'Value',
                            value: SPACE,
                            loc: context.getFullLocRange(),
                        },
                        modifiers: {
                            type: 'ModifierList',
                            children: [],
                            loc: context.getFullLocRange(),
                        },
                        loc: context.getFullLocRange(),
                    }),
            },
            // tricky case - in this case, parser will run, because it finds an indicator
            {
                actual: '[a=":style(padding:0)"]',
                expected: (context: NodeExpectContext): UboSelector => (
                    {
                        type: 'UboSelector',
                        selector: {
                            type: 'Value',
                            value: '[a=":style(padding:0)"]',
                            loc: context.getFullLocRange(),
                        },
                        modifiers: {
                            type: 'ModifierList',
                            children: [],
                            loc: context.getFullLocRange(),
                        },
                        loc: context.getFullLocRange(),
                    }),
            },

            // selector without uBO modifiers
            {
                actual: 'div',
                expected: (context: NodeExpectContext): UboSelector => ({
                    type: 'UboSelector',
                    selector: {
                        type: 'Value',
                        value: 'div',
                        loc: context.getFullLocRange(),
                    },
                    modifiers: {
                        type: 'ModifierList',
                        children: [],
                        loc: context.getFullLocRange(),
                    },
                    loc: context.getFullLocRange(),
                }),
            },

            {
                actual: '*:has(> [ad])',
                expected: (context: NodeExpectContext): UboSelector => ({
                    type: 'UboSelector',
                    selector: {
                        type: 'Value',
                        value: '*:has(> [ad])',
                        loc: context.getFullLocRange(),
                    },
                    modifiers: {
                        type: 'ModifierList',
                        children: [],
                        loc: context.getFullLocRange(),
                    },
                    loc: context.getFullLocRange(),
                }),
            },

            // :style()
            {
                actual: 'div:style()',
                expected: (context: NodeExpectContext): UboSelector => {
                    return {
                        type: 'UboSelector',
                        selector: {
                            type: 'Value',
                            value: 'div',
                            loc: context.getFullLocRange(),
                        },
                        modifiers: {
                            type: 'ModifierList',
                            children: [
                                {
                                    type: 'Modifier',
                                    name: {
                                        type: 'Value',
                                        value: 'style',
                                        loc: context.getLocRangeFor('style'),
                                    },
                                    value: {
                                        type: 'Value',
                                        value: '',
                                        loc: context.getLocRangeBetween('(', ')'),
                                    },
                                    exception: false,
                                    loc: context.getLocRangeFor(':style()'),
                                },
                            ],
                            loc: context.getFullLocRange(),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },

            // extra whitespace in the parameter
            {
                actual: 'div:style( )',
                expected: (context: NodeExpectContext): UboSelector => {
                    return {
                        type: 'UboSelector',
                        selector: {
                            type: 'Value',
                            value: 'div',
                            loc: context.getFullLocRange(),
                        },
                        modifiers: {
                            type: 'ModifierList',
                            children: [
                                {
                                    type: 'Modifier',
                                    name: {
                                        type: 'Value',
                                        value: 'style',
                                        loc: context.getLocRangeFor('style'),
                                    },
                                    value: {
                                        type: 'Value',
                                        value: ' ',
                                        loc: context.getLocRangeFor(' '),
                                    },
                                    exception: false,
                                    loc: context.getLocRangeFor(':style( )'),
                                },
                            ],
                            loc: context.getFullLocRange(),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },

            // extra whitespace before and after the pseudo-class
            {
                actual: 'div :style() ',
                expected: (context: NodeExpectContext): UboSelector => {
                    return {
                        type: 'UboSelector',
                        selector: {
                            type: 'Value',
                            value: 'div',
                            loc: context.getFullLocRange(),
                        },
                        modifiers: {
                            type: 'ModifierList',
                            children: [
                                {
                                    type: 'Modifier',
                                    name: {
                                        type: 'Value',
                                        value: 'style',
                                        loc: context.getLocRangeFor('style'),
                                    },
                                    value: {
                                        type: 'Value',
                                        value: '',
                                        loc: context.getLocRangeBetween('(', ')'),
                                    },
                                    exception: false,
                                    loc: context.getLocRangeFor(':style()'),
                                },
                            ],
                            loc: context.getFullLocRange(),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },

            {
                actual: 'div:style(padding:0)',
                expected: (context: NodeExpectContext): UboSelector => {
                    return {
                        type: 'UboSelector',
                        selector: {
                            type: 'Value',
                            value: 'div',
                            loc: context.getFullLocRange(),
                        },
                        modifiers: {
                            type: 'ModifierList',
                            children: [
                                {
                                    type: 'Modifier',
                                    name: {
                                        type: 'Value',
                                        value: 'style',
                                        loc: context.getLocRangeFor('style'),
                                    },
                                    value: {
                                        type: 'Value',
                                        value: 'padding:0',
                                        loc: context.getLocRangeFor('padding:0'),
                                    },
                                    exception: false,
                                    loc: context.getLocRangeFor(':style(padding:0)'),
                                },
                            ],
                            loc: context.getFullLocRange(),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },

            // :remove()
            {
                actual: 'div:remove()',
                expected: (context: NodeExpectContext): UboSelector => {
                    return {
                        type: 'UboSelector',
                        selector: {
                            type: 'Value',
                            value: 'div',
                            loc: context.getFullLocRange(),
                        },
                        modifiers: {
                            type: 'ModifierList',
                            children: [
                                {
                                    type: 'Modifier',
                                    name: {
                                        type: 'Value',
                                        value: 'remove',
                                        loc: context.getLocRangeFor('remove'),
                                    },
                                    value: {
                                        type: 'Value',
                                        value: '',
                                        loc: context.getLocRangeBetween('(', ')'),
                                    },
                                    exception: false,
                                    loc: context.getLocRangeFor(':remove()'),
                                },
                            ],
                            loc: context.getFullLocRange(),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },

            // extra whitespace in the parameter
            {
                actual: 'div:remove( )',
                expected: (context: NodeExpectContext): UboSelector => {
                    return {
                        type: 'UboSelector',
                        selector: {
                            type: 'Value',
                            value: 'div',
                            loc: context.getFullLocRange(),
                        },
                        modifiers: {
                            type: 'ModifierList',
                            children: [
                                {
                                    type: 'Modifier',
                                    name: {
                                        type: 'Value',
                                        value: 'remove',
                                        loc: context.getLocRangeFor('remove'),
                                    },
                                    value: {
                                        type: 'Value',
                                        value: ' ',
                                        loc: context.getLocRangeFor(' '),
                                    },
                                    exception: false,
                                    loc: context.getLocRangeFor(':remove( )'),
                                },
                            ],
                            loc: context.getFullLocRange(),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },

            // extra whitespace before and after the pseudo-class
            {
                actual: 'div :remove() ',
                expected: (context: NodeExpectContext): UboSelector => {
                    return {
                        type: 'UboSelector',
                        selector: {
                            type: 'Value',
                            value: 'div',
                            loc: context.getFullLocRange(),
                        },
                        modifiers: {
                            type: 'ModifierList',
                            children: [
                                {
                                    type: 'Modifier',
                                    name: {
                                        type: 'Value',
                                        value: 'remove',
                                        loc: context.getLocRangeFor('remove'),
                                    },
                                    value: {
                                        type: 'Value',
                                        value: '',
                                        loc: context.getLocRangeBetween('(', ')'),
                                    },
                                    exception: false,
                                    loc: context.getLocRangeFor(':remove()'),
                                },
                            ],
                            loc: context.getFullLocRange(),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },

            // negated :matches-path()
            {
                actual: ':not(:matches-path(/path))',
                expected: (context: NodeExpectContext): UboSelector => {
                    return {
                        type: 'UboSelector',
                        selector: {
                            type: 'Value',
                            value: '',
                            loc: context.getFullLocRange(),
                        },
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
                                        // eslint-disable-next-line max-len
                                        loc: context.getLocRangeFor('/path'),
                                    },
                                    exception: true,
                                    loc: context.getLocRangeFor(':not(:matches-path(/path))'),
                                },
                            ],
                            loc: context.getFullLocRange(),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },

            // double negation -> no negation
            {
                actual: ':not(:not(:matches-path(/path)))',
                expected: (context: NodeExpectContext): UboSelector => {
                    return {
                        type: 'UboSelector',
                        selector: {
                            type: 'Value',
                            value: EMPTY,
                            loc: context.getFullLocRange(),
                        },
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
                                    exception: false,
                                    loc: context.getLocRangeFor(':not(:not(:matches-path(/path)))'),
                                },
                            ],
                            loc: context.getFullLocRange(),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },

            // triple negation -> negation
            {
                actual: ':not(:not(:not(:matches-path(/path))))',
                expected: (context: NodeExpectContext): UboSelector => {
                    return {
                        type: 'UboSelector',
                        selector: {
                            type: 'Value',
                            value: EMPTY,
                            loc: context.getFullLocRange(),
                        },
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
                                    exception: true,
                                    loc: context.getLocRangeFor(':not(:not(:not(:matches-path(/path))))'),
                                },
                            ],
                            loc: context.getFullLocRange(),
                        },
                        loc: context.getFullLocRange(),
                    };
                },
            },

            // complicated case
            {
                // eslint-disable-next-line max-len
                actual: ':matches-media((min-width: 1000px)) div:has(> [ad]):not(:matches-path(/path)):style(padding:0; color: red!important)',
                expected: (context: NodeExpectContext): UboSelector => ({
                    type: 'UboSelector',
                    selector: {
                        type: 'Value',
                        value: 'div:has(> [ad])',
                        loc: context.getFullLocRange(),
                    },
                    modifiers: {
                        type: 'ModifierList',
                        children: [
                            {
                                type: 'Modifier',
                                name: {
                                    type: 'Value',
                                    value: 'matches-media',
                                    loc: context.getLocRangeFor('matches-media'),
                                },
                                value: {
                                    type: 'Value',
                                    value: '(min-width: 1000px)',
                                    loc: context.getLocRangeFor('(min-width: 1000px)'),
                                },
                                exception: false,
                                loc: context.getLocRangeFor(':matches-media((min-width: 1000px))'),
                            },
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
                                exception: true,
                                loc: context.getLocRangeFor(':not(:matches-path(/path))'),
                            },
                            {
                                type: 'Modifier',
                                name: {
                                    type: 'Value',
                                    value: 'style',
                                    loc: context.getLocRangeFor('style'),
                                },
                                value: {
                                    type: 'Value',
                                    value: 'padding:0; color: red!important',
                                    loc: context.getLocRangeFor('padding:0; color: red!important'),
                                },
                                exception: false,
                                loc: context.getLocRangeFor(':style(padding:0; color: red!important)'),
                            },
                        ],
                        loc: context.getFullLocRange(),
                    },
                    loc: context.getFullLocRange(),
                }),
            },
        ])("should parse input: '$actual'", ({ actual, expected }) => {
            expect(UboSelectorParser.parse(actual)).toMatchObject(expected(new NodeExpectContext(actual)));
        });
    });

    describe('parser options should work as expected', () => {
        test.each<{ actual: string; expected: UboSelector }>([
            {
                actual: 'div',
                expected: {
                    type: 'UboSelector',
                    selector: {
                        type: 'Value',
                        value: 'div',
                    },
                    modifiers: {
                        type: 'ModifierList',
                        children: [],
                    },
                },
            },
        ])('isLocIncluded should work for $actual', ({ actual, expected }) => {
            expect(UboSelectorParser.parse(actual, { isLocIncluded: false })).toEqual(expected);
        });
    });

    describe('UboSelectorParser.parse - invalid', () => {
        test.each<{ actual: string; expected: NodeExpectFn<AdblockSyntaxError> }>([
            // uBO style injection cannot be followed by anything else
            {
                actual: 'div:style(border: none!important):remove()',
                //                                        ~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        ERROR_MESSAGES.UBO_STYLE_CANNOT_BE_FOLLOWED,
                        context.getLocRangeFor(':remove()'),
                    );
                },
            },
            {
                actual: 'div:remove():style(border: none!important)',
                //                   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        ERROR_MESSAGES.UBO_STYLE_CANNOT_BE_FOLLOWED,
                        context.getLocRangeFor(':style(border: none!important)'),
                    );
                },
            },
            {
                actual: 'div:style(border: none!important) div',
                //                                         ~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        ERROR_MESSAGES.UBO_STYLE_CANNOT_BE_FOLLOWED,
                        context.getLocRangeFor('div', -1), // first 'div' from the end
                    );
                },
            },
            {
                actual: 'div:remove() div',
                //                    ~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        ERROR_MESSAGES.UBO_STYLE_CANNOT_BE_FOLLOWED,
                        context.getLocRangeFor('div', -1), // first 'div' from the end
                    );
                },
            },

            // only :matches-path() can be nested and only within :not()
            {
                actual: 'div:has(:matches-media((min-width: 1000px)))',
                //               ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(
                            ERROR_MESSAGES.UBO_MODIFIER_CANNOT_BE_NESTED,
                            formatPseudoName(UboPseudoName.MatchesMedia),
                        ),
                        context.getLocRangeFor(':matches-media((min-width: 1000px)))'),
                    );
                },
            },
            {
                actual: 'div:matches-media(:matches-media((min-width: 1000px)))',
                //                         ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(
                            ERROR_MESSAGES.UBO_MODIFIER_CANNOT_BE_NESTED,
                            formatPseudoName(UboPseudoName.MatchesMedia),
                        ),
                        context.getLocRangeFor(':matches-media((min-width: 1000px)))'),
                    );
                },
            },
            {
                actual: 'div:not(:style(padding: 0))',
                //               ~~~~~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(
                            ERROR_MESSAGES.UBO_MODIFIER_CANNOT_BE_NESTED,
                            formatPseudoName(UboPseudoName.Style),
                        ),
                        context.getLocRangeFor(':style(padding: 0))'),
                    );
                },
            },

            // :matches-path() inside :not() cannot be preceded / followed by anything else
            {
                actual: ':not(div:matches-path(/path))',
                //            ~~~~~~~~~~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(
                            ERROR_MESSAGES.NEGATED_UBO_MODIFIER_CANNOT_BE_PRECEDED_BY,
                            formatPseudoName(UboPseudoName.MatchesPath),
                            getFormattedTokenName(TokenType.Ident),
                        ),
                        context.getLocRangeFor('div:matches-path(/path))'),
                    );
                },
            },
            {
                actual: ':not(:matches-path(/path) div)',
                //                                 ~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(
                            ERROR_MESSAGES.NEGATED_UBO_MODIFIER_CANNOT_BE_FOLLOWED_BY,
                            formatPseudoName(UboPseudoName.MatchesPath),
                            getFormattedTokenName(TokenType.Ident),
                        ),
                        context.getLocRangeFor('div)'),
                    );
                },
            },
            {
                actual: ':not(:matches-path(/path1):matches-path(/path2))',
                //                                 ~~~~~~~~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(
                            ERROR_MESSAGES.NEGATED_UBO_MODIFIER_CANNOT_BE_FOLLOWED_BY,
                            formatPseudoName(UboPseudoName.MatchesPath),
                            getFormattedTokenName(TokenType.Ident),
                        ),
                        context.getLocRangeFor(':matches-path(/path2))'),
                    );
                },
            },
            {
                actual: ':not(div:not(:matches-path(/path)))',
                //            ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(
                            ERROR_MESSAGES.NEGATED_UBO_MODIFIER_CANNOT_BE_PRECEDED_BY,
                            formatPseudoName(UboPseudoName.MatchesPath),
                            getFormattedTokenName(TokenType.Ident),
                        ),
                        context.getLocRangeFor('div:not(:matches-path(/path)))'),
                    );
                },
            },
            {
                actual: ':not(:not(div:matches-path(/path)))',
                //                 ~~~~~~~~~~~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(
                            ERROR_MESSAGES.NEGATED_UBO_MODIFIER_CANNOT_BE_PRECEDED_BY,
                            formatPseudoName(UboPseudoName.MatchesPath),
                            getFormattedTokenName(TokenType.Ident),
                        ),
                        context.getLocRangeFor('div:matches-path(/path)))'),
                    );
                },
            },

            // duplicated modifiers are not allowed
            {
                actual: 'div:matches-path(/path):matches-path(/path)',
                //                              ~~~~~~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(
                            ERROR_MESSAGES.DUPLICATED_UBO_MODIFIER,
                            formatPseudoName(UboPseudoName.MatchesPath),
                        ),
                        context.getLocRangeFor(':matches-path(/path)', -1),
                    );
                },
            },

            // // :matches-path() cannot be nested within something else than :not()
            {
                actual: 'div:any(:matches-path(/path))',
                //           ~~~~~~~~~~~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(
                            ERROR_MESSAGES.PSEUDO_CANNOT_BE_NESTED,
                            formatPseudoName(UboPseudoName.MatchesPath),
                            formatPseudoName('any'),
                            formatPseudoName(CSS_NOT_PSEUDO),
                        ),
                        context.getLocRangeFor(':any(:matches-path(/path))'),
                    );
                },
            },
            {
                actual: 'not(:matches-path(/path))', // missing : before not
                //       ~~~~~~~~~~~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(
                            ERROR_MESSAGES.EXPECTED_BUT_GOT_BEFORE,
                            getFormattedTokenName(TokenType.Colon),
                            'nothing',
                            formatPseudoName(UboPseudoName.MatchesPath, CSS_NOT_PSEUDO),
                        ),
                        context.getFullLocRange(),
                    );
                },
            },
            {
                actual: 'not(:not(:matches-path(/path)))', // missing : before first not
                //       ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(
                            ERROR_MESSAGES.EXPECTED_BUT_GOT_BEFORE,
                            getFormattedTokenName(TokenType.Colon),
                            'nothing',
                            formatPseudoName(UboPseudoName.MatchesPath, CSS_NOT_PSEUDO),
                        ),
                        context.getFullLocRange(),
                    );
                },
            },
        ])("should throw on input: '$actual'", ({ actual, expected: expectedFn }) => {
            const fn = jest.fn(() => UboSelectorParser.parse(actual));

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

    describe('UboSelectorParser.generate', () => {
        test.each<{ actual: string; expected: string }>([
            {
                actual: 'div',
                expected: 'div',
            },
            {
                actual: '*:has(> [ad])',
                expected: '*:has(> [ad])',
            },
            {
                actual: 'div:style()',
                expected: 'div:style()',
            },
            {
                actual: 'div:style(padding:0)',
                expected: 'div:style(padding:0)',
            },
            {
                actual: 'div:remove()',
                expected: 'div:remove()',
            },
            {
                actual: 'div:matches-path(/path)',
                expected: ':matches-path(/path) div',
            },
            {
                actual: ':not(:matches-path(/path))',
                expected: ':not(:matches-path(/path))',
            },
            {
                actual: ':not(:not(:matches-path(/path)))',
                expected: ':matches-path(/path)',
            },
            {
                actual: ':not(:not(:not(:matches-path(/path))))',
                expected: ':not(:matches-path(/path))',
            },
            {
                // eslint-disable-next-line max-len
                actual: ':matches-media((min-width: 1000px)) div:has(> [ad]):not(:matches-path(/path)):style(padding:0; color: red!important)',
                // eslint-disable-next-line max-len
                expected: ':matches-media((min-width: 1000px)):not(:matches-path(/path)) div:has(> [ad]):style(padding:0; color: red!important)',
            },
        ])('should generate input: \'$actual\'', ({ actual, expected }) => {
            expect(UboSelectorParser.generate(UboSelectorParser.parse(actual))).toBe(expected);
        });
    });
});
