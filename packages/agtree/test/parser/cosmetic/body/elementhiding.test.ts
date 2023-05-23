import { ElementHidingBodyParser } from '../../../../src/parser/cosmetic/body/elementhiding';

// ! Please note that CSSTree is fully tested elsewhere
describe('ElementHidingBodyParser', () => {
    test('parse', () => {
        // Single selector
        expect(ElementHidingBodyParser.parse('.test')).toMatchObject({
            type: 'ElementHidingRuleBody',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 5,
                    line: 1,
                    column: 6,
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
                        offset: 5,
                        line: 1,
                        column: 6,
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
                                offset: 5,
                                line: 1,
                                column: 6,
                            },
                        },
                        children: [
                            {
                                type: 'ClassSelector',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 0,
                                        line: 1,
                                        column: 1,
                                    },
                                    end: {
                                        offset: 5,
                                        line: 1,
                                        column: 6,
                                    },
                                },
                                name: 'test',
                            },
                        ],
                    },
                ],
            },
        });

        // Multiple selectors
        expect(ElementHidingBodyParser.parse('.test1, .test2')).toMatchObject({
            type: 'ElementHidingRuleBody',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 14,
                    line: 1,
                    column: 15,
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
                        offset: 14,
                        line: 1,
                        column: 15,
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
                                offset: 6,
                                line: 1,
                                column: 7,
                            },
                        },
                        children: [
                            {
                                type: 'ClassSelector',
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
                                name: 'test1',
                            },
                        ],
                    },
                    {
                        type: 'Selector',
                        loc: {
                            source: '<unknown>',
                            start: {
                                offset: 8,
                                line: 1,
                                column: 9,
                            },
                            end: {
                                offset: 14,
                                line: 1,
                                column: 15,
                            },
                        },
                        children: [
                            {
                                type: 'ClassSelector',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 8,
                                        line: 1,
                                        column: 9,
                                    },
                                    end: {
                                        offset: 14,
                                        line: 1,
                                        column: 15,
                                    },
                                },
                                name: 'test2',
                            },
                        ],
                    },
                ],
            },
        });

        expect(ElementHidingBodyParser.parse('.test1, .test2, [ad-model]')).toMatchObject({
            type: 'ElementHidingRuleBody',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 26,
                    line: 1,
                    column: 27,
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
                        offset: 26,
                        line: 1,
                        column: 27,
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
                                offset: 6,
                                line: 1,
                                column: 7,
                            },
                        },
                        children: [
                            {
                                type: 'ClassSelector',
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
                                name: 'test1',
                            },
                        ],
                    },
                    {
                        type: 'Selector',
                        loc: {
                            source: '<unknown>',
                            start: {
                                offset: 8,
                                line: 1,
                                column: 9,
                            },
                            end: {
                                offset: 14,
                                line: 1,
                                column: 15,
                            },
                        },
                        children: [
                            {
                                type: 'ClassSelector',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 8,
                                        line: 1,
                                        column: 9,
                                    },
                                    end: {
                                        offset: 14,
                                        line: 1,
                                        column: 15,
                                    },
                                },
                                name: 'test2',
                            },
                        ],
                    },
                    {
                        type: 'Selector',
                        loc: {
                            source: '<unknown>',
                            start: {
                                offset: 16,
                                line: 1,
                                column: 17,
                            },
                            end: {
                                offset: 26,
                                line: 1,
                                column: 27,
                            },
                        },
                        children: [
                            {
                                type: 'AttributeSelector',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 16,
                                        line: 1,
                                        column: 17,
                                    },
                                    end: {
                                        offset: 26,
                                        line: 1,
                                        column: 27,
                                    },
                                },
                                name: {
                                    type: 'Identifier',
                                    loc: {
                                        source: '<unknown>',
                                        start: {
                                            offset: 17,
                                            line: 1,
                                            column: 18,
                                        },
                                        end: {
                                            offset: 25,
                                            line: 1,
                                            column: 26,
                                        },
                                    },
                                    name: 'ad-model',
                                },
                                matcher: null,
                                value: null,
                                flags: null,
                            },
                        ],
                    },
                ],
            },
        });
    });

    test('generate', () => {
        const parseAndGenerate = (raw: string) => {
            const ast = ElementHidingBodyParser.parse(raw);

            if (ast) {
                return ElementHidingBodyParser.generate(ast);
            }

            return null;
        };

        expect(parseAndGenerate('.test1')).toEqual('.test1');
        expect(parseAndGenerate('.test1, .test2')).toEqual('.test1, .test2');
        expect(parseAndGenerate('.test1, .test2, [ad-model]')).toEqual('.test1, .test2, [ad-model]');
    });
});
