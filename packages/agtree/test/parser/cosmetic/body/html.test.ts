import { HtmlFilteringBodyParser } from '../../../../src/parser/cosmetic/body/html';
import { AdblockSyntax } from '../../../../src/utils/adblockers';

describe('HtmlFilteringBodyParser', () => {
    test('escapeDoubleQuotes', () => {
        expect(
            HtmlFilteringBodyParser.escapeDoubleQuotes('[tag-content="a"]'),
        ).toBe('[tag-content="a"]');

        expect(
            HtmlFilteringBodyParser.escapeDoubleQuotes('[tag-content="""a"""]'),
        ).toBe('[tag-content="\\"a\\""]');

        expect(
            HtmlFilteringBodyParser.escapeDoubleQuotes('[tag-content="""""a"""""]'),
        ).toBe('[tag-content="\\"\\"a\\"\\""]');
    });

    test('unescapeDoubleQuotes', () => {
        expect(
            HtmlFilteringBodyParser.unescapeDoubleQuotes('[tag-content="a"]'),
        ).toBe('[tag-content="a"]');

        expect(
            HtmlFilteringBodyParser.unescapeDoubleQuotes('[tag-content="\\"a\\""]'),
        ).toBe('[tag-content="""a"""]');

        expect(
            HtmlFilteringBodyParser.unescapeDoubleQuotes('[tag-content="\\"\\"a\\"\\""]'),
        ).toBe('[tag-content="""""a"""""]');
    });

    test('parse', () => {
        expect(HtmlFilteringBodyParser.parse('[tag-content="""a"""]')).toMatchObject({
            type: 'HtmlFilteringRuleBody',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 21,
                    line: 1,
                    column: 22,
                },
            },
            body: {
                type: 'SelectorList',
                loc: {
                    source: '<unknown>',
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 21,
                        line: 1,
                        column: 22,
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
                                offset: 21,
                                line: 1,
                                column: 22,
                            },
                        },
                        children: [
                            {
                                type: 'AttributeSelector',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 0,
                                        line: 1,
                                        column: 1,
                                    },
                                    end: {
                                        offset: 21,
                                        line: 1,
                                        column: 22,
                                    },
                                },
                                name: {
                                    type: 'Identifier',
                                    loc: {
                                        source: '<unknown>',
                                        start: {
                                            offset: 1,
                                            line: 1,
                                            column: 2,
                                        },
                                        end: {
                                            offset: 12,
                                            line: 1,
                                            column: 13,
                                        },
                                    },
                                    name: 'tag-content',
                                },
                                matcher: '=',
                                value: {
                                    type: 'String',
                                    loc: {
                                        source: '<unknown>',
                                        start: {
                                            offset: 13,
                                            line: 1,
                                            column: 14,
                                        },
                                        end: {
                                            offset: 20,
                                            line: 1,
                                            column: 21,
                                        },
                                    },
                                    value: '"a"',
                                },
                                flags: null,
                            },
                        ],
                    },
                ],
            },
        });

        expect(HtmlFilteringBodyParser.parse('[tag-content="""""a"""""]')).toMatchObject({
            type: 'HtmlFilteringRuleBody',
            loc: {
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
            body: {
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
                                type: 'AttributeSelector',
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
                                name: {
                                    type: 'Identifier',
                                    loc: {
                                        source: '<unknown>',
                                        start: {
                                            offset: 1,
                                            line: 1,
                                            column: 2,
                                        },
                                        end: {
                                            offset: 12,
                                            line: 1,
                                            column: 13,
                                        },
                                    },
                                    name: 'tag-content',
                                },
                                matcher: '=',
                                value: {
                                    type: 'String',
                                    loc: {
                                        source: '<unknown>',
                                        start: {
                                            offset: 13,
                                            line: 1,
                                            column: 14,
                                        },
                                        end: {
                                            offset: 24,
                                            line: 1,
                                            column: 25,
                                        },
                                    },
                                    value: '""a""',
                                },
                                flags: null,
                            },
                        ],
                    },
                ],
            },
        });

        expect(HtmlFilteringBodyParser.parse('script:has-text(a), script:has-text(b)')).toMatchObject({
            type: 'HtmlFilteringRuleBody',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 38,
                    line: 1,
                    column: 39,
                },
            },
            body: {
                type: 'SelectorList',
                loc: {
                    source: '<unknown>',
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 38,
                        line: 1,
                        column: 39,
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
                                offset: 18,
                                line: 1,
                                column: 19,
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
                                        offset: 6,
                                        line: 1,
                                        column: 7,
                                    },
                                },
                                name: 'script',
                            },
                            {
                                type: 'PseudoClassSelector',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 6,
                                        line: 1,
                                        column: 7,
                                    },
                                    end: {
                                        offset: 18,
                                        line: 1,
                                        column: 19,
                                    },
                                },
                                name: 'has-text',
                                children: [
                                    {
                                        type: 'Raw',
                                        loc: {
                                            source: '<unknown>',
                                            start: {
                                                offset: 16,
                                                line: 1,
                                                column: 17,
                                            },
                                            end: {
                                                offset: 17,
                                                line: 1,
                                                column: 18,
                                            },
                                        },
                                        value: 'a',
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        type: 'Selector',
                        loc: {
                            source: '<unknown>',
                            start: {
                                offset: 20,
                                line: 1,
                                column: 21,
                            },
                            end: {
                                offset: 38,
                                line: 1,
                                column: 39,
                            },
                        },
                        children: [
                            {
                                type: 'TypeSelector',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 20,
                                        line: 1,
                                        column: 21,
                                    },
                                    end: {
                                        offset: 26,
                                        line: 1,
                                        column: 27,
                                    },
                                },
                                name: 'script',
                            },
                            {
                                type: 'PseudoClassSelector',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 26,
                                        line: 1,
                                        column: 27,
                                    },
                                    end: {
                                        offset: 38,
                                        line: 1,
                                        column: 39,
                                    },
                                },
                                name: 'has-text',
                                children: [
                                    {
                                        type: 'Raw',
                                        loc: {
                                            source: '<unknown>',
                                            start: {
                                                offset: 36,
                                                line: 1,
                                                column: 37,
                                            },
                                            end: {
                                                offset: 37,
                                                line: 1,
                                                column: 38,
                                            },
                                        },
                                        value: 'b',
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        });

        // uBO responseheader
        expect(HtmlFilteringBodyParser.parse('responseheader(header-name)')).toMatchObject({
            type: 'HtmlFilteringRuleBody',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 27,
                    line: 1,
                    column: 28,
                },
            },
            body: {
                type: 'Function',
                loc: {
                    source: '<unknown>',
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 27,
                        line: 1,
                        column: 28,
                    },
                },
                name: 'responseheader',
                children: [
                    {
                        type: 'Identifier',
                        loc: {
                            source: '<unknown>',
                            start: {
                                offset: 15,
                                line: 1,
                                column: 16,
                            },
                            end: {
                                offset: 26,
                                line: 1,
                                column: 27,
                            },
                        },
                        name: 'header-name',
                    },
                ],
            },
        });
    });

    test('generate', () => {
        const parseAndGenerate = (raw: string, syntax: AdblockSyntax) => {
            const ast = HtmlFilteringBodyParser.parse(raw);

            if (ast) {
                return HtmlFilteringBodyParser.generate(ast, syntax);
            }

            return null;
        };

        expect(parseAndGenerate('[tag-content="""a"""]', AdblockSyntax.Adg)).toEqual('[tag-content="""a"""]');

        expect(parseAndGenerate('[tag-content="""""a"""""]', AdblockSyntax.Adg)).toEqual('[tag-content="""""a"""""]');

        expect(parseAndGenerate('script:has-text(a), script:has-text(b)', AdblockSyntax.Adg)).toEqual(
            'script:has-text(a), script:has-text(b)',
        );

        expect(
            parseAndGenerate('responseheader(header-name)', AdblockSyntax.Ubo),
        ).toEqual('responseheader(header-name)');
    });
});
