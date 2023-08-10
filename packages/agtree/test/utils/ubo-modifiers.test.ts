import { fromPlainObject, type Selector, type SelectorList } from '@adguard/ecss-tree';

import { createModifierNode } from '../../src/ast-utils/modifiers';
import { CssTree } from '../../src/utils/csstree';
import { CssTreeParserContext } from '../../src/utils/csstree-constants';
import {
    extractUboModifiersFromSelector,
    extractUboModifiersFromSelectorList,
    hasUboModifierIndicator,
} from '../../src/utils/ubo-modifiers';

describe('Extract uBO modifiers from selector', () => {
    describe('hasUboModifierIndicator', () => {
        test.each([
            {
                actual: 'div',
                expected: false,
            },
            {
                actual: ':matches-path(/aaa) div',
                expected: true,
            },
            // This is just a fast check, so the following cases are not covered,
            // but this is not a problem because we'll handle this later.
            // The point of this function is to avoid unnecessary walk through
            // selectors that definitely don't contain uBO rule modifiers.
            {
                actual: '[prop="value"][prop2=":matches-path(/aaa)"]',
                expected: true,
            },
        ])('should return $expected for \'$actual\'', ({ actual, expected }) => {
            expect(hasUboModifierIndicator(actual)).toBe(expected);
        });
    });

    describe('extractUboModifiersFromSelector', () => {
        // Valid inputs
        test.each([
            {
                actual: 'div[a="b"]',
                expected: {
                    modifiers: {
                        type: 'ModifierList',
                        children: [],
                    },
                    cleaned: 'div[a="b"]',
                },
            },
            // Here we should handle the case when the modifier only specified
            // as an attribute value
            {
                actual: 'div[a=":matches-path(/aaa)"]',
                expected: {
                    modifiers: {
                        type: 'ModifierList',
                        children: [],
                    },
                    cleaned: 'div[a=":matches-path(/aaa)"]',
                },
            },
            {
                actual: ':matches-path(/aaa) div[a="b"]',
                expected: {
                    modifiers: {
                        type: 'ModifierList',
                        children: [
                            createModifierNode('matches-path', '/aaa', false),
                        ],
                    },
                    cleaned: 'div[a="b"]',
                },
            },
            // Discard multiple spaces
            {
                actual: ':matches-path(/aaa)  div[a="b"]',
                expected: {
                    modifiers: {
                        type: 'ModifierList',
                        children: [
                            createModifierNode('matches-path', '/aaa', false),
                        ],
                    },
                    cleaned: 'div[a="b"]',
                },
            },
            // Handle exceptions
            {
                actual: ':not(:matches-path(/aaa)) div[a="b"]',
                expected: {
                    modifiers: {
                        type: 'ModifierList',
                        children: [
                            createModifierNode('matches-path', '/aaa', true),
                        ],
                    },
                    cleaned: 'div[a="b"]',
                },
            },
        ])('should clean selector \'$actual\' to \'$expected.cleaned\'', ({ actual, expected }) => {
            // We can assume that the selector is valid
            const ast = CssTree.parse(actual, CssTreeParserContext.selector) as Selector;

            // We serialize the selector just for the convenience of testing,
            // but this requires any cast
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = extractUboModifiersFromSelector(ast) as any;

            result.cleaned = CssTree.generateSelector(
                fromPlainObject(result.cleaned) as Selector,
            );

            expect(result).toMatchObject(expected);
        });

        // Problematic inputs
        test.each([
            // Combinators aren't allowed before uBO rule modifiers
            {
                actual: 'div>:matches-path(/aaa)',
                expected: 'Unexpected combinator before \':matches-path(...)\'',
            },
            {
                actual: 'div>:not(:matches-path(/aaa))',
                expected: 'Unexpected combinator before \':not(:matches-path(...))\'',
            },
            // extra spaces
            {
                actual: 'div >  :matches-path(/aaa)',
                expected: 'Unexpected combinator before \':matches-path(...)\'',
            },
            {
                actual: 'div >  :not(:matches-path(/aaa))',
                expected: 'Unexpected combinator before \':not(:matches-path(...))\'',
            },
            // Combinators aren't allowed after uBO rule modifiers
            {
                actual: ':matches-path(/aaa)>div',
                expected: 'Unexpected combinator after \':matches-path(...)\'',
            },
            {
                actual: ':not(:matches-path(/aaa))>div',
                expected: 'Unexpected combinator after \':not(:matches-path(...))\'',
            },
            // extra spaces
            {
                actual: ':matches-path(/aaa)  > div',
                expected: 'Unexpected combinator after \':matches-path(...)\'',
            },
            {
                actual: ':not(:matches-path(/aaa))  > div',
                expected: 'Unexpected combinator after \':not(:matches-path(...))\'',
            },
            // :not(:matches-path(...)) shouldn't contain any other nodes
            {
                actual: ':not(:matches-path(/aaa) div)',
                expected: 'Unexpected nodes inside \':not(:matches-path(...))\'',
            },
            // uBO modifiers only allowed at the top level
            {
                actual: ':has(:matches-path(/aaa)) div',
                expected: 'Unexpected depth for \':matches-path(...)\'',
            },
        ])('should throw \'$expected\' for \'$actual\'', ({ actual, expected }) => {
            // We can assume that the selector is valid
            const ast = CssTree.parse(actual, CssTreeParserContext.selector) as Selector;

            expect(() => extractUboModifiersFromSelector(ast)).toThrowError(expected);
        });
    });

    describe('extractUboModifiersFromSelectorList', () => {
        test.each([
            // No uBO rule modifiers
            {
                actual: 'div',
                expected: {
                    modifiers: {
                        type: 'ModifierList',
                        children: [],
                    },
                    cleaned: 'div',
                },
            },
            {
                actual: 'div, div',
                expected: {
                    modifiers: {
                        type: 'ModifierList',
                        children: [],
                    },
                    cleaned: 'div, div',
                },
            },
            // Should handle selector lists
            {
                actual: 'div[a="b"], :matches-path(/aaa) div[c="d"]',
                expected: {
                    modifiers: {
                        type: 'ModifierList',
                        children: [
                            createModifierNode('matches-path', '/aaa', false),
                        ],
                    },
                    cleaned: 'div[a="b"], div[c="d"]',
                },
            },
            {
                actual: 'div[a="b"], :not(:matches-path(/aaa)) div[c="d"]',
                expected: {
                    modifiers: {
                        type: 'ModifierList',
                        children: [
                            createModifierNode('matches-path', '/aaa', true),
                        ],
                    },
                    cleaned: 'div[a="b"], div[c="d"]',
                },
            },
        ])('should clean selector list \'$actual\' to \'$expected.cleaned\'', ({ actual, expected }) => {
            // We can assume that the selector is valid
            const ast = CssTree.parse(actual, CssTreeParserContext.selectorList) as SelectorList;

            // We serialize the selector just for the convenience of testing,
            // but this requires any cast
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = extractUboModifiersFromSelectorList(ast) as any;

            result.cleaned = CssTree.generateSelectorList(
                fromPlainObject(result.cleaned) as SelectorList,
            );

            expect(result).toMatchObject(expected);
        });
    });
});
