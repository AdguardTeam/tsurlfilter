import {
    List,
    find,
    toPlainObject,
    type CssNode,
    type DeclarationList,
    type FunctionNode,
    type MediaQuery,
    type MediaQueryList,
    type PseudoClassSelector,
    type Selector,
    type SelectorList,
    type Value,
    type ValuePlain,
} from '@adguard/ecss-tree';

import { CssTree } from '../../src/utils/csstree';
import { CssTreeNodeType, CssTreeParserContext } from '../../src/utils/csstree-constants';

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

    describe('getSelectorExtendedCssNodes', () => {
        test.each([
            ['#test', []],
            ['div', []],
            ['.test', []],
            [
                '#test[-ext-contains="something"]',
                [
                    {
                        name: {
                            type: 'Identifier',
                            name: '-ext-contains',
                        },
                    },
                ],
            ],
            [
                ':contains(a)',
                [
                    {
                        name: 'contains',
                        type: 'PseudoClassSelector',
                    },
                ],
            ],
            [
                '#test[-ext-contains="something"]:-abp-has(.ad):if-not([ad]):not([some])::before',
                [
                    {
                        name: {
                            type: 'Identifier',
                            name: '-ext-contains',
                        },
                    },
                    {
                        name: '-abp-has',
                        type: 'PseudoClassSelector',
                    },
                    {
                        name: 'if-not',
                        type: 'PseudoClassSelector',
                    },
                ],
            ],
        ])('getSelectorExtendedCssNodes(%s)', (selector, expected) => {
            expect(CssTree.getSelectorExtendedCssNodes(selector)).toMatchObject(expected);
        });
    });

    describe('isForbiddenFunction', () => {
        test.each([
            ['calc(1px + 2px)', false],
            ['var(--test)', false],

            ['url(http://example.com)', true],
            ['url(\'http://example.com\')', true],
            ['url("http://example.com")', true],

            ['image-set(url(http://example.com) 1x)', true],
            ['image-set(url(\'http://example.com\') 1x)', true],
            ['image-set(url("http://example.com") 1x)', true],

            ['image(url(http://example.com))', true],
            ['image(url(\'http://example.com\'))', true],
            ['image(url("http://example.com"))', true],

            ['cross-fade(url(http://example.com), url(http://example.com), 50%)', true],
            ['cross-fade(url(\'http://example.com\'), url(\'http://example.com\'), 50%)', true],
            ['cross-fade(url("http://example.com"), url("http://example.com"), 50%)', true],
        ])('isForbiddenFunction should work for %s', (func, expected) => {
            const valueAst = <ValuePlain>toPlainObject(CssTree.parse(func, CssTreeParserContext.value));
            expect(valueAst.type).toBe(CssTreeNodeType.Value);
            expect([
                CssTreeNodeType.Function,
                CssTreeNodeType.Url,
            ]).toContain(valueAst.children[0].type);

            const funcAst = (<ValuePlain>valueAst).children[0];
            expect(CssTree.isForbiddenFunction(funcAst)).toBe(expected);
        });
    });

    describe('getForbiddenFunctionNodes', () => {
        test.each([
            // [input, expected]

            // Legitimate cases
            ['color: red;', []],
            ['color: red !important; padding-top: 2rem !important;', []],
            ['color: red !important; padding-top: 2rem;', []],
            ['remove: true', []],
            ['height: calc(1px + 2px)', []],

            [
                'background-image: url(http://example.com)',
                [
                    {
                        type: 'Url',
                        loc: {
                            source: '<unknown>',
                            start: {
                                offset: 18,
                                line: 1,
                                column: 19,
                            },
                            end: {
                                offset: 41,
                                line: 1,
                                column: 42,
                            },
                        },
                        value: 'http://example.com',
                    },
                ],
            ],

            [
                'color: red; height: calc(1px + 2px); background-image: url(http://example.net)',
                [
                    {
                        type: 'Url',
                        loc: {
                            source: '<unknown>',
                            start: {
                                offset: 55,
                                line: 1,
                                column: 56,
                            },
                            end: {
                                offset: 78,
                                line: 1,
                                column: 79,
                            },
                        },
                        value: 'http://example.net',
                    },
                ],
            ],

            [
                'color: var(--test); height: calc(1px + 2px); background-image: -webkit-cross-fade(url(http://example.net), url(http://example.net), 50%)',
                [
                    {
                        type: 'Function',
                        loc: {
                            source: '<unknown>',
                            start: {
                                offset: 63,
                                line: 1,
                                column: 64,
                            },
                            end: {
                                offset: 136,
                                line: 1,
                                column: 137,
                            },
                        },
                        name: '-webkit-cross-fade',
                        children: [
                            {
                                type: 'Url',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 82,
                                        line: 1,
                                        column: 83,
                                    },
                                    end: {
                                        offset: 105,
                                        line: 1,
                                        column: 106,
                                    },
                                },
                                value: 'http://example.net',
                            },
                            {
                                type: 'Operator',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 105,
                                        line: 1,
                                        column: 106,
                                    },
                                    end: {
                                        offset: 106,
                                        line: 1,
                                        column: 107,
                                    },
                                },
                                value: ',',
                            },
                            {
                                type: 'Url',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 107,
                                        line: 1,
                                        column: 108,
                                    },
                                    end: {
                                        offset: 130,
                                        line: 1,
                                        column: 131,
                                    },
                                },
                                value: 'http://example.net',
                            },
                            {
                                type: 'Operator',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 130,
                                        line: 1,
                                        column: 131,
                                    },
                                    end: {
                                        offset: 131,
                                        line: 1,
                                        column: 132,
                                    },
                                },
                                value: ',',
                            },
                            {
                                type: 'Percentage',
                                loc: {
                                    source: '<unknown>',
                                    start: {
                                        offset: 132,
                                        line: 1,
                                        column: 133,
                                    },
                                    end: {
                                        offset: 135,
                                        line: 1,
                                        column: 136,
                                    },
                                },
                                value: '50',
                            },
                        ],
                    },
                    {
                        type: 'Url',
                        loc: {
                            source: '<unknown>',
                            start: {
                                offset: 107,
                                line: 1,
                                column: 108,
                            },
                            end: {
                                offset: 130,
                                line: 1,
                                column: 131,
                            },
                        },
                        value: 'http://example.net',
                    },
                ],
            ],

        ])('getForbiddenFunctionNodes should work for %s', (input, expected) => {
            const nodes = CssTree.getForbiddenFunctionNodes(input).map(toPlainObject);
            // Strict equality
            expect(nodes).toEqual(expected);
        });
    });

    describe('hasAnyForbiddenFunction', () => {
        test.each([
            // [input, expected]

            // Legitimate cases
            ['color: red;', false],
            ['color: red !important; padding-top: 2rem !important;', false],
            ['color: red !important; padding-top: 2rem;', false],
            ['remove: true', false],
            ['height: calc(1px + 2px)', false],

            // image-set()
            ['background: image-set(url("image.png") 1x);', true],
            ['background: image-set(url(\'image.png\') 1x);', true],
            ['background: image-set(url(image.png) 1x);', true],
            ['background: image-set(url("http://example.com/image.png") 1x);', true],
            ['background: image-set(url(\'http://example.com/image.png\') 1x);', true],
            ['background: image-set(url(http://example.com/image.png) 1x);', true],

            // -webkit-image-set()
            ['background: -webkit-image-set(url("image.png") 1x);', true],
            ['background: -webkit-image-set(url(\'image.png\') 1x);', true],
            ['background: -webkit-image-set(url(image.png) 1x);', true],
            ['background: -webkit-image-set(url("http://example.com/image.png") 1x);', true],
            ['background: -webkit-image-set(url(\'http://example.com/image.png\') 1x);', true],
            ['background: -webkit-image-set(url(http://example.com/image.png) 1x);', true],

            // image()
            ['background: image(url("image.png"));', true],
            ['background: image(url(\'image.png\'));', true],
            ['background: image(url(image.png));', true],
            ['background: image(url("http://example.com/image.png"));', true],
            ['background: image(url(\'http://example.com/image.png\'));', true],
            ['background: image(url(http://example.com/image.png));', true],

            // cross-fade()
            ['background: cross-fade(url("image.png"), url("image2.png"));', true],
            ['background: cross-fade(url(\'image.png\'), url(\'image2.png\'));', true],
            ['background: cross-fade(url(image.png), url(image2.png));', true],
            ['background: cross-fade(url("http://example.com/image.png"), url("http://example.com/image2.png"));', true],
            ['background: cross-fade(url(\'http://example.com/image.png\'), url(\'http://example.com/image2.png\'));', true],
            ['background: cross-fade(url(http://example.com/image.png), url(http://example.com/image2.png));', true],

            // -webkit-cross-fade()
            ['background: -webkit-cross-fade(url("image.png"), url("image2.png"));', true],
            ['background: -webkit-cross-fade(url(\'image.png\'), url(\'image2.png\'));', true],
            ['background: -webkit-cross-fade(url(image.png), url(image2.png));', true],
            ['background: -webkit-cross-fade(url("http://example.com/image.png"), url("http://example.com/image2.png"));', true],
            ['background: -webkit-cross-fade(url(\'http://example.com/image.png\'), url(\'http://example.com/image2.png\'));', true],
            ['background: -webkit-cross-fade(url(http://example.com/image.png), url(http://example.com/image2.png));', true],

            // Special CSSTree case: url()
            ['background: url("image.png");', true],
            ['background: url(\'image.png\');', true],
            ['background: url(image.png);', true],
            ['background: url("http://example.com/image.png");', true],
            ['background: url(\'http://example.com/image.png\');', true],
            ['background: url(http://example.com/image.png);', true],

            ['background-image: url("image.png");', true],
            ['background-image: url(\'image.png\');', true],
            ['background-image: url(image.png);', true],
            ['background-image: url("http://example.com/image.png");', true],
            ['background-image: url(\'http://example.com/image.png\');', true],
            ['background-image: url(http://example.com/image.png);', true],
        ])('hasAnyForbiddenFunction should work for %s', (block, expected) => {
            expect(CssTree.hasAnyForbiddenFunction(block)).toBe(expected);
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

    describe('generatePseudoClassValue', () => {
        test.each([
            {
                actual: ':not(.a, .b)',
                expected: '.a, .b',
            },
            {
                actual: ':nth-child(2n+1)',
                expected: '2n+1',
            },
            {
                actual: ':matches-path(/path)',
                expected: '/path',
            },
            {
                actual: ':matches-path(/^\\/path/)',
                expected: '/^\\/path/',
            },
            {
                actual: ':matches-path(/\\/(sub1|sub2)\\/page\\.html/)',
                expected: '/\\/(sub1|sub2)\\/page\\.html/',
            },
            {
                actual: ':has(> [class^="a"])',
                expected: '> [class^="a"]',
            },
        ])('should generate \'$expected\' from \'$actual\'', ({ actual, expected }) => {
            // Parse the actual value as a selector, then find the first pseudo class node
            const ast = CssTree.parse(actual, CssTreeParserContext.selector) as Selector;
            const pseudo = find(ast, (node) => node.type === CssTreeNodeType.PseudoClassSelector);

            if (!pseudo) {
                throw new Error('Pseudo class not found');
            }

            expect(
                CssTree.generatePseudoClassValue(pseudo as PseudoClassSelector),
            ).toEqual(expected);
        });
    });

    describe('generateFunctionValue', () => {
        test.each([
            {
                actual: 'func(aaa)',
                expected: 'aaa',
            },
            {
                actual: 'responseheader(header-name)',
                expected: 'header-name',
            },
        ])('should generate \'$expected\' from \'$actual\'', ({ actual, expected }) => {
            const ast = CssTree.parse(actual, CssTreeParserContext.value) as Value;
            const func = find(ast, (node) => node.type === CssTreeNodeType.Function);

            if (!func) {
                throw new Error('Function node not found');
            }

            expect(
                CssTree.generateFunctionValue(func as FunctionNode),
            ).toEqual(expected);
        });
    });
});
