import {
    CssNode,
    DeclarationList,
    List,
    MediaQuery,
    MediaQueryList,
    Selector,
    SelectorList,
    toPlainObject,
} from '@adguard/ecss-tree';
import { CssTree } from '../../src/utils/csstree';
import { CssTreeParserContext } from '../../src/utils/csstree-constants';

describe('CSSTree utils', () => {
    test('shiftNodePosition', () => {
        // Don't shift anything
        expect(
            toPlainObject(
                CssTree.shiftNodePosition(
                    CssTree.parse('#test', CssTreeParserContext.selector),
                ),
            ),
        ).toMatchObject({
            type: 'Selector',
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
            children: [
                {
                    type: 'IdSelector',
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
                    name: 'test',
                },
            ],
        });

        // Shift by 10 characters and 4 lines
        expect(
            toPlainObject(
                CssTree.shiftNodePosition(
                    CssTree.parse('#test', CssTreeParserContext.selector),
                    {
                        offset: 10,
                        line: 5,
                        column: 1,
                    },
                ),
            ),
        ).toMatchObject({
            type: 'Selector',
            loc: {
                start: {
                    offset: 10,
                    line: 5,
                    column: 1,
                },
                end: {
                    offset: 15,
                    line: 5,
                    column: 6,
                },
            },
            children: [
                {
                    type: 'IdSelector',
                    loc: {
                        start: {
                            offset: 10,
                            line: 5,
                            column: 1,
                        },
                        end: {
                            offset: 15,
                            line: 5,
                            column: 6,
                        },
                    },
                    name: 'test',
                },
            ],
        });
    });

    test('parse', () => {
        // Invalid cases (strict mode)
        expect(() => CssTree.parse('body { a }', CssTreeParserContext.rule)).toThrowError(
            /^ECSSTree parsing error/,
        );

        // Tolerant mode parses invalid data as raw
        expect(() => CssTree.parse('body { a }', CssTreeParserContext.rule, true)).not.toThrowError();

        // Don't throw on invalid inputs
        // No need to test all possible cases here, just a few of them, because we just
        // wrap the original CSSTree.parse() function, which is already tested
        expect(() => CssTree.parse('.a', CssTreeParserContext.selector)).not.toThrowError();
        expect(() => CssTree.parse('a', CssTreeParserContext.selector)).not.toThrowError();
        expect(() => CssTree.parse('#a', CssTreeParserContext.selector)).not.toThrowError();

        // Syntactically complicated selector
        expect(
            () => CssTree.parse('[a="b"i] + *:not(.a, #b) ~ :contains(c)', CssTreeParserContext.selector),
        ).not.toThrowError();

        // Selector list
        expect(() => CssTree.parse('a, b', CssTreeParserContext.selectorList)).not.toThrowError();

        // Complex rule
        expect(
            () => CssTree.parse(
                '[a="b"i] + *:not(.a, #b) ~ :contains(c"d) { padding: 2px !important; color: red; }',
                CssTreeParserContext.rule,
            ),
        ).not.toThrowError();
    });

    test('getSelectorExtendedCssNodes', () => {
        expect(
            CssTree.getSelectorExtendedCssNodes(<Selector>CssTree.parse('#test', CssTreeParserContext.selector)),
        ).toEqual({
            attributes: [],
            pseudos: [],
        });

        expect(
            CssTree.getSelectorExtendedCssNodes(
                <Selector>CssTree.parse('#test[-ext-contains="something"]', CssTreeParserContext.selector),
            ),
        ).toMatchObject({
            attributes: [
                {
                    name: {
                        type: 'Identifier',
                        name: '-ext-contains',
                    },
                },
            ],
            pseudos: [],
        });

        expect(
            CssTree.getSelectorExtendedCssNodes(
                <Selector>(
                    CssTree.parse(
                        '#test[-ext-contains="something"]:-abp-has(.ad):if-not([ad]):not([some])::before',
                        CssTreeParserContext.selector,
                    )
                ),
            ),
        ).toMatchObject({
            attributes: [
                {
                    name: {
                        type: 'Identifier',
                        name: '-ext-contains',
                    },
                },
            ],
            // Partial match, for important parts
            pseudos: [
                {
                    name: '-abp-has',
                    type: 'PseudoClassSelector',
                },
                {
                    name: 'if-not',
                    type: 'PseudoClassSelector',
                },
            ],
        });
    });

    test('generateSelector', () => {
        const parseAndGenerate = (rawSelector: string) => {
            return CssTree.generateSelector(
                <Selector>CssTree.parse(rawSelector, CssTreeParserContext.selector),
            );
        };

        expect(parseAndGenerate('div')).toEqual('div');
        expect(parseAndGenerate('#test')).toEqual('#test');
        expect(parseAndGenerate('.test')).toEqual('.test');
        expect(parseAndGenerate('.test .test')).toEqual('.test .test');
        expect(parseAndGenerate('[a=b]')).toEqual('[a=b]');
        expect(parseAndGenerate('[a="b"i]')).toEqual('[a="b" i]');
        expect(parseAndGenerate('[a="b" i]')).toEqual('[a="b" i]');
        expect(parseAndGenerate('div::first-child')).toEqual('div::first-child');
        expect(parseAndGenerate('div::a(b)')).toEqual('div::a(b)');
        expect(parseAndGenerate('div.test')).toEqual('div.test');
        expect(parseAndGenerate('div#test')).toEqual('div#test');
        expect(parseAndGenerate('div[data-advert]')).toEqual('div[data-advert]');
        expect(parseAndGenerate(':lang(hu-hu)')).toEqual(':lang(hu-hu)');

        expect(
            parseAndGenerate(
                'div[data-advert] > #test ~ div[class="advert"][id="something"]:nth-child(3n+0):first-child',
            ),
        ).toEqual('div[data-advert] > #test ~ div[class="advert"][id="something"]:nth-child(3n+0):first-child');

        expect(parseAndGenerate(':not(:not([name]))')).toEqual(':not(:not([name]))');

        // "Sub selector lists"
        expect(parseAndGenerate(':not(:not([name]):contains(2))')).toEqual(':not(:not([name]):contains(2))');

        expect(
            parseAndGenerate(
                // eslint-disable-next-line max-len
                '.teasers > div[class=" display"]:has(> div[class] > div[class] > div:not([class]):not([id]) > div:not([class]):not([id]):contains(/^REKLAMA$/))',
            ),
        ).toEqual(
            // eslint-disable-next-line max-len
            '.teasers > div[class=" display"]:has(> div[class] > div[class] > div:not([class]):not([id]) > div:not([class]):not([id]):contains(/^REKLAMA$/))',
        );
    });

    test('generateSelectorList', () => {
        const parseAndGenerate = (selectorList: string) => {
            return CssTree.generateSelectorList(
                <SelectorList>CssTree.parse(selectorList, CssTreeParserContext.selectorList),
            );
        };

        // Invalid AST
        expect(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            () => CssTree.generateSelectorList(<any>{
                type: 'SelectorList',
            }),
        ).toThrowError(
            'Selector list cannot be empty',
        );

        expect(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            () => CssTree.generateSelectorList(<any>{
                type: 'generateSelectorList',
                children: new List(),
            }),
        ).toThrowError(
            'Selector list cannot be empty',
        );

        expect(
            () => CssTree.generateSelectorList(<SelectorList>{
                type: 'SelectorList',
                children: new List().fromArray([
                    {
                        type: 'Unknown',
                    },
                ]),
            }),
        ).toThrowError(
            'Unexpected node type: Unknown',
        );

        expect(parseAndGenerate('div,div')).toEqual('div, div');
        expect(parseAndGenerate('div, div')).toEqual('div, div');
        expect(parseAndGenerate('div, div, div')).toEqual('div, div, div');
        expect(parseAndGenerate('#test, div')).toEqual('#test, div');
        expect(parseAndGenerate('#test,div,#test')).toEqual('#test, div, #test');
        expect(parseAndGenerate('#test, div, #test')).toEqual('#test, div, #test');
        expect(parseAndGenerate('.test, div')).toEqual('.test, div');
        expect(parseAndGenerate('[a=b],#test')).toEqual('[a=b], #test');
        expect(parseAndGenerate('[a=b], #test')).toEqual('[a=b], #test');
        expect(parseAndGenerate('[a="b"i],#test')).toEqual('[a="b" i], #test');
        expect(parseAndGenerate('[a="b" i], #test')).toEqual('[a="b" i], #test');
        expect(parseAndGenerate('div::first-child,#test')).toEqual('div::first-child, #test');
        expect(parseAndGenerate('div::first-child, #test')).toEqual('div::first-child, #test');
        expect(parseAndGenerate('div::a(b),#test')).toEqual('div::a(b), #test');
        expect(parseAndGenerate('div::a(b), #test')).toEqual('div::a(b), #test');
        expect(parseAndGenerate('div.test,#test')).toEqual('div.test, #test');
        expect(parseAndGenerate('div.test, #test')).toEqual('div.test, #test');
        expect(parseAndGenerate('div#test,#test')).toEqual('div#test, #test');
        expect(parseAndGenerate('div#test, #test')).toEqual('div#test, #test');
        expect(parseAndGenerate('div[data-advert],#test')).toEqual('div[data-advert], #test');
        expect(parseAndGenerate('div[data-advert], #test')).toEqual('div[data-advert], #test');
        expect(parseAndGenerate(':lang(hu-hu),#test')).toEqual(':lang(hu-hu), #test');
        expect(parseAndGenerate(':lang(hu-hu), #test')).toEqual(':lang(hu-hu), #test');
        expect(
            parseAndGenerate(
                'div[data-advert] > #test ~ div[class="advert"][id="something"]:nth-child(3n+0):first-child,#test',
            ),
        ).toEqual(
            'div[data-advert] > #test ~ div[class="advert"][id="something"]:nth-child(3n+0):first-child, #test',
        );
        expect(parseAndGenerate('#test:not(.a, .b)')).toEqual('#test:not(.a, .b)');

        expect(
            CssTree.generateSelector({
                type: 'Selector',
                children: new List<CssNode>().fromArray([
                    {
                        type: 'PseudoClassSelector',
                        name: 'not',
                        children: new List<CssNode>().fromArray([
                            {
                                type: 'SelectorList',
                                children: new List<CssNode>().fromArray([
                                    {
                                        type: 'Selector',
                                        children: new List<CssNode>().fromArray([
                                            {
                                                type: 'ClassSelector',
                                                name: 'a',
                                            },
                                        ]),
                                    },
                                    {
                                        type: 'Raw',
                                        value: '/raw/',
                                    },
                                ]),
                            },
                        ]),
                    },
                ]),
            }),
        ).toEqual(
            ':not(.a, /raw/)',
        );
    });

    test('generateMediaQuery', () => {
        const parseAndGenerate = (mediaQuery: string) => {
            // eslint-disable-next-line max-len
            return CssTree.generateMediaQuery(<MediaQuery>CssTree.parse(mediaQuery, CssTreeParserContext.mediaQuery));
        };

        // Invalid AST
        expect(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            () => CssTree.generateMediaQuery(<any>{
                type: 'MediaQuery',
            }),
        ).toThrowError(
            'Media query cannot be empty',
        );

        expect(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            () => CssTree.generateMediaQuery(<any>{
                type: 'MediaQuery',
                children: new List(),
            }),
        ).toThrowError(
            'Media query cannot be empty',
        );

        expect(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            () => CssTree.generateMediaQuery(<any>{
                type: 'MediaQuery',
                children: new List().fromArray([
                    {
                        type: 'Unknown',
                    },
                ]),
            }),
        ).toThrowError(
            'Unexpected node type: Unknown',
        );

        expect(parseAndGenerate('screen')).toEqual('screen');
        expect(parseAndGenerate('(max-width: 100px)')).toEqual(
            '(max-width: 100px)',
        );
    });

    test('generateMediaQueryList', () => {
        const parseAndGenerate = (mediaQueryList: string) => {
            // eslint-disable-next-line max-len
            return CssTree.generateMediaQueryList(<MediaQueryList>CssTree.parse(mediaQueryList, CssTreeParserContext.mediaQueryList));
        };

        // Invalid AST
        expect(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            () => CssTree.generateMediaQueryList(<any>{
                type: 'MediaQueryList',
            }),
        ).toThrowError(
            'Media query list cannot be empty',
        );

        expect(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            () => CssTree.generateMediaQueryList(<any>{
                type: 'MediaQueryList',
                children: new List(),
            }),
        ).toThrowError(
            'Media query list cannot be empty',
        );

        expect(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            () => CssTree.generateMediaQueryList(<any>{
                type: 'MediaQueryList',
                children: new List().fromArray([
                    {
                        type: 'Unknown',
                    },
                ]),
            }),
        ).toThrowError(
            'Unexpected node type: Unknown',
        );

        expect(parseAndGenerate('screen and (max-width: 100px)')).toEqual('screen and (max-width: 100px)');
        expect(parseAndGenerate('screen and (max-width: 100px) and (min-width: 50px)')).toEqual(
            'screen and (max-width: 100px) and (min-width: 50px)',
        );

        // eslint-disable-next-line max-len
        expect(parseAndGenerate('screen and (max-width: 100px) and (min-width: 50px) and (orientation: landscape)')).toEqual(
            'screen and (max-width: 100px) and (min-width: 50px) and (orientation: landscape)',
        );

        expect(parseAndGenerate('screen, print')).toEqual('screen, print');
    });

    test('generateBlock', () => {
        const parseAndGenerate = (declarationList: string) => {
            // eslint-disable-next-line max-len
            return CssTree.generateDeclarationList(<DeclarationList>CssTree.parse(declarationList, CssTreeParserContext.declarationList));
        };

        expect(parseAndGenerate('padding: 0;')).toEqual('padding: 0;');
        expect(parseAndGenerate('padding: 0')).toEqual('padding: 0;');
        expect(parseAndGenerate('padding: 0!important')).toEqual('padding: 0 !important;');
        expect(parseAndGenerate('padding: 0 !important')).toEqual('padding: 0 !important;');
        expect(parseAndGenerate('padding: 0!important;')).toEqual('padding: 0 !important;');
        expect(parseAndGenerate('padding: 0 !important;')).toEqual('padding: 0 !important;');
        expect(parseAndGenerate('padding: 0!important; margin: 2px')).toEqual('padding: 0 !important; margin: 2px;');

        // Complex cases
        expect(parseAndGenerate('padding: 0 1px 2px 3px')).toEqual('padding: 0 1px 2px 3px;');

        // eslint-disable-next-line max-len
        expect(parseAndGenerate('padding: 0 1px 2px 3px; margin: 0 1px 2px 3px; background: url(http://example.com)')).toEqual(
            'padding: 0 1px 2px 3px; margin: 0 1px 2px 3px; background: url(http://example.com);',
        );
    });
});
