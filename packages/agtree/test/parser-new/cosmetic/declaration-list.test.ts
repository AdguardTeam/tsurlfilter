import { describe, expect, test } from 'vitest';

import { AdblockSyntaxError } from '../../../src/errors/adblock-syntax-error';
import type { CssDeclarationList } from '../../../src/nodes-new';
import { DeclarationListParser } from '../../../src/parser-new/cosmetic/declaration-list';
import { NodeExpectContext, type NodeExpectFn } from '../../helpers/node-utils';

describe('DeclarationListParser (parser-new)', () => {
    describe('DeclarationListParser.parse - valid cases', () => {
        test.each<{ actual: string; expected: NodeExpectFn<CssDeclarationList> }>([
            // single declaration
            {
                actual: 'display: none',
                expected: (context) => ({
                    type: 'CssDeclarationList',
                    children: [{
                        type: 'CssDeclaration',
                        property: {
                            type: 'Value',
                            value: 'display',
                            ...context.getRangeFor('display'),
                        },
                        value: {
                            type: 'Value',
                            value: 'none',
                            ...context.getRangeFor('none'),
                        },
                        important: false,
                        start: 0,
                        end: context.getRangeFor('none').end,
                    }],
                    ...context.getFullRange(),
                }),
            },

            // two declarations
            {
                actual: 'display: none; padding: 10px',
                expected: (context) => ({
                    type: 'CssDeclarationList',
                    children: [
                        {
                            type: 'CssDeclaration',
                            property: {
                                type: 'Value',
                                value: 'display',
                                ...context.getRangeFor('display'),
                            },
                            value: {
                                type: 'Value',
                                value: 'none',
                                ...context.getRangeFor('none'),
                            },
                            important: false,
                            start: 0,
                            end: context.getRangeFor('none').end,
                        },
                        {
                            type: 'CssDeclaration',
                            property: {
                                type: 'Value',
                                value: 'padding',
                                ...context.getRangeFor('padding'),
                            },
                            value: {
                                type: 'Value',
                                value: '10px',
                                ...context.getRangeFor('10px'),
                            },
                            important: false,
                            start: context.getRangeFor('padding').start,
                            end: context.getRangeFor('10px').end,
                        },
                    ],
                    ...context.getFullRange(),
                }),
            },

            // empty string
            {
                actual: '',
                expected: (context) => ({
                    type: 'CssDeclarationList',
                    children: [],
                    ...context.getFullRange(),
                }),
            },
        ])('$actual', ({ actual, expected }) => {
            const context = new NodeExpectContext(actual);
            const result = DeclarationListParser.parse(actual);
            expect(result).toEqual(expected(context));
        });
    });

    describe('DeclarationListParser.parse - !important', () => {
        test.each<{ actual: string; expected: NodeExpectFn<CssDeclarationList> }>([
            // !important declaration
            {
                actual: 'display: none !important',
                expected: (context) => ({
                    type: 'CssDeclarationList',
                    children: [{
                        type: 'CssDeclaration',
                        property: {
                            type: 'Value',
                            value: 'display',
                            ...context.getRangeFor('display'),
                        },
                        value: {
                            type: 'Value',
                            value: 'none',
                            ...context.getRangeFor('none'),
                        },
                        important: true,
                        start: 0,
                        end: context.getFullRange().end,
                    }],
                    ...context.getFullRange(),
                }),
            },

            // mixed important and non-important
            {
                actual: 'display: none; color: red !important',
                expected: (context) => ({
                    type: 'CssDeclarationList',
                    children: [
                        {
                            type: 'CssDeclaration',
                            property: {
                                type: 'Value',
                                value: 'display',
                                ...context.getRangeFor('display'),
                            },
                            value: {
                                type: 'Value',
                                value: 'none',
                                ...context.getRangeFor('none'),
                            },
                            important: false,
                            start: 0,
                            end: context.getRangeFor('none').end,
                        },
                        {
                            type: 'CssDeclaration',
                            property: {
                                type: 'Value',
                                value: 'color',
                                ...context.getRangeFor('color'),
                            },
                            value: {
                                type: 'Value',
                                value: 'red',
                                ...context.getRangeFor('red'),
                            },
                            important: true,
                            start: context.getRangeFor('color').start,
                            end: context.getFullRange().end,
                        },
                    ],
                    ...context.getFullRange(),
                }),
            },
        ])('$actual', ({ actual, expected }) => {
            const context = new NodeExpectContext(actual);
            const result = DeclarationListParser.parse(actual);
            expect(result).toEqual(expected(context));
        });
    });

    describe('DeclarationListParser.parse - location info', () => {
        test('includes location when isLocIncluded is true', () => {
            const result = DeclarationListParser.parse('display: none', { isLocIncluded: true });
            expect(result.start).toBe(0);
            expect(result.end).toBe(13);
            expect(result.children[0].start).toBe(0);
            expect(result.children[0].end).toBeDefined();
            expect(result.children[0].property.start).toBeDefined();
            expect(result.children[0].value.start).toBeDefined();
        });

        test('excludes location when isLocIncluded is false', () => {
            const result = DeclarationListParser.parse('display: none', { isLocIncluded: false });
            expect(result.start).toBeUndefined();
            expect(result.end).toBeUndefined();
            expect(result.children[0].start).toBeUndefined();
            expect(result.children[0].end).toBeUndefined();
        });
    });

    describe('DeclarationListParser.parse - whitespace trimming', () => {
        test.each<{ actual: string; expectedProperty: string; expectedValue: string }>([
            {
                actual: '  display : none  ',
                expectedProperty: 'display',
                expectedValue: 'none',
            },
            {
                actual: 'display:none',
                expectedProperty: 'display',
                expectedValue: 'none',
            },
        ])('$actual', ({ actual, expectedProperty, expectedValue }) => {
            const result = DeclarationListParser.parse(actual);
            expect(result.children).toHaveLength(1);
            expect(result.children[0].property.value).toBe(expectedProperty);
            expect(result.children[0].value.value).toBe(expectedValue);
        });
    });

    describe('DeclarationListParser.parse - complex values', () => {
        test('function value preserved', () => {
            const result = DeclarationListParser.parse('background: url(foo.png) no-repeat');
            expect(result.children[0].value.value).toBe('url(foo.png) no-repeat');
        });

        test('custom property', () => {
            const result = DeclarationListParser.parse('--my-var: red');
            expect(result.children[0].property.value).toBe('--my-var');
        });

        test('semicolon inside parens', () => {
            const result = DeclarationListParser.parse('background: url(data:text/css;base64,abc)');
            expect(result.children[0].value.value).toBe('url(data:text/css;base64,abc)');
        });
    });

    describe('DeclarationListParser.parse - error cases', () => {
        test('throws on missing colon', () => {
            expect(() => DeclarationListParser.parse('display')).toThrow(AdblockSyntaxError);
        });

        test('throws on colon without property', () => {
            expect(() => DeclarationListParser.parse(': none')).toThrow(AdblockSyntaxError);
        });

        test('throws on at-rule', () => {
            expect(() => DeclarationListParser.parse('@media screen')).toThrow(AdblockSyntaxError);
        });
    });
});
