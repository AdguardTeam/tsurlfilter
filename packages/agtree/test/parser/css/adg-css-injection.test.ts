import {
    describe,
    test,
    expect,
    vi,
} from 'vitest';
import { sprintf } from 'sprintf-js';
import { TokenType, getFormattedTokenName } from '@adguard/css-tokenizer';

import { AdblockSyntaxError } from '../../../src/errors/adblock-syntax-error.js';
import {
    AdgCssInjectionParser,
    ERROR_MESSAGES as ADG_CSS_INJ_ERROR_MESSAGES,
    REMOVE_VALUE,
} from '../../../src/parser/css/adg-css-injection-parser.js';
import { ERROR_MESSAGES as CSS_TOKEN_STREAM_ERROR_MESSAGES, END_OF_INPUT } from '../../../src/parser/css/constants.js';
import { NodeExpectContext, type NodeExpectFn } from '../../helpers/node-utils.js';
import { type CssInjectionRuleBody } from '../../../src/nodes/index.js';
import { AdgCssInjectionGenerator } from '../../../src/generator/css/adg-css-injection-generator.js';

describe('AdgCssInjectionParser', () => {
    describe('AdgCssInjectionParser.parse - valid', () => {
        test.each<{ actual: string; expected: NodeExpectFn<CssInjectionRuleBody> }>([
            {
                actual: 'div { padding: 0; }',
                expected: (context: NodeExpectContext): CssInjectionRuleBody => {
                    return {
                        type: 'CssInjectionRuleBody',
                        ...context.getFullRange(),
                        selectorList: {
                            type: 'Value',
                            value: 'div',
                            ...context.getRangeFor('div'),
                        },
                        declarationList: {
                            type: 'Value',
                            value: 'padding: 0;',
                            ...context.getRangeFor('padding: 0;'),
                        },
                    };
                },
            },
            {
                actual: 'div:has(> section[advert]) { padding-top: 0 !important; padding-bottom: 0 !important; }',
                expected: (context: NodeExpectContext): CssInjectionRuleBody => {
                    return {
                        type: 'CssInjectionRuleBody',
                        ...context.getFullRange(),
                        selectorList: {
                            type: 'Value',
                            value: 'div:has(> section[advert])',
                            ...context.getRangeFor('div:has(> section[advert])'),
                        },
                        declarationList: {
                            type: 'Value',
                            value: 'padding-top: 0 !important; padding-bottom: 0 !important;',
                            ...context.getRangeFor('padding-top: 0 !important; padding-bottom: 0 !important;'),
                        },
                    };
                },
            },
            // complicated case
            {
                // eslint-disable-next-line max-len
                actual: '@media ((min-width: 400px) and (max-width: 700px)) { div:has(> section[advert]) { padding-top: 0 !important; padding-bottom: 0 !important; } }',
                expected: (context: NodeExpectContext): CssInjectionRuleBody => {
                    return {
                        type: 'CssInjectionRuleBody',
                        ...context.getFullRange(),
                        mediaQueryList: {
                            type: 'Value',
                            value: '((min-width: 400px) and (max-width: 700px))',
                            ...context.getRangeFor('((min-width: 400px) and (max-width: 700px))'),
                        },
                        selectorList: {
                            type: 'Value',
                            value: 'div:has(> section[advert])',
                            ...context.getRangeFor('div:has(> section[advert])'),
                        },
                        declarationList: {
                            type: 'Value',
                            value: 'padding-top: 0 !important; padding-bottom: 0 !important;',
                            ...context.getRangeFor('padding-top: 0 !important; padding-bottom: 0 !important;'),
                        },
                    };
                },
            },
            {
                // eslint-disable-next-line max-len
                actual: '@media (min-width: 400px) and (max-width: 700px) { div:has(> section[advert]) { padding-top: 0 !important; padding-bottom: 0 !important; } }',
                expected: (context: NodeExpectContext): CssInjectionRuleBody => {
                    return {
                        type: 'CssInjectionRuleBody',
                        ...context.getFullRange(),
                        mediaQueryList: {
                            type: 'Value',
                            value: '(min-width: 400px) and (max-width: 700px)',
                            ...context.getRangeFor('(min-width: 400px) and (max-width: 700px)'),
                        },
                        selectorList: {
                            type: 'Value',
                            value: 'div:has(> section[advert])',
                            ...context.getRangeFor('div:has(> section[advert])'),
                        },
                        declarationList: {
                            type: 'Value',
                            value: 'padding-top: 0 !important; padding-bottom: 0 !important;',
                            ...context.getRangeFor('padding-top: 0 !important; padding-bottom: 0 !important;'),
                        },
                    };
                },
            },
            // https://developer.mozilla.org/en-US/docs/Web/CSS/@media
            {
                // eslint-disable-next-line max-len
                actual: "@media not all and (hover: hover) { abbr::after { content: 'dummy'; } }",
                expected: (context: NodeExpectContext): CssInjectionRuleBody => {
                    return {
                        type: 'CssInjectionRuleBody',
                        ...context.getFullRange(),
                        mediaQueryList: {
                            type: 'Value',
                            value: 'not all and (hover: hover)',
                            ...context.getRangeFor('not all and (hover: hover)'),
                        },
                        selectorList: {
                            type: 'Value',
                            value: 'abbr::after',
                            ...context.getRangeFor('abbr::after'),
                        },
                        declarationList: {
                            type: 'Value',
                            value: "content: 'dummy';",
                            ...context.getRangeFor("content: 'dummy';"),
                        },
                    };
                },
            },
            // remove
            {
                actual: 'div { remove: true; }',
                expected: (context: NodeExpectContext): CssInjectionRuleBody => {
                    return {
                        type: 'CssInjectionRuleBody',
                        ...context.getFullRange(),
                        selectorList: {
                            type: 'Value',
                            value: 'div',
                            ...context.getRangeFor('div'),
                        },
                        declarationList: {
                            type: 'Value',
                            value: 'remove: true;',
                            ...context.getRangeFor('remove: true;'),
                        },
                        remove: true,
                    };
                },
            },
        ])("should parse input: '$actual'", ({ actual, expected }) => {
            expect(AdgCssInjectionParser.parse(actual)).toMatchObject(expected(new NodeExpectContext(actual)));
        });
    });

    describe('parser options should work as expected', () => {
        test.each<{ actual: string; expected: CssInjectionRuleBody }>([
            {
                actual: 'div { padding: 0; }',
                expected: {
                    type: 'CssInjectionRuleBody',
                    selectorList: {
                        type: 'Value',
                        value: 'div',
                    },
                    declarationList: {
                        type: 'Value',
                        value: 'padding: 0;',
                    },
                    remove: false,
                },
            },
        ])('isLocIncluded should work for $actual', ({ actual, expected }) => {
            expect(AdgCssInjectionParser.parse(actual, { isLocIncluded: false })).toEqual(expected);
        });
    });

    describe('AdgCssInjectionParser.parse - invalid', () => {
        test.each<{ actual: string; expected: NodeExpectFn<AdblockSyntaxError> }>([
            // media query / selector / declaration list is empty
            {
                actual: '{ padding: 0; }',
                //       ~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        ADG_CSS_INJ_ERROR_MESSAGES.SELECTOR_LIST_IS_EMPTY,
                        ...context.toTuple(context.getFullRange()),
                    );
                },
            },
            {
                actual: ' { padding: 0; }',
                //        ~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        ADG_CSS_INJ_ERROR_MESSAGES.SELECTOR_LIST_IS_EMPTY,
                        ...context.toTuple(context.getRangeFor('{ padding: 0; }')),
                    );
                },
            },
            {
                actual: '  { padding: 0; }',
                //         ~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        ADG_CSS_INJ_ERROR_MESSAGES.SELECTOR_LIST_IS_EMPTY,
                        ...context.toTuple(context.getRangeFor('{ padding: 0; }')),
                    );
                },
            },
            {
                actual: '* {}',
                //          ~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        ADG_CSS_INJ_ERROR_MESSAGES.DECLARATION_LIST_IS_EMPTY,
                        ...context.toTuple(context.getRangeFor('}')),
                    );
                },
            },
            {
                actual: '* { }',
                //           ~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        ADG_CSS_INJ_ERROR_MESSAGES.DECLARATION_LIST_IS_EMPTY,
                        ...context.toTuple(context.getRangeFor('}')),
                    );
                },
            },
            {
                actual: '* {  }',
                //            ~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        ADG_CSS_INJ_ERROR_MESSAGES.DECLARATION_LIST_IS_EMPTY,
                        ...context.toTuple(context.getRangeFor('}')),
                    );
                },
            },

            // media should be followed by (, optionally preceded by whitespace
            {
                actual: '@media',
                //            ~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(
                            CSS_TOKEN_STREAM_ERROR_MESSAGES.EXPECTED_ANY_TOKEN_BUT_GOT,
                            END_OF_INPUT,
                        ),
                        ...context.toTuple(context.getRangeFor('a')),
                    );
                },
            },
            {
                actual: '@media ',
                //             ~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(
                            CSS_TOKEN_STREAM_ERROR_MESSAGES.EXPECTED_ANY_TOKEN_BUT_GOT,
                            END_OF_INPUT,
                        ),
                        ...context.toTuple(context.getRangeFor(' ')),
                    );
                },
            },
            {
                actual: '@media ident',
                //                  ~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(
                            CSS_TOKEN_STREAM_ERROR_MESSAGES.EXPECTED_TOKEN_BUT_GOT,
                            getFormattedTokenName(TokenType.OpenCurlyBracket),
                            END_OF_INPUT,
                        ),
                        ...context.toTuple(context.getRangeFor('t')),
                    );
                },
            },
            {
                actual: '@media ident ()',
                //                     ~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(
                            CSS_TOKEN_STREAM_ERROR_MESSAGES.EXPECTED_TOKEN_BUT_GOT,
                            getFormattedTokenName(TokenType.OpenCurlyBracket),
                            END_OF_INPUT,
                        ),
                        ...context.toTuple(context.getRangeFor(')')),
                    );
                },
            },

            // expected { before declaration list
            {
                actual: 'div',
                //         ~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(
                            CSS_TOKEN_STREAM_ERROR_MESSAGES.EXPECTED_TOKEN_BUT_GOT,
                            getFormattedTokenName(TokenType.OpenCurlyBracket),
                            END_OF_INPUT,
                        ),
                        ...context.toTuple(context.getRangeFor('v')),
                    );
                },
            },
            {
                actual: 'div { padding: 1;',
                //                       ~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(
                            CSS_TOKEN_STREAM_ERROR_MESSAGES.EXPECTED_TOKEN_BUT_GOT,
                            getFormattedTokenName(TokenType.CloseCurlyBracket),
                            END_OF_INPUT,
                        ),
                        ...context.toTuple(context.getRangeFor(';')),
                    );
                },
            },
            {
                actual: 'div { remove: aa; }',
                //                     ~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        sprintf(
                            CSS_TOKEN_STREAM_ERROR_MESSAGES.EXPECTED_TOKEN_WITH_VALUE_BUT_GOT,
                            getFormattedTokenName(TokenType.Ident),
                            REMOVE_VALUE,
                            'aa',
                        ),
                        ...context.toTuple(context.getRangeFor('aa')),
                    );
                },
            },
        ])("should throw on input: '$actual'", ({ actual, expected: expectedFn }) => {
            const fn = vi.fn(() => AdgCssInjectionParser.parse(actual));

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

    describe('AdgCssInjectionParser.generate', () => {
        test.each<{ actual: string; expected: string }>([
            {
                actual: 'div { padding: 0; }',
                expected: 'div { padding: 0; }',
            },
            // Extra whitespace
            {
                actual: '    div   {     padding: 0;      }     ',
                expected: 'div { padding: 0; }',
            },
            {
                // eslint-disable-next-line max-len
                actual: '@media ((min-width: 400px) and (max-width: 700px)) { div:has(> section[advert]) { padding-top: 0 !important; padding-bottom: 0 !important; } }',
                // eslint-disable-next-line max-len
                expected: '@media ((min-width: 400px) and (max-width: 700px)) { div:has(> section[advert]) { padding-top: 0 !important; padding-bottom: 0 !important; } }',
            },
        ])('should generate input: \'$actual\'', ({ actual, expected }) => {
            expect(AdgCssInjectionGenerator.generate(AdgCssInjectionParser.parse(actual))).toBe(expected);
        });
    });
});
