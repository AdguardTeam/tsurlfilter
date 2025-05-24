import { describe, test, expect } from 'vitest';

import { PreProcessorCommentParser } from '../../../src/parser/comment/preprocessor-parser.js';
import { EMPTY, SPACE } from '../../../src/utils/constants.js';
import { defaultParserOptions } from '../../../src/parser/options.js';
import { PreProcessorCommentGenerator } from '../../../src/generator/comment/pre-processor-comment-generator.js';
import { PreProcessorCommentSerializer } from '../../../src/serializer/comment/pre-processor-comment-serializer.js';
import { PreProcessorCommentDeserializer } from '../../../src/deserializer/comment/pre-processor-comment-deserializer.js';

describe('PreProcessorParser', () => {
    test('isPreProcessorRule', () => {
        // TODO: Refactor to test.each
        // Invalid
        expect(PreProcessorCommentParser.isPreProcessorRule(EMPTY)).toBeFalsy();
        expect(PreProcessorCommentParser.isPreProcessorRule(SPACE)).toBeFalsy();

        expect(PreProcessorCommentParser.isPreProcessorRule('!')).toBeFalsy();
        expect(PreProcessorCommentParser.isPreProcessorRule('!##')).toBeFalsy();
        expect(PreProcessorCommentParser.isPreProcessorRule('##')).toBeFalsy();
    });

    test('parse', () => {
        // TODO: Refactor to test.each
        // Valid pre-processors
        expect(PreProcessorCommentParser.parse('!#endif')).toMatchObject({
            type: 'PreProcessorCommentRule',
            start: 0,
            end: 7,
            category: 'Comment',
            syntax: 'Common',
            name: {
                type: 'Value',
                start: 2,
                end: 7,
                value: 'endif',
            },
        });

        expect(PreProcessorCommentParser.parse('!#include ../sections/ads.txt')).toMatchObject({
            type: 'PreProcessorCommentRule',
            start: 0,
            end: 29,
            category: 'Comment',
            syntax: 'Common',
            name: {
                type: 'Value',
                start: 2,
                end: 9,
                value: 'include',
            },
            params: {
                type: 'Value',
                start: 10,
                end: 29,
                value: '../sections/ads.txt',
            },
        });

        expect(PreProcessorCommentParser.parse('!#if (adguard)')).toMatchObject({
            type: 'PreProcessorCommentRule',
            start: 0,
            end: 14,
            category: 'Comment',
            syntax: 'Common',
            name: {
                type: 'Value',
                start: 2,
                end: 4,
                value: 'if',
            },
            params: {
                type: 'Parenthesis',
                start: 6,
                end: 13,
                expression: {
                    type: 'Variable',
                    start: 6,
                    end: 13,
                    name: 'adguard',
                },
            },
        });

        expect(PreProcessorCommentParser.parse('!#if      (adguard)')).toMatchObject({
            type: 'PreProcessorCommentRule',
            start: 0,
            end: 19,
            category: 'Comment',
            syntax: 'Common',
            name: {
                type: 'Value',
                start: 2,
                end: 4,
                value: 'if',
            },
            params: {
                type: 'Parenthesis',
                start: 11,
                end: 18,
                expression: {
                    type: 'Variable',
                    start: 11,
                    end: 18,
                    name: 'adguard',
                },
            },
        });

        expect(PreProcessorCommentParser.parse('!#if      (adguard)')).toMatchObject({
            type: 'PreProcessorCommentRule',
            start: 0,
            end: 19,
            category: 'Comment',
            syntax: 'Common',
            name: {
                type: 'Value',
                start: 2,
                end: 4,
                value: 'if',
            },
            params: {
                type: 'Parenthesis',
                start: 11,
                end: 18,
                expression: {
                    type: 'Variable',
                    start: 11,
                    end: 18,
                    name: 'adguard',
                },
            },
        });

        expect(
            PreProcessorCommentParser.parse('!#safari_cb_affinity(content_blockers)'),
        ).toMatchObject({
            type: 'PreProcessorCommentRule',
            start: 0,
            end: 38,
            raws: {
                text: '!#safari_cb_affinity(content_blockers)',
            },
            category: 'Comment',
            syntax: 'AdGuard',
            name: {
                type: 'Value',
                start: 2,
                end: 20,
                value: 'safari_cb_affinity',
            },
            params: {
                type: 'ParameterList',
                start: 21,
                end: 37,
                children: [
                    {
                        type: 'Value',
                        start: 21,
                        end: 37,
                        value: 'content_blockers',
                    },
                ],
            },
        });

        // If the parenthesis is open, do not split it in half along the space:
        expect(PreProcessorCommentParser.parse('!#aaa(bbb ccc)')).toMatchObject({
            type: 'PreProcessorCommentRule',
            start: 0,
            end: 14,
            category: 'Comment',
            syntax: 'Common',
            name: {
                type: 'Value',
                start: 2,
                end: 5,
                value: 'aaa',
            },
            params: {
                type: 'Value',
                start: 5,
                end: 14,
                value: '(bbb ccc)',
            },
        });

        // Invalid
        expect(() => PreProcessorCommentParser.parse('!#include    ')).toThrowError(
            'Directive "include" requires parameters',
        );

        expect(() => PreProcessorCommentParser.parse('!#safari_cb_affinity (a)')).toThrowError(
            'Unexpected whitespace after "safari_cb_affinity" directive name',
        );
    });

    describe('parser options should work as expected', () => {
        // TODO: Add template for test.each
        test.each([
            {
                actual: '!#safari_cb_affinity(content_blockers)',
                expected: {
                    type: 'PreProcessorCommentRule',
                    raws: {
                        text: '!#safari_cb_affinity(content_blockers)',
                    },
                    category: 'Comment',
                    syntax: 'AdGuard',
                    name: {
                        type: 'Value',
                        value: 'safari_cb_affinity',
                    },
                    params: {
                        type: 'ParameterList',
                        children: [
                            {
                                type: 'Value',
                                value: 'content_blockers',
                            },
                        ],
                    },
                },
            },
        ])('isLocIncluded should work for $actual', ({ actual, expected }) => {
            expect(
                PreProcessorCommentParser.parse(actual, { ...defaultParserOptions, isLocIncluded: false }),
            ).toEqual(expected);
        });
    });

    test('generate', () => {
        const parseAndGenerate = (raw: string) => {
            const ast = PreProcessorCommentParser.parse(raw);

            if (ast) {
                return PreProcessorCommentGenerator.generate(ast);
            }

            return null;
        };

        // TODO: Refactor to test.each
        expect(parseAndGenerate('!#endif')).toEqual('!#endif');

        expect(parseAndGenerate('!#include ../sections/ads.txt')).toEqual('!#include ../sections/ads.txt');

        expect(parseAndGenerate('!#safari_cb_affinity(content_blockers)')).toEqual(
            '!#safari_cb_affinity(content_blockers)',
        );

        expect(parseAndGenerate('!#if adguard')).toEqual(
            '!#if adguard',
        );

        expect(parseAndGenerate('!#if (adguard)')).toEqual(
            '!#if (adguard)',
        );

        expect(parseAndGenerate('!#if (adguard && !adguard_ext_safari)')).toEqual(
            '!#if (adguard && !adguard_ext_safari)',
        );
    });

    describe('serialize & deserialize', () => {
        test.each([
            '!#endif',
            '!#include ../sections/ads.txt',
            '!#if adguard',
            '!#if (adguard)',
            '!#if (adguard && !adguard_ext_safari)',
            '!#safari_cb_affinity(content_blockers)',
            '!#safari_cb_affinity(general)',
            '!#safari_cb_affinity',
        ])("should serialize and deserialize '%p'", async (input) => {
            await expect(input).toBeSerializedAndDeserializedProperly(
                PreProcessorCommentParser,
                PreProcessorCommentGenerator,
                PreProcessorCommentSerializer,
                PreProcessorCommentDeserializer,
            );
        });
    });
});
