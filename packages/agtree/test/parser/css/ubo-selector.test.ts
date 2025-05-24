import {
    describe,
    test,
    expect,
    vi,
} from 'vitest';
import { sprintf } from 'sprintf-js';
import { TokenType, getFormattedTokenName } from '@adguard/css-tokenizer';

import { AdblockSyntaxError } from '../../../src/errors/adblock-syntax-error.js';
import { UboSelectorParser, ERROR_MESSAGES, formatPseudoName } from '../../../src/parser/css/ubo-selector-parser.js';
import { CSS_NOT_PSEUDO, EMPTY, SPACE } from '../../../src/utils/constants.js';
import { NodeExpectContext, type NodeExpectFn } from '../../helpers/node-utils.js';
import { UboSelectorGenerator } from '../../../src/generator/css/ubo-selector-generator.js';
import { UboPseudoName } from '../../../src/common/ubo-selector-common.js';

describe('UboSelectorParser', () => {
    describe('UboSelectorParser.parse - valid', () => {
        test.each<{ actual: string; expected: NodeExpectFn<UboSelectorParser> }>([
            // empty selector
            {
                actual: EMPTY,
                expected: (context: NodeExpectContext): UboSelectorParser => ({
                    type: 'UboSelector',
                    selector: {
                        type: 'Value',
                        value: EMPTY,
                        ...context.getFullRange(),
                    },
                    modifiers: {
                        type: 'ModifierList',
                        children: [],
                        ...context.getFullRange(),
                    },
                    ...context.getFullRange(),
                }),
            },
            {
                actual: SPACE,
                expected: (context: NodeExpectContext): UboSelectorParser => (
                    {
                        type: 'UboSelector',
                        selector: {
                            type: 'Value',
                            value: SPACE,
                            ...context.getFullRange(),
                        },
                        modifiers: {
                            type: 'ModifierList',
                            children: [],
                            ...context.getFullRange(),
                        },
                        ...context.getFullRange(),
                    }),
            },
            // tricky case - in this case, parser will run, because it finds an indicator
            {
                actual: '[a=":style(padding:0)"]',
                expected: (context: NodeExpectContext): UboSelectorParser => (
                    {
                        type: 'UboSelector',
                        selector: {
                            type: 'Value',
                            value: '[a=":style(padding:0)"]',
                            ...context.getFullRange(),
                        },
                        modifiers: {
                            type: 'ModifierList',
                            children: [],
                            ...context.getFullRange(),
                        },
                        ...context.getFullRange(),
                    }),
            },

            // selector without uBO modifiers
            {
                actual: 'div',
                expected: (context: NodeExpectContext): UboSelectorParser => ({
                    type: 'UboSelector',
                    selector: {
                        type: 'Value',
                        value: 'div',
                        ...context.getFullRange(),
                    },
                    modifiers: {
                        type: 'ModifierList',
                        children: [],
                        ...context.getFullRange(),
                    },
                    ...context.getFullRange(),
                }),
            },

            {
                actual: '*:has(> [ad])',
                expected: (context: NodeExpectContext): UboSelectorParser => ({
                    type: 'UboSelector',
                    selector: {
                        type: 'Value',
                        value: '*:has(> [ad])',
                        ...context.getFullRange(),
                    },
                    modifiers: {
                        type: 'ModifierList',
                        children: [],
                        ...context.getFullRange(),
                    },
                    ...context.getFullRange(),
                }),
            },

            // :style()
            {
                actual: 'div:style()',
                expected: (context: NodeExpectContext): UboSelectorParser => {
                    return {
                        type: 'UboSelector',
                        selector: {
                            type: 'Value',
                            value: 'div',
                            ...context.getFullRange(),
                        },
                        modifiers: {
                            type: 'ModifierList',
                            children: [
                                {
                                    type: 'Modifier',
                                    name: {
                                        type: 'Value',
                                        value: 'style',
                                        ...context.getRangeFor('style'),
                                    },
                                    value: {
                                        type: 'Value',
                                        value: '',
                                        ...context.getRangeBetween('(', ')'),
                                    },
                                    exception: false,
                                    ...context.getRangeFor(':style()'),
                                },
                            ],
                            ...context.getFullRange(),
                        },
                        ...context.getFullRange(),
                    };
                },
            },

            // extra whitespace in the parameter
            {
                actual: 'div:style( )',
                expected: (context: NodeExpectContext): UboSelectorParser => {
                    return {
                        type: 'UboSelector',
                        selector: {
                            type: 'Value',
                            value: 'div',
                            ...context.getFullRange(),
                        },
                        modifiers: {
                            type: 'ModifierList',
                            children: [
                                {
                                    type: 'Modifier',
                                    name: {
                                        type: 'Value',
                                        value: 'style',
                                        ...context.getRangeFor('style'),
                                    },
                                    value: {
                                        type: 'Value',
                                        value: ' ',
                                        ...context.getRangeFor(' '),
                                    },
                                    exception: false,
                                    ...context.getRangeFor(':style( )'),
                                },
                            ],
                            ...context.getFullRange(),
                        },
                        ...context.getFullRange(),
                    };
                },
            },

            // extra whitespace before and after the pseudo-class
            {
                actual: 'div :style() ',
                expected: (context: NodeExpectContext): UboSelectorParser => {
                    return {
                        type: 'UboSelector',
                        selector: {
                            type: 'Value',
                            value: 'div',
                            ...context.getFullRange(),
                        },
                        modifiers: {
                            type: 'ModifierList',
                            children: [
                                {
                                    type: 'Modifier',
                                    name: {
                                        type: 'Value',
                                        value: 'style',
                                        ...context.getRangeFor('style'),
                                    },
                                    value: {
                                        type: 'Value',
                                        value: '',
                                        ...context.getRangeBetween('(', ')'),
                                    },
                                    exception: false,
                                    ...context.getRangeFor(':style()'),
                                },
                            ],
                            ...context.getFullRange(),
                        },
                        ...context.getFullRange(),
                    };
                },
            },

            {
                actual: 'div:style(padding:0)',
                expected: (context: NodeExpectContext): UboSelectorParser => {
                    return {
                        type: 'UboSelector',
                        selector: {
                            type: 'Value',
                            value: 'div',
                            ...context.getFullRange(),
                        },
                        modifiers: {
                            type: 'ModifierList',
                            children: [
                                {
                                    type: 'Modifier',
                                    name: {
                                        type: 'Value',
                                        value: 'style',
                                        ...context.getRangeFor('style'),
                                    },
                                    value: {
                                        type: 'Value',
                                        value: 'padding:0',
                                        ...context.getRangeFor('padding:0'),
                                    },
                                    exception: false,
                                    ...context.getRangeFor(':style(padding:0)'),
                                },
                            ],
                            ...context.getFullRange(),
                        },
                        ...context.getFullRange(),
                    };
                },
            },

            // :remove()
            {
                actual: 'div:remove()',
                expected: (context: NodeExpectContext): UboSelectorParser => {
                    return {
                        type: 'UboSelector',
                        selector: {
                            type: 'Value',
                            value: 'div',
                            ...context.getFullRange(),
                        },
                        modifiers: {
                            type: 'ModifierList',
                            children: [
                                {
                                    type: 'Modifier',
                                    name: {
                                        type: 'Value',
                                        value: 'remove',
                                        ...context.getRangeFor('remove'),
                                    },
                                    value: {
                                        type: 'Value',
                                        value: '',
                                        ...context.getRangeBetween('(', ')'),
                                    },
                                    exception: false,
                                    ...context.getRangeFor(':remove()'),
                                },
                            ],
                            ...context.getFullRange(),
                        },
                        ...context.getFullRange(),
                    };
                },
            },

            // extra whitespace in the parameter
            {
                actual: 'div:remove( )',
                expected: (context: NodeExpectContext): UboSelectorParser => {
                    return {
                        type: 'UboSelector',
                        selector: {
                            type: 'Value',
                            value: 'div',
                            ...context.getFullRange(),
                        },
                        modifiers: {
                            type: 'ModifierList',
                            children: [
                                {
                                    type: 'Modifier',
                                    name: {
                                        type: 'Value',
                                        value: 'remove',
                                        ...context.getRangeFor('remove'),
                                    },
                                    value: {
                                        type: 'Value',
                                        value: ' ',
                                        ...context.getRangeFor(' '),
                                    },
                                    exception: false,
                                    ...context.getRangeFor(':remove( )'),
                                },
                            ],
                            ...context.getFullRange(),
                        },
                        ...context.getFullRange(),
                    };
                },
            },

            // extra whitespace before and after the pseudo-class
            {
                actual: 'div :remove() ',
                expected: (context: NodeExpectContext): UboSelectorParser => {
                    return {
                        type: 'UboSelector',
                        selector: {
                            type: 'Value',
                            value: 'div',
                            ...context.getFullRange(),
                        },
                        modifiers: {
                            type: 'ModifierList',
                            children: [
                                {
                                    type: 'Modifier',
                                    name: {
                                        type: 'Value',
                                        value: 'remove',
                                        ...context.getRangeFor('remove'),
                                    },
                                    value: {
                                        type: 'Value',
                                        value: '',
                                        ...context.getRangeBetween('(', ')'),
                                    },
                                    exception: false,
                                    ...context.getRangeFor(':remove()'),
                                },
                            ],
                            ...context.getFullRange(),
                        },
                        ...context.getFullRange(),
                    };
                },
            },

            // negated :matches-path()
            {
                actual: ':not(:matches-path(/path))',
                expected: (context: NodeExpectContext): UboSelectorParser => {
                    return {
                        type: 'UboSelector',
                        selector: {
                            type: 'Value',
                            value: '',
                            ...context.getFullRange(),
                        },
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
                                        // eslint-disable-next-line max-len
                                        ...context.getRangeFor('/path'),
                                    },
                                    exception: true,
                                    ...context.getRangeFor(':not(:matches-path(/path))'),
                                },
                            ],
                            ...context.getFullRange(),
                        },
                        ...context.getFullRange(),
                    };
                },
            },

            // double negation -> no negation
            {
                actual: ':not(:not(:matches-path(/path)))',
                expected: (context: NodeExpectContext): UboSelectorParser => {
                    return {
                        type: 'UboSelector',
                        selector: {
                            type: 'Value',
                            value: EMPTY,
                            ...context.getFullRange(),
                        },
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
                                    exception: false,
                                    ...context.getRangeFor(':not(:not(:matches-path(/path)))'),
                                },
                            ],
                            ...context.getFullRange(),
                        },
                        ...context.getFullRange(),
                    };
                },
            },

            // triple negation -> negation
            {
                actual: ':not(:not(:not(:matches-path(/path))))',
                expected: (context: NodeExpectContext): UboSelectorParser => {
                    return {
                        type: 'UboSelector',
                        selector: {
                            type: 'Value',
                            value: EMPTY,
                            ...context.getFullRange(),
                        },
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
                                    exception: true,
                                    ...context.getRangeFor(':not(:not(:not(:matches-path(/path))))'),
                                },
                            ],
                            ...context.getFullRange(),
                        },
                        ...context.getFullRange(),
                    };
                },
            },

            // complicated case
            {
                // eslint-disable-next-line max-len
                actual: ':matches-media((min-width: 1000px)) div:has(> [ad]):not(:matches-path(/path)):style(padding:0; color: red!important)',
                expected: (context: NodeExpectContext): UboSelectorParser => ({
                    type: 'UboSelector',
                    selector: {
                        type: 'Value',
                        value: 'div:has(> [ad])',
                        ...context.getFullRange(),
                    },
                    modifiers: {
                        type: 'ModifierList',
                        children: [
                            {
                                type: 'Modifier',
                                name: {
                                    type: 'Value',
                                    value: 'matches-media',
                                    ...context.getRangeFor('matches-media'),
                                },
                                value: {
                                    type: 'Value',
                                    value: '(min-width: 1000px)',
                                    ...context.getRangeFor('(min-width: 1000px)'),
                                },
                                exception: false,
                                ...context.getRangeFor(':matches-media((min-width: 1000px))'),
                            },
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
                                exception: true,
                                ...context.getRangeFor(':not(:matches-path(/path))'),
                            },
                            {
                                type: 'Modifier',
                                name: {
                                    type: 'Value',
                                    value: 'style',
                                    ...context.getRangeFor('style'),
                                },
                                value: {
                                    type: 'Value',
                                    value: 'padding:0; color: red!important',
                                    ...context.getRangeFor('padding:0; color: red!important'),
                                },
                                exception: false,
                                ...context.getRangeFor(':style(padding:0; color: red!important)'),
                            },
                        ],
                        ...context.getFullRange(),
                    },
                    ...context.getFullRange(),
                }),
            },
        ])("should parse input: '$actual'", ({ actual, expected }) => {
            expect(UboSelectorParser.parse(actual)).toMatchObject(expected(new NodeExpectContext(actual)));
        });
    });

    describe('parser options should work as expected', () => {
        test.each<{ actual: string; expected: UboSelectorParser }>([
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
                        ...context.toTuple(context.getRangeFor(':remove()')),
                    );
                },
            },
            {
                actual: 'div:remove():style(border: none!important)',
                //                   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        ERROR_MESSAGES.UBO_STYLE_CANNOT_BE_FOLLOWED,
                        ...context.toTuple(context.getRangeFor(':style(border: none!important)')),
                    );
                },
            },
            {
                actual: 'div:style(border: none!important) div',
                //                                         ~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        ERROR_MESSAGES.UBO_STYLE_CANNOT_BE_FOLLOWED,
                        ...context.toTuple(context.getRangeFor('div', -1)), // first 'div' from the end
                    );
                },
            },
            {
                actual: 'div:remove() div',
                //                    ~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        ERROR_MESSAGES.UBO_STYLE_CANNOT_BE_FOLLOWED,
                        ...context.toTuple(context.getRangeFor('div', -1)), // first 'div' from the end
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
                        ...context.toTuple(context.getRangeFor(':matches-media((min-width: 1000px)))')),
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
                        ...context.toTuple(context.getRangeFor(':matches-media((min-width: 1000px)))')),
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
                        ...context.toTuple(context.getRangeFor(':style(padding: 0))')),
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
                        ...context.toTuple(context.getRangeFor('div:matches-path(/path))')),
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
                        ...context.toTuple(context.getRangeFor('div)')),
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
                        ...context.toTuple(context.getRangeFor(':matches-path(/path2))')),
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
                        ...context.toTuple(context.getRangeFor('div:not(:matches-path(/path)))')),
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
                        ...context.toTuple(context.getRangeFor('div:matches-path(/path)))')),
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
                        ...context.toTuple(context.getRangeFor(':matches-path(/path)', -1)),
                    );
                },
            },

            // :matches-path() cannot be nested within something else than :not()
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
                        ...context.toTuple(context.getRangeFor(':any(:matches-path(/path))')),
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
                        ...context.toTuple(context.getFullRange()),
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
                        ...context.toTuple(context.getFullRange()),
                    );
                },
            },
        ])("should throw on input: '$actual'", ({ actual, expected: expectedFn }) => {
            const fn = vi.fn(() => UboSelectorParser.parse(actual));

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
            expect(UboSelectorGenerator.generate(UboSelectorParser.parse(actual))).toBe(expected);
        });
    });
});
