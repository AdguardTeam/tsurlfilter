import { CssInjectionBodyParser } from '../../../../src/parser/cosmetic/body/css';
import { AdblockSyntax } from '../../../../src/utils/adblockers';
import { EMPTY, SPACE } from '../../../../src/utils/constants';

describe('CssInjectionBodyParser', () => {
    test('isUboCssInjection', () => {
        expect(CssInjectionBodyParser.isUboCssInjection(EMPTY)).toBeFalsy();
        expect(CssInjectionBodyParser.isUboCssInjection(SPACE)).toBeFalsy();

        expect(CssInjectionBodyParser.isUboCssInjection('.ad')).toBeFalsy();

        expect(CssInjectionBodyParser.isUboCssInjection('body {}')).toBeFalsy();

        expect(CssInjectionBodyParser.isUboCssInjection('body { padding-top: 0 !important; }')).toBeFalsy();

        expect(
            CssInjectionBodyParser.isUboCssInjection(
                '@media (min-width: 1024px) { body { padding-top: 0 !important; } }',
            ),
        ).toBeFalsy();

        // Empty
        expect(CssInjectionBodyParser.isUboCssInjection('body:style()')).toBeFalsy();

        expect(CssInjectionBodyParser.isUboCssInjection('body:style(padding-top: 0 !important;)')).toBe(true);

        expect(CssInjectionBodyParser.isUboCssInjection('body:ad-component:remove()')).toBe(true);
    });

    test('isAdgCssInjection', () => {
        expect(CssInjectionBodyParser.isAdgCssInjection(EMPTY)).toBeFalsy();
        expect(CssInjectionBodyParser.isAdgCssInjection(SPACE)).toBeFalsy();

        expect(CssInjectionBodyParser.isAdgCssInjection('.ad')).toBeFalsy();

        // Empty
        expect(CssInjectionBodyParser.isAdgCssInjection('body {}')).toBeFalsy();

        expect(CssInjectionBodyParser.isAdgCssInjection('body { padding-top: 0 !important; }')).toBe(true);

        expect(
            CssInjectionBodyParser.isAdgCssInjection(
                '@media (min-width: 1024px) { body { padding-top: 0 !important; } }',
            ),
        ).toBe(true);

        expect(CssInjectionBodyParser.isAdgCssInjection('body:style()')).toBeFalsy();

        expect(CssInjectionBodyParser.isAdgCssInjection('body:style(padding-top: 0 !important;)')).toBeFalsy();

        expect(CssInjectionBodyParser.isAdgCssInjection('body:ad-component:remove()')).toBeFalsy();
    });

    test('parse - AdGuard', () => {
        expect(CssInjectionBodyParser.parse('body { padding-top: 0 !important; }')).toMatchObject({
            type: 'CssInjectionRuleBody',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 35,
                    line: 1,
                    column: 36,
                },
            },
            selectorList: {
                type: 'SelectorList',
                loc: {
                    source: '<unknown>',
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 4,
                        line: 1,
                        column: 5,
                    },
                },
                children: [
                    {
                        type: 'Selector',
                        loc: {
                            source: '<unknown>',
                            start: {
                                offset: 0,
                                line: 1,
                                column: 1,
                            },
                            end: {
                                offset: 4,
                                line: 1,
                                column: 5,
                            },
                        },
                        children: [
                            {
                                type: 'TypeSelector',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 0,
                                        line: 1,
                                        column: 1,
                                    },
                                    end: {
                                        offset: 4,
                                        line: 1,
                                        column: 5,
                                    },
                                },
                                name: 'body',
                            },
                        ],
                    },
                ],
            },
            declarationList: {
                type: 'DeclarationList',
                loc: {
                    source: '<unknown>',
                    start: {
                        offset: 5,
                        line: 1,
                        column: 6,
                    },
                    end: {
                        offset: 35,
                        line: 1,
                        column: 36,
                    },
                },
                children: [
                    {
                        type: 'Declaration',
                        loc: {
                            source: '<unknown>',
                            start: {
                                offset: 7,
                                line: 1,
                                column: 8,
                            },
                            end: {
                                offset: 32,
                                line: 1,
                                column: 33,
                            },
                        },
                        important: true,
                        property: 'padding-top',
                        value: {
                            type: 'Value',
                            loc: {
                                source: '<unknown>',
                                start: {
                                    offset: 20,
                                    line: 1,
                                    column: 21,
                                },
                                end: {
                                    offset: 22,
                                    line: 1,
                                    column: 23,
                                },
                            },
                            children: [
                                {
                                    type: 'Number',
                                    loc: {
                                        source: '<unknown>',
                                        start: {
                                            offset: 20,
                                            line: 1,
                                            column: 21,
                                        },
                                        end: {
                                            offset: 21,
                                            line: 1,
                                            column: 22,
                                        },
                                    },
                                    value: '0',
                                },
                            ],
                        },
                    },
                ],
            },
            remove: false,
        });

        expect(
            CssInjectionBodyParser.parse(
                // eslint-disable-next-line max-len
                'body, section:has(.something) { padding-top: 0 !important; padding-bottom: 0 !important; color: red !important; }',
            ),
        ).toMatchObject({
            type: 'CssInjectionRuleBody',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 113,
                    line: 1,
                    column: 114,
                },
            },
            selectorList: {
                type: 'SelectorList',
                loc: {
                    source: '<unknown>',
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 29,
                        line: 1,
                        column: 30,
                    },
                },
                children: [
                    {
                        type: 'Selector',
                        loc: {
                            source: '<unknown>',
                            start: {
                                offset: 0,
                                line: 1,
                                column: 1,
                            },
                            end: {
                                offset: 4,
                                line: 1,
                                column: 5,
                            },
                        },
                        children: [
                            {
                                type: 'TypeSelector',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 0,
                                        line: 1,
                                        column: 1,
                                    },
                                    end: {
                                        offset: 4,
                                        line: 1,
                                        column: 5,
                                    },
                                },
                                name: 'body',
                            },
                        ],
                    },
                    {
                        type: 'Selector',
                        loc: {
                            source: '<unknown>',
                            start: {
                                offset: 6,
                                line: 1,
                                column: 7,
                            },
                            end: {
                                offset: 29,
                                line: 1,
                                column: 30,
                            },
                        },
                        children: [
                            {
                                type: 'TypeSelector',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 6,
                                        line: 1,
                                        column: 7,
                                    },
                                    end: {
                                        offset: 13,
                                        line: 1,
                                        column: 14,
                                    },
                                },
                                name: 'section',
                            },
                            {
                                type: 'PseudoClassSelector',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 13,
                                        line: 1,
                                        column: 14,
                                    },
                                    end: {
                                        offset: 29,
                                        line: 1,
                                        column: 30,
                                    },
                                },
                                name: 'has',
                                children: [
                                    {
                                        type: 'SelectorList',
                                        loc: {
                                            source: '<unknown>',
                                            start: {
                                                offset: 18,
                                                line: 1,
                                                column: 19,
                                            },
                                            end: {
                                                offset: 28,
                                                line: 1,
                                                column: 29,
                                            },
                                        },
                                        children: [
                                            {
                                                type: 'Selector',
                                                loc: {
                                                    source: '<unknown>',
                                                    start: {
                                                        offset: 18,
                                                        line: 1,
                                                        column: 19,
                                                    },
                                                    end: {
                                                        offset: 28,
                                                        line: 1,
                                                        column: 29,
                                                    },
                                                },
                                                children: [
                                                    {
                                                        type: 'ClassSelector',
                                                        loc: {
                                                            source: '<unknown>',
                                                            start: {
                                                                offset: 18,
                                                                line: 1,
                                                                column: 19,
                                                            },
                                                            end: {
                                                                offset: 28,
                                                                line: 1,
                                                                column: 29,
                                                            },
                                                        },
                                                        name: 'something',
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
            declarationList: {
                type: 'DeclarationList',
                loc: {
                    source: '<unknown>',
                    start: {
                        offset: 30,
                        line: 1,
                        column: 31,
                    },
                    end: {
                        offset: 113,
                        line: 1,
                        column: 114,
                    },
                },
                children: [
                    {
                        type: 'Declaration',
                        loc: {
                            source: '<unknown>',
                            start: {
                                offset: 32,
                                line: 1,
                                column: 33,
                            },
                            end: {
                                offset: 57,
                                line: 1,
                                column: 58,
                            },
                        },
                        important: true,
                        property: 'padding-top',
                        value: {
                            type: 'Value',
                            loc: {
                                source: '<unknown>',
                                start: {
                                    offset: 45,
                                    line: 1,
                                    column: 46,
                                },
                                end: {
                                    offset: 47,
                                    line: 1,
                                    column: 48,
                                },
                            },
                            children: [
                                {
                                    type: 'Number',
                                    loc: {
                                        source: '<unknown>',
                                        start: {
                                            offset: 45,
                                            line: 1,
                                            column: 46,
                                        },
                                        end: {
                                            offset: 46,
                                            line: 1,
                                            column: 47,
                                        },
                                    },
                                    value: '0',
                                },
                            ],
                        },
                    },
                    {
                        type: 'Declaration',
                        loc: {
                            source: '<unknown>',
                            start: {
                                offset: 59,
                                line: 1,
                                column: 60,
                            },
                            end: {
                                offset: 87,
                                line: 1,
                                column: 88,
                            },
                        },
                        important: true,
                        property: 'padding-bottom',
                        value: {
                            type: 'Value',
                            loc: {
                                source: '<unknown>',
                                start: {
                                    offset: 75,
                                    line: 1,
                                    column: 76,
                                },
                                end: {
                                    offset: 77,
                                    line: 1,
                                    column: 78,
                                },
                            },
                            children: [
                                {
                                    type: 'Number',
                                    loc: {
                                        source: '<unknown>',
                                        start: {
                                            offset: 75,
                                            line: 1,
                                            column: 76,
                                        },
                                        end: {
                                            offset: 76,
                                            line: 1,
                                            column: 77,
                                        },
                                    },
                                    value: '0',
                                },
                            ],
                        },
                    },
                    {
                        type: 'Declaration',
                        loc: {
                            source: '<unknown>',
                            start: {
                                offset: 89,
                                line: 1,
                                column: 90,
                            },
                            end: {
                                offset: 110,
                                line: 1,
                                column: 111,
                            },
                        },
                        important: true,
                        property: 'color',
                        value: {
                            type: 'Value',
                            loc: {
                                source: '<unknown>',
                                start: {
                                    offset: 96,
                                    line: 1,
                                    column: 97,
                                },
                                end: {
                                    offset: 100,
                                    line: 1,
                                    column: 101,
                                },
                            },
                            children: [
                                {
                                    type: 'Identifier',
                                    loc: {
                                        source: '<unknown>',
                                        start: {
                                            offset: 96,
                                            line: 1,
                                            column: 97,
                                        },
                                        end: {
                                            offset: 99,
                                            line: 1,
                                            column: 100,
                                        },
                                    },
                                    name: 'red',
                                },
                            ],
                        },
                    },
                ],
            },
            remove: false,
        });

        // Complicated case: Media query, ExtCss selector
        expect(
            CssInjectionBodyParser.parse(
                // eslint-disable-next-line max-len
                '@media (min-width: 1000px) and (max-width: 2000px) { body, section:has(.something) { padding-top: 0 !important; padding-bottom: 0 !important; color: red !important; } }',
            ),
        ).toMatchObject({
            type: 'CssInjectionRuleBody',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 168,
                    line: 1,
                    column: 169,
                },
            },
            mediaQueryList: {
                type: 'MediaQueryList',
                loc: {
                    source: '<unknown>',
                    start: {
                        offset: 7,
                        line: 1,
                        column: 8,
                    },
                    end: {
                        offset: 50,
                        line: 1,
                        column: 51,
                    },
                },
                children: [
                    {
                        type: 'MediaQuery',
                        loc: {
                            source: '<unknown>',
                            start: {
                                offset: 7,
                                line: 1,
                                column: 8,
                            },
                            end: {
                                offset: 50,
                                line: 1,
                                column: 51,
                            },
                        },
                        children: [
                            {
                                type: 'MediaFeature',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 7,
                                        line: 1,
                                        column: 8,
                                    },
                                    end: {
                                        offset: 26,
                                        line: 1,
                                        column: 27,
                                    },
                                },
                                name: 'min-width',
                                value: {
                                    type: 'Dimension',
                                    loc: {
                                        source: '<unknown>',
                                        start: {
                                            offset: 19,
                                            line: 1,
                                            column: 20,
                                        },
                                        end: {
                                            offset: 25,
                                            line: 1,
                                            column: 26,
                                        },
                                    },
                                    value: '1000',
                                    unit: 'px',
                                },
                            },
                            {
                                type: 'Identifier',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 27,
                                        line: 1,
                                        column: 28,
                                    },
                                    end: {
                                        offset: 30,
                                        line: 1,
                                        column: 31,
                                    },
                                },
                                name: 'and',
                            },
                            {
                                type: 'MediaFeature',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 31,
                                        line: 1,
                                        column: 32,
                                    },
                                    end: {
                                        offset: 50,
                                        line: 1,
                                        column: 51,
                                    },
                                },
                                name: 'max-width',
                                value: {
                                    type: 'Dimension',
                                    loc: {
                                        source: '<unknown>',
                                        start: {
                                            offset: 43,
                                            line: 1,
                                            column: 44,
                                        },
                                        end: {
                                            offset: 49,
                                            line: 1,
                                            column: 50,
                                        },
                                    },
                                    value: '2000',
                                    unit: 'px',
                                },
                            },
                        ],
                    },
                ],
            },
            selectorList: {
                type: 'SelectorList',
                loc: {
                    source: '<unknown>',
                    start: {
                        offset: 53,
                        line: 1,
                        column: 54,
                    },
                    end: {
                        offset: 82,
                        line: 1,
                        column: 83,
                    },
                },
                children: [
                    {
                        type: 'Selector',
                        loc: {
                            source: '<unknown>',
                            start: {
                                offset: 53,
                                line: 1,
                                column: 54,
                            },
                            end: {
                                offset: 57,
                                line: 1,
                                column: 58,
                            },
                        },
                        children: [
                            {
                                type: 'TypeSelector',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 53,
                                        line: 1,
                                        column: 54,
                                    },
                                    end: {
                                        offset: 57,
                                        line: 1,
                                        column: 58,
                                    },
                                },
                                name: 'body',
                            },
                        ],
                    },
                    {
                        type: 'Selector',
                        loc: {
                            source: '<unknown>',
                            start: {
                                offset: 59,
                                line: 1,
                                column: 60,
                            },
                            end: {
                                offset: 82,
                                line: 1,
                                column: 83,
                            },
                        },
                        children: [
                            {
                                type: 'TypeSelector',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 59,
                                        line: 1,
                                        column: 60,
                                    },
                                    end: {
                                        offset: 66,
                                        line: 1,
                                        column: 67,
                                    },
                                },
                                name: 'section',
                            },
                            {
                                type: 'PseudoClassSelector',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 66,
                                        line: 1,
                                        column: 67,
                                    },
                                    end: {
                                        offset: 82,
                                        line: 1,
                                        column: 83,
                                    },
                                },
                                name: 'has',
                                children: [
                                    {
                                        type: 'SelectorList',
                                        loc: {
                                            source: '<unknown>',
                                            start: {
                                                offset: 71,
                                                line: 1,
                                                column: 72,
                                            },
                                            end: {
                                                offset: 81,
                                                line: 1,
                                                column: 82,
                                            },
                                        },
                                        children: [
                                            {
                                                type: 'Selector',
                                                loc: {
                                                    source: '<unknown>',
                                                    start: {
                                                        offset: 71,
                                                        line: 1,
                                                        column: 72,
                                                    },
                                                    end: {
                                                        offset: 81,
                                                        line: 1,
                                                        column: 82,
                                                    },
                                                },
                                                children: [
                                                    {
                                                        type: 'ClassSelector',
                                                        loc: {
                                                            source: '<unknown>',
                                                            start: {
                                                                offset: 71,
                                                                line: 1,
                                                                column: 72,
                                                            },
                                                            end: {
                                                                offset: 81,
                                                                line: 1,
                                                                column: 82,
                                                            },
                                                        },
                                                        name: 'something',
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
            declarationList: {
                type: 'DeclarationList',
                loc: {
                    source: '<unknown>',
                    start: {
                        offset: 83,
                        line: 1,
                        column: 84,
                    },
                    end: {
                        offset: 166,
                        line: 1,
                        column: 167,
                    },
                },
                children: [
                    {
                        type: 'Declaration',
                        loc: {
                            source: '<unknown>',
                            start: {
                                offset: 85,
                                line: 1,
                                column: 86,
                            },
                            end: {
                                offset: 110,
                                line: 1,
                                column: 111,
                            },
                        },
                        important: true,
                        property: 'padding-top',
                        value: {
                            type: 'Value',
                            loc: {
                                source: '<unknown>',
                                start: {
                                    offset: 98,
                                    line: 1,
                                    column: 99,
                                },
                                end: {
                                    offset: 100,
                                    line: 1,
                                    column: 101,
                                },
                            },
                            children: [
                                {
                                    type: 'Number',
                                    loc: {
                                        source: '<unknown>',
                                        start: {
                                            offset: 98,
                                            line: 1,
                                            column: 99,
                                        },
                                        end: {
                                            offset: 99,
                                            line: 1,
                                            column: 100,
                                        },
                                    },
                                    value: '0',
                                },
                            ],
                        },
                    },
                    {
                        type: 'Declaration',
                        loc: {
                            source: '<unknown>',
                            start: {
                                offset: 112,
                                line: 1,
                                column: 113,
                            },
                            end: {
                                offset: 140,
                                line: 1,
                                column: 141,
                            },
                        },
                        important: true,
                        property: 'padding-bottom',
                        value: {
                            type: 'Value',
                            loc: {
                                source: '<unknown>',
                                start: {
                                    offset: 128,
                                    line: 1,
                                    column: 129,
                                },
                                end: {
                                    offset: 130,
                                    line: 1,
                                    column: 131,
                                },
                            },
                            children: [
                                {
                                    type: 'Number',
                                    loc: {
                                        source: '<unknown>',
                                        start: {
                                            offset: 128,
                                            line: 1,
                                            column: 129,
                                        },
                                        end: {
                                            offset: 129,
                                            line: 1,
                                            column: 130,
                                        },
                                    },
                                    value: '0',
                                },
                            ],
                        },
                    },
                    {
                        type: 'Declaration',
                        loc: {
                            source: '<unknown>',
                            start: {
                                offset: 142,
                                line: 1,
                                column: 143,
                            },
                            end: {
                                offset: 163,
                                line: 1,
                                column: 164,
                            },
                        },
                        important: true,
                        property: 'color',
                        value: {
                            type: 'Value',
                            loc: {
                                source: '<unknown>',
                                start: {
                                    offset: 149,
                                    line: 1,
                                    column: 150,
                                },
                                end: {
                                    offset: 153,
                                    line: 1,
                                    column: 154,
                                },
                            },
                            children: [
                                {
                                    type: 'Identifier',
                                    loc: {
                                        source: '<unknown>',
                                        start: {
                                            offset: 149,
                                            line: 1,
                                            column: 150,
                                        },
                                        end: {
                                            offset: 152,
                                            line: 1,
                                            column: 153,
                                        },
                                    },
                                    name: 'red',
                                },
                            ],
                        },
                    },
                ],
            },
            remove: false,
        });

        // Remove
        expect(
            CssInjectionBodyParser.parse('body > section[ad-source] { remove: true; }'),
        ).toMatchObject({
            type: 'CssInjectionRuleBody',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 43,
                    line: 1,
                    column: 44,
                },
            },
            selectorList: {
                type: 'SelectorList',
                loc: {
                    source: '<unknown>',
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 25,
                        line: 1,
                        column: 26,
                    },
                },
                children: [
                    {
                        type: 'Selector',
                        loc: {
                            source: '<unknown>',
                            start: {
                                offset: 0,
                                line: 1,
                                column: 1,
                            },
                            end: {
                                offset: 25,
                                line: 1,
                                column: 26,
                            },
                        },
                        children: [
                            {
                                type: 'TypeSelector',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 0,
                                        line: 1,
                                        column: 1,
                                    },
                                    end: {
                                        offset: 4,
                                        line: 1,
                                        column: 5,
                                    },
                                },
                                name: 'body',
                            },
                            {
                                type: 'Combinator',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 5,
                                        line: 1,
                                        column: 6,
                                    },
                                    end: {
                                        offset: 6,
                                        line: 1,
                                        column: 7,
                                    },
                                },
                                name: '>',
                            },
                            {
                                type: 'TypeSelector',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 7,
                                        line: 1,
                                        column: 8,
                                    },
                                    end: {
                                        offset: 14,
                                        line: 1,
                                        column: 15,
                                    },
                                },
                                name: 'section',
                            },
                            {
                                type: 'AttributeSelector',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 14,
                                        line: 1,
                                        column: 15,
                                    },
                                    end: {
                                        offset: 25,
                                        line: 1,
                                        column: 26,
                                    },
                                },
                                name: {
                                    type: 'Identifier',
                                    loc: {
                                        source: '<unknown>',
                                        start: {
                                            offset: 15,
                                            line: 1,
                                            column: 16,
                                        },
                                        end: {
                                            offset: 24,
                                            line: 1,
                                            column: 25,
                                        },
                                    },
                                    name: 'ad-source',
                                },
                                matcher: null,
                                value: null,
                                flags: null,
                            },
                        ],
                    },
                ],
            },
            remove: true,
        });

        // Invalid cases
        // eslint-disable-next-line max-len
        expect(
            () => CssInjectionBodyParser.parse('body > section[ad-source] { remove: true; remove: true; }'),
        ).toThrowError(
            'Invalid declaration list, \'remove\' declaration should be used alone',
        );

        expect(
            () => CssInjectionBodyParser.parse('body > section[ad-source] { remove: true; padding: 0; }'),
        ).toThrowError(
            'Invalid declaration list, \'remove\' declaration should be used alone',
        );

        expect(
            () => CssInjectionBodyParser.parse('body > section[ad-source] { padding: 0; remove: true; }'),
        ).toThrowError(
            'Invalid declaration list, \'remove\' declaration should be used alone',
        );

        expect(() => CssInjectionBodyParser.parse('body > section[ad-source] { asd }')).toThrowError();

        // TODO: False positive alert for :xpath('//*[contains(text(),"a")]')
        // // Comments are not allowed
        // expect(
        //     () => CssInjectionBodyParser.parse(
        //         'body > section[ad-source] { padding: 2px; /* comments aren\'t allowed */ }',
        //     ),
        // ).toThrowError();
    });

    test('parse - uBlock', () => {
        expect(CssInjectionBodyParser.parse('body:style(padding-top: 0 !important;)')).toMatchObject({
            type: 'CssInjectionRuleBody',
            selectorList: {
                type: 'SelectorList',
                children: [
                    {
                        type: 'Selector',
                        children: [
                            {
                                type: 'TypeSelector',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 0,
                                        line: 1,
                                        column: 1,
                                    },
                                    end: {
                                        offset: 4,
                                        line: 1,
                                        column: 5,
                                    },
                                },
                                name: 'body',
                            },
                        ],
                    },
                ],
            },
            declarationList: {
                type: 'DeclarationList',
                loc: {
                    source: '<unknown>',
                    start: {
                        offset: 11,
                        line: 1,
                        column: 12,
                    },
                    end: {
                        offset: 36,
                        line: 1,
                        column: 37,
                    },
                },
                children: [
                    {
                        type: 'Declaration',
                        loc: {
                            source: '<unknown>',
                            start: {
                                offset: 11,
                                line: 1,
                                column: 12,
                            },
                            end: {
                                offset: 36,
                                line: 1,
                                column: 37,
                            },
                        },
                        important: true,
                        property: 'padding-top',
                        value: {
                            type: 'Value',
                            loc: {
                                source: '<unknown>',
                                start: {
                                    offset: 24,
                                    line: 1,
                                    column: 25,
                                },
                                end: {
                                    offset: 26,
                                    line: 1,
                                    column: 27,
                                },
                            },
                            children: [
                                {
                                    type: 'Number',
                                    loc: {
                                        source: '<unknown>',
                                        start: {
                                            offset: 24,
                                            line: 1,
                                            column: 25,
                                        },
                                        end: {
                                            offset: 25,
                                            line: 1,
                                            column: 26,
                                        },
                                    },
                                    value: '0',
                                },
                            ],
                        },
                    },
                ],
            },
        });

        expect(
            CssInjectionBodyParser.parse(
                // eslint-disable-next-line max-len
                'body, section:has(.something):style(padding-top: 0 !important; padding-bottom: 0 !important; color: red !important;)',
            ),
        ).toMatchObject({
            type: 'CssInjectionRuleBody',
            selectorList: {
                type: 'SelectorList',
                children: [
                    {
                        type: 'Selector',
                        loc: {
                            source: '<unknown>',
                            start: {
                                offset: 0,
                                line: 1,
                                column: 1,
                            },
                            end: {
                                offset: 4,
                                line: 1,
                                column: 5,
                            },
                        },
                        children: [
                            {
                                type: 'TypeSelector',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 0,
                                        line: 1,
                                        column: 1,
                                    },
                                    end: {
                                        offset: 4,
                                        line: 1,
                                        column: 5,
                                    },
                                },
                                name: 'body',
                            },
                        ],
                    },
                    {
                        type: 'Selector',
                        children: [
                            {
                                type: 'TypeSelector',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 6,
                                        line: 1,
                                        column: 7,
                                    },
                                    end: {
                                        offset: 13,
                                        line: 1,
                                        column: 14,
                                    },
                                },
                                name: 'section',
                            },
                            {
                                type: 'PseudoClassSelector',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 13,
                                        line: 1,
                                        column: 14,
                                    },
                                    end: {
                                        offset: 29,
                                        line: 1,
                                        column: 30,
                                    },
                                },
                                name: 'has',
                                children: [
                                    {
                                        type: 'SelectorList',
                                        loc: {
                                            source: '<unknown>',
                                            start: {
                                                offset: 18,
                                                line: 1,
                                                column: 19,
                                            },
                                            end: {
                                                offset: 28,
                                                line: 1,
                                                column: 29,
                                            },
                                        },
                                        children: [
                                            {
                                                type: 'Selector',
                                                loc: {
                                                    source: '<unknown>',
                                                    start: {
                                                        offset: 18,
                                                        line: 1,
                                                        column: 19,
                                                    },
                                                    end: {
                                                        offset: 28,
                                                        line: 1,
                                                        column: 29,
                                                    },
                                                },
                                                children: [
                                                    {
                                                        type: 'ClassSelector',
                                                        loc: {
                                                            source: '<unknown>',
                                                            start: {
                                                                offset: 18,
                                                                line: 1,
                                                                column: 19,
                                                            },
                                                            end: {
                                                                offset: 28,
                                                                line: 1,
                                                                column: 29,
                                                            },
                                                        },
                                                        name: 'something',
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
            declarationList: {
                type: 'DeclarationList',
                loc: {
                    source: '<unknown>',
                    start: {
                        offset: 36,
                        line: 1,
                        column: 37,
                    },
                    end: {
                        offset: 114,
                        line: 1,
                        column: 115,
                    },
                },
                children: [
                    {
                        type: 'Declaration',
                        loc: {
                            source: '<unknown>',
                            start: {
                                offset: 36,
                                line: 1,
                                column: 37,
                            },
                            end: {
                                offset: 61,
                                line: 1,
                                column: 62,
                            },
                        },
                        important: true,
                        property: 'padding-top',
                        value: {
                            type: 'Value',
                            loc: {
                                source: '<unknown>',
                                start: {
                                    offset: 49,
                                    line: 1,
                                    column: 50,
                                },
                                end: {
                                    offset: 51,
                                    line: 1,
                                    column: 52,
                                },
                            },
                            children: [
                                {
                                    type: 'Number',
                                    loc: {
                                        source: '<unknown>',
                                        start: {
                                            offset: 49,
                                            line: 1,
                                            column: 50,
                                        },
                                        end: {
                                            offset: 50,
                                            line: 1,
                                            column: 51,
                                        },
                                    },
                                    value: '0',
                                },
                            ],
                        },
                    },
                    {
                        type: 'Declaration',
                        loc: {
                            source: '<unknown>',
                            start: {
                                offset: 63,
                                line: 1,
                                column: 64,
                            },
                            end: {
                                offset: 91,
                                line: 1,
                                column: 92,
                            },
                        },
                        important: true,
                        property: 'padding-bottom',
                        value: {
                            type: 'Value',
                            loc: {
                                source: '<unknown>',
                                start: {
                                    offset: 79,
                                    line: 1,
                                    column: 80,
                                },
                                end: {
                                    offset: 81,
                                    line: 1,
                                    column: 82,
                                },
                            },
                            children: [
                                {
                                    type: 'Number',
                                    loc: {
                                        source: '<unknown>',
                                        start: {
                                            offset: 79,
                                            line: 1,
                                            column: 80,
                                        },
                                        end: {
                                            offset: 80,
                                            line: 1,
                                            column: 81,
                                        },
                                    },
                                    value: '0',
                                },
                            ],
                        },
                    },
                    {
                        type: 'Declaration',
                        loc: {
                            source: '<unknown>',
                            start: {
                                offset: 93,
                                line: 1,
                                column: 94,
                            },
                            end: {
                                offset: 114,
                                line: 1,
                                column: 115,
                            },
                        },
                        important: true,
                        property: 'color',
                        value: {
                            type: 'Value',
                            loc: {
                                source: '<unknown>',
                                start: {
                                    offset: 100,
                                    line: 1,
                                    column: 101,
                                },
                                end: {
                                    offset: 104,
                                    line: 1,
                                    column: 105,
                                },
                            },
                            children: [
                                {
                                    type: 'Identifier',
                                    loc: {
                                        source: '<unknown>',
                                        start: {
                                            offset: 100,
                                            line: 1,
                                            column: 101,
                                        },
                                        end: {
                                            offset: 103,
                                            line: 1,
                                            column: 104,
                                        },
                                    },
                                    name: 'red',
                                },
                            ],
                        },
                    },
                ],
            },
        });

        // Remove
        expect(CssInjectionBodyParser.parse('body > section[ad-source]:remove()')).toMatchObject({
            type: 'CssInjectionRuleBody',
            selectorList: {
                type: 'SelectorList',
                children: [
                    {
                        type: 'Selector',
                        children: [
                            {
                                type: 'TypeSelector',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 0,
                                        line: 1,
                                        column: 1,
                                    },
                                    end: {
                                        offset: 4,
                                        line: 1,
                                        column: 5,
                                    },
                                },
                                name: 'body',
                            },
                            {
                                type: 'Combinator',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 5,
                                        line: 1,
                                        column: 6,
                                    },
                                    end: {
                                        offset: 6,
                                        line: 1,
                                        column: 7,
                                    },
                                },
                                name: '>',
                            },
                            {
                                type: 'TypeSelector',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 7,
                                        line: 1,
                                        column: 8,
                                    },
                                    end: {
                                        offset: 14,
                                        line: 1,
                                        column: 15,
                                    },
                                },
                                name: 'section',
                            },
                            {
                                type: 'AttributeSelector',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 14,
                                        line: 1,
                                        column: 15,
                                    },
                                    end: {
                                        offset: 25,
                                        line: 1,
                                        column: 26,
                                    },
                                },
                                name: {
                                    type: 'Identifier',
                                    loc: {
                                        source: '<unknown>',
                                        start: {
                                            offset: 15,
                                            line: 1,
                                            column: 16,
                                        },
                                        end: {
                                            offset: 24,
                                            line: 1,
                                            column: 25,
                                        },
                                    },
                                    name: 'ad-source',
                                },
                                matcher: null,
                                value: null,
                                flags: null,
                            },
                        ],
                    },
                ],
            },
            remove: true,
        });

        expect(
            CssInjectionBodyParser.parse(
                // eslint-disable-next-line max-len
                'body > section[ad-source]:matches-media((min-width: 1000px) and (max-width: 2000px)):style(background-color: red !important;)',
            ),
        ).toMatchObject({
            type: 'CssInjectionRuleBody',
            selectorList: {
                type: 'SelectorList',
                children: [
                    {
                        type: 'Selector',
                        children: [
                            {
                                type: 'TypeSelector',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 0,
                                        line: 1,
                                        column: 1,
                                    },
                                    end: {
                                        offset: 4,
                                        line: 1,
                                        column: 5,
                                    },
                                },
                                name: 'body',
                            },
                            {
                                type: 'Combinator',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 5,
                                        line: 1,
                                        column: 6,
                                    },
                                    end: {
                                        offset: 6,
                                        line: 1,
                                        column: 7,
                                    },
                                },
                                name: '>',
                            },
                            {
                                type: 'TypeSelector',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 7,
                                        line: 1,
                                        column: 8,
                                    },
                                    end: {
                                        offset: 14,
                                        line: 1,
                                        column: 15,
                                    },
                                },
                                name: 'section',
                            },
                            {
                                type: 'AttributeSelector',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 14,
                                        line: 1,
                                        column: 15,
                                    },
                                    end: {
                                        offset: 25,
                                        line: 1,
                                        column: 26,
                                    },
                                },
                                name: {
                                    type: 'Identifier',
                                    loc: {
                                        source: '<unknown>',
                                        start: {
                                            offset: 15,
                                            line: 1,
                                            column: 16,
                                        },
                                        end: {
                                            offset: 24,
                                            line: 1,
                                            column: 25,
                                        },
                                    },
                                    name: 'ad-source',
                                },
                                matcher: null,
                                value: null,
                                flags: null,
                            },
                        ],
                    },
                ],
            },
            mediaQueryList: {
                type: 'MediaQueryList',
                loc: {
                    source: '<unknown>',
                    start: {
                        offset: 40,
                        line: 1,
                        column: 41,
                    },
                    end: {
                        offset: 83,
                        line: 1,
                        column: 84,
                    },
                },
                children: [
                    {
                        type: 'MediaQuery',
                        loc: {
                            source: '<unknown>',
                            start: {
                                offset: 40,
                                line: 1,
                                column: 41,
                            },
                            end: {
                                offset: 83,
                                line: 1,
                                column: 84,
                            },
                        },
                        children: [
                            {
                                type: 'MediaFeature',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 40,
                                        line: 1,
                                        column: 41,
                                    },
                                    end: {
                                        offset: 59,
                                        line: 1,
                                        column: 60,
                                    },
                                },
                                name: 'min-width',
                                value: {
                                    type: 'Dimension',
                                    loc: {
                                        source: '<unknown>',
                                        start: {
                                            offset: 52,
                                            line: 1,
                                            column: 53,
                                        },
                                        end: {
                                            offset: 58,
                                            line: 1,
                                            column: 59,
                                        },
                                    },
                                    value: '1000',
                                    unit: 'px',
                                },
                            },
                            {
                                type: 'Identifier',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 60,
                                        line: 1,
                                        column: 61,
                                    },
                                    end: {
                                        offset: 63,
                                        line: 1,
                                        column: 64,
                                    },
                                },
                                name: 'and',
                            },
                            {
                                type: 'MediaFeature',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 64,
                                        line: 1,
                                        column: 65,
                                    },
                                    end: {
                                        offset: 83,
                                        line: 1,
                                        column: 84,
                                    },
                                },
                                name: 'max-width',
                                value: {
                                    type: 'Dimension',
                                    loc: {
                                        source: '<unknown>',
                                        start: {
                                            offset: 76,
                                            line: 1,
                                            column: 77,
                                        },
                                        end: {
                                            offset: 82,
                                            line: 1,
                                            column: 83,
                                        },
                                    },
                                    value: '2000',
                                    unit: 'px',
                                },
                            },
                        ],
                    },
                ],
            },
            declarationList: {
                type: 'DeclarationList',
                loc: {
                    source: '<unknown>',
                    start: {
                        offset: 91,
                        line: 1,
                        column: 92,
                    },
                    end: {
                        offset: 123,
                        line: 1,
                        column: 124,
                    },
                },
                children: [
                    {
                        type: 'Declaration',
                        loc: {
                            source: '<unknown>',
                            start: {
                                offset: 91,
                                line: 1,
                                column: 92,
                            },
                            end: {
                                offset: 123,
                                line: 1,
                                column: 124,
                            },
                        },
                        important: true,
                        property: 'background-color',
                        value: {
                            type: 'Value',
                            loc: {
                                source: '<unknown>',
                                start: {
                                    offset: 109,
                                    line: 1,
                                    column: 110,
                                },
                                end: {
                                    offset: 113,
                                    line: 1,
                                    column: 114,
                                },
                            },
                            children: [
                                {
                                    type: 'Identifier',
                                    loc: {
                                        source: '<unknown>',
                                        start: {
                                            offset: 109,
                                            line: 1,
                                            column: 110,
                                        },
                                        end: {
                                            offset: 112,
                                            line: 1,
                                            column: 113,
                                        },
                                    },
                                    name: 'red',
                                },
                            ],
                        },
                    },
                ],
            },
        });

        // Duplicated :matches-media()
        expect(() => CssInjectionBodyParser.parse(
            'div:matches-media((min-width: 1000px)):matches-media((min-width: 1000px))',
        )).toThrowError("Duplicated pseudo-class 'matches-media'");

        // Duplicated :remove()
        expect(() => CssInjectionBodyParser.parse(
            'div:remove():remove()',
        )).toThrowError("Duplicated pseudo-class 'remove'");

        // Duplicate :style()
        expect(() => CssInjectionBodyParser.parse(
            'div:style(padding: 2px):style(padding: 2px)',
        )).toThrowError("Duplicated pseudo-class 'style'");

        // :remove() and :style() are not allowed to be used together
        expect(() => CssInjectionBodyParser.parse(
            'div:remove():style(padding: 2px)',
        )).toThrowError("'style' and 'remove' cannot be used together");

        expect(() => CssInjectionBodyParser.parse(
            'div:style(padding: 2px):remove()',
        )).toThrowError("'style' and 'remove' cannot be used together");

        // Regular CSS elements are not allowed after special pseudo-classes
        expect(() => CssInjectionBodyParser.parse(
            'div:matches-media((min-width: 1000px)) div',
        )).toThrowError(
            'Invalid selector, regular selector elements cannot be used after special pseudo-classes',
        );

        expect(() => CssInjectionBodyParser.parse(
            'div:remove() div',
        )).toThrowError(
            'Invalid selector, regular selector elements cannot be used after special pseudo-classes',
        );

        expect(() => CssInjectionBodyParser.parse(
            'div:style(padding: 2px) div',
        )).toThrowError(
            'Invalid selector, regular selector elements cannot be used after special pseudo-classes',
        );
    });

    test('generate', () => {
        const parseAndGenerate = (raw: string, syntax: AdblockSyntax) => {
            const ast = CssInjectionBodyParser.parse(raw);

            if (ast) {
                return CssInjectionBodyParser.generate(ast, syntax);
            }

            return null;
        };

        // Simple ADG syntax
        expect(
            parseAndGenerate('body { padding: 0!important; }', AdblockSyntax.Adg),
        ).toEqual(
            // Add space before !important
            'body { padding: 0 !important; }',
        );

        // Complex ADG syntax
        expect(
            parseAndGenerate(
                // eslint-disable-next-line max-len
                '@media (min-width: 1000px) and (max-width: 2000px) { body, section:has(.something) { remove: true; } }',
                AdblockSyntax.Adg,
            ),
        ).toEqual(
            // eslint-disable-next-line max-len
            '@media (min-width: 1000px) and (max-width: 2000px) { body, section:has(.something) { remove: true; } }',
        );

        // Simple uBO syntax
        expect(
            parseAndGenerate('body:style(padding: 0 !important;)', AdblockSyntax.Ubo),
        ).toEqual(
            'body:style(padding: 0 !important;)',
        );

        // Complex uBO syntax
        expect(
            parseAndGenerate(
                // eslint-disable-next-line max-len
                'div[advert]:has-text(/advert/i):matches-media((min-width: 1000px) and (max-width: 2000px)):style(padding: 0 !important;)',
                AdblockSyntax.Ubo,
            ),
        ).toEqual(
            // eslint-disable-next-line max-len
            'div[advert]:has-text(/advert/i):matches-media((min-width: 1000px) and (max-width: 2000px)):style(padding: 0 !important;)',
        );

        // "Convert" ADG -> uBO (NOT a full rule conversion, think :matches-path())
        expect(
            parseAndGenerate(
                // eslint-disable-next-line max-len
                '@media (min-width: 1000px) and (max-width: 2000px) { body, section:has(.something) { remove: true; } }',
                AdblockSyntax.Ubo,
            ),
        ).toEqual(
            // eslint-disable-next-line max-len
            'body, section:has(.something):matches-media((min-width: 1000px) and (max-width: 2000px)):remove()',
        );

        // "Convert" uBO -> ADG (NOT a full rule conversion, think :matches-path())
        expect(
            parseAndGenerate(
                // eslint-disable-next-line max-len
                'div[advert]:has-text(/advert/i):matches-media((min-width: 1000px) and (max-width: 2000px)):style(padding: 0 !important;)',
                AdblockSyntax.Adg,
            ),
        ).toEqual(
            // eslint-disable-next-line max-len
            '@media (min-width: 1000px) and (max-width: 2000px) { div[advert]:has-text(/advert/i) { padding: 0 !important; } }',
        );

        // ABP currently doesn't support CSS injection
        expect(() => parseAndGenerate(
            // eslint-disable-next-line max-len
            '@media (min-width: 1000px) and (max-width: 2000px) { body, section:has(.something) { remove: true; } }',
            AdblockSyntax.Abp,
        )).toThrowError(/^Unsupported syntax:/);
    });
});
