import { describe, test, expect } from 'vitest';

import { CommentParser } from '../../../src/parser/comment/comment-parser.js';
import { EMPTY, SPACE } from '../../../src/utils/constants.js';
import { defaultParserOptions } from '../../../src/parser/options.js';
import { CommentRuleGenerator } from '../../../src/generator/comment/index.js';
import { CommentRuleSerializer } from '../../../src/serializer/comment/comment-rule-serializer.js';
import { CommentRuleDeserializer } from '../../../src/deserializer/comment/comment-rule-deserializer.js';

describe('CommentRuleParser', () => {
    test('isCommentRule', () => {
        // TODO: Refactor to test.each
        // Empty
        expect(CommentParser.isCommentRule(EMPTY)).toBeFalsy();
        expect(CommentParser.isCommentRule(SPACE)).toBeFalsy();

        // Begins with !
        expect(CommentParser.isCommentRule('!')).toBeTruthy();
        expect(CommentParser.isCommentRule('!!')).toBeTruthy();
        expect(CommentParser.isCommentRule('!comment')).toBeTruthy();
        expect(CommentParser.isCommentRule('! comment')).toBeTruthy();
        expect(CommentParser.isCommentRule('!+comment')).toBeTruthy();
        expect(CommentParser.isCommentRule('!#comment')).toBeTruthy();
        expect(CommentParser.isCommentRule('!#########################')).toBeTruthy();
        expect(CommentParser.isCommentRule('! #########################')).toBeTruthy();
        expect(CommentParser.isCommentRule(' !')).toBeTruthy();
        expect(CommentParser.isCommentRule('  !')).toBeTruthy();

        // Begins with #
        expect(CommentParser.isCommentRule('#')).toBeTruthy();
        expect(CommentParser.isCommentRule('##')).toBeTruthy();
        expect(CommentParser.isCommentRule('# #')).toBeTruthy();
        expect(CommentParser.isCommentRule('#comment')).toBeTruthy();
        expect(CommentParser.isCommentRule('# comment')).toBeTruthy();
        expect(CommentParser.isCommentRule('#+comment')).toBeTruthy();
        expect(CommentParser.isCommentRule('#########################')).toBeTruthy();
        expect(CommentParser.isCommentRule('# ########################')).toBeTruthy();
        expect(CommentParser.isCommentRule(' #')).toBeTruthy();
        expect(CommentParser.isCommentRule('  ##')).toBeTruthy();

        // Cosmetic rules (also begins with #)
        expect(CommentParser.isCommentRule('##.selector')).toBeFalsy();
        expect(CommentParser.isCommentRule('#@#.selector')).toBeFalsy();
        expect(CommentParser.isCommentRule("#%#//scriptlet('scriptlet')")).toBeFalsy();
        expect(CommentParser.isCommentRule(" #%#//scriptlet('scriptlet')")).toBeFalsy();

        // Adblock agents
        expect(CommentParser.isCommentRule('[Adblock Plus 2.0]')).toBeTruthy();
        expect(CommentParser.isCommentRule('[Adblock]')).toBeTruthy();
        expect(CommentParser.isCommentRule('[Adblock Plus 2.0; AdGuard]')).toBeTruthy();
        expect(CommentParser.isCommentRule('[Adblock Plus 2.0; AdGuard 1.0]')).toBeTruthy();
        expect(CommentParser.isCommentRule('[uBlock]')).toBeTruthy();
        expect(CommentParser.isCommentRule('[uBlock Origin]')).toBeTruthy();
        expect(CommentParser.isCommentRule('[Adblock Plus 2.0]')).toBeTruthy();
        expect(CommentParser.isCommentRule('  [Adblock Plus 2.0]')).toBeTruthy();
    });

    test('parse', () => {
        // TODO: Refactor to test.each
        // Empty / not comment
        expect(CommentParser.parse(EMPTY)).toBeNull();
        expect(CommentParser.parse(SPACE)).toBeNull();
        expect(CommentParser.parse('##.ad')).toBeNull();
        expect(CommentParser.parse('#@#.ad')).toBeNull();

        // Agents
        expect(CommentParser.parse('[Adblock Plus 2.0]')).toMatchObject({
            type: 'AgentCommentRule',
            start: 0,
            end: 18,
            syntax: 'Common',
            category: 'Comment',
            children: [
                {
                    type: 'Agent',
                    start: 1,
                    end: 17,
                    adblock: {
                        type: 'Value',
                        start: 1,
                        end: 13,
                        value: 'Adblock Plus',
                    },
                    version: {
                        type: 'Value',
                        start: 14,
                        end: 17,
                        value: '2.0',
                    },
                },
            ],
        });

        expect(CommentParser.parse('[AdGuard]')).toMatchObject({
            type: 'AgentCommentRule',
            start: 0,
            end: 9,
            syntax: 'Common',
            category: 'Comment',
            children: [
                {
                    type: 'Agent',
                    start: 1,
                    end: 8,
                    adblock: {
                        type: 'Value',
                        start: 1,
                        end: 8,
                        value: 'AdGuard',
                    },
                },
            ],
        });

        // Hints
        expect(CommentParser.parse('!+ NOT_OPTIMIZED')).toMatchObject({
            type: 'HintCommentRule',
            start: 0,
            end: 16,
            category: 'Comment',
            syntax: 'AdGuard',
            children: [
                {
                    type: 'Hint',
                    start: 3,
                    end: 16,
                    name: {
                        type: 'Value',
                        start: 3,
                        end: 16,
                        value: 'NOT_OPTIMIZED',
                    },
                },
            ],
        });

        expect(CommentParser.parse('!+NOT_OPTIMIZED')).toMatchObject({
            type: 'HintCommentRule',
            start: 0,
            end: 15,
            category: 'Comment',
            syntax: 'AdGuard',
            children: [
                {
                    type: 'Hint',
                    start: 2,
                    end: 15,
                    name: {
                        type: 'Value',
                        start: 2,
                        end: 15,
                        value: 'NOT_OPTIMIZED',
                    },
                },
            ],
        });

        expect(
            CommentParser.parse('!+ NOT_OPTIMIZED PLATFORM(windows, mac) NOT_PLATFORM(android, ios)'),
        ).toMatchObject({
            type: 'HintCommentRule',
            start: 0,
            end: 66,
            category: 'Comment',
            syntax: 'AdGuard',
            children: [
                {
                    type: 'Hint',
                    start: 3,
                    end: 16,
                    name: {
                        type: 'Value',
                        start: 3,
                        end: 16,
                        value: 'NOT_OPTIMIZED',
                    },
                },
                {
                    type: 'Hint',
                    start: 17,
                    end: 39,
                    name: {
                        type: 'Value',
                        start: 17,
                        end: 25,
                        value: 'PLATFORM',
                    },
                    params: {
                        type: 'ParameterList',
                        start: 26,
                        end: 38,
                        children: [
                            {
                                type: 'Value',
                                start: 26,
                                end: 33,
                                value: 'windows',
                            },
                            {
                                type: 'Value',
                                start: 35,
                                end: 38,
                                value: 'mac',
                            },
                        ],
                    },
                },
                {
                    type: 'Hint',
                    start: 40,
                    end: 66,
                    name: {
                        type: 'Value',
                        start: 40,
                        end: 52,
                        value: 'NOT_PLATFORM',
                    },
                    params: {
                        type: 'ParameterList',
                        start: 53,
                        end: 65,
                        children: [
                            {
                                type: 'Value',
                                start: 53,
                                end: 60,
                                value: 'android',
                            },
                            {
                                type: 'Value',
                                start: 62,
                                end: 65,
                                value: 'ios',
                            },
                        ],
                    },
                },
            ],
        });

        // Pre processors
        expect(CommentParser.parse('!#if (adguard)')).toMatchObject({
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

        expect(CommentParser.parse('!#if (adguard && !adguard_ext_safari)')).toMatchObject({
            type: 'PreProcessorCommentRule',
            start: 0,
            end: 37,
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
                end: 36,
                expression: {
                    type: 'Operator',
                    start: 6,
                    end: 36,
                    operator: '&&',
                    left: {
                        type: 'Variable',
                        start: 6,
                        end: 13,
                        name: 'adguard',
                    },
                    right: {
                        type: 'Operator',
                        start: 17,
                        end: 36,
                        operator: '!',
                        left: {
                            type: 'Variable',
                            start: 18,
                            end: 36,
                            name: 'adguard_ext_safari',
                        },
                    },
                },
            },
        });

        expect(CommentParser.parse('!#include https://example.org/path/includedfile.txt')).toMatchObject({
            type: 'PreProcessorCommentRule',
            start: 0,
            end: 51,
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
                end: 51,
                value: 'https://example.org/path/includedfile.txt',
            },
        });

        // Metadata
        expect(CommentParser.parse('! Title: Filter')).toMatchObject({
            type: 'MetadataCommentRule',
            start: 0,
            end: 15,
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '!',
            },
            header: {
                type: 'Value',
                start: 2,
                end: 7,
                value: 'Title',
            },
            value: {
                type: 'Value',
                start: 9,
                end: 15,
                value: 'Filter',
            },
        });

        expect(
            CommentParser.parse('! Homepage: https://github.com/AdguardTeam/some-repo/wiki'),
        ).toMatchObject({
            type: 'MetadataCommentRule',
            start: 0,
            end: 57,
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '!',
            },
            header: {
                type: 'Value',
                start: 2,
                end: 10,
                value: 'Homepage',
            },
            value: {
                type: 'Value',
                start: 12,
                end: 57,
                value: 'https://github.com/AdguardTeam/some-repo/wiki',
            },
        });

        expect(
            CommentParser.parse('# Homepage: https://github.com/AdguardTeam/some-repo/wiki'),
        ).toMatchObject({
            type: 'MetadataCommentRule',
            start: 0,
            end: 57,
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '#',
            },
            header: {
                type: 'Value',
                start: 2,
                end: 10,
                value: 'Homepage',
            },
            value: {
                type: 'Value',
                start: 12,
                end: 57,
                value: 'https://github.com/AdguardTeam/some-repo/wiki',
            },
        });

        // Config comments
        expect(CommentParser.parse('! aglint-disable rule1, rule2')).toMatchObject({
            type: 'ConfigCommentRule',
            start: 0,
            end: 29,
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '!',
            },
            command: {
                type: 'Value',
                start: 2,
                end: 16,
                value: 'aglint-disable',
            },
            params: {
                type: 'ParameterList',
                start: 17,
                end: 29,
                children: [
                    {
                        type: 'Value',
                        start: 17,
                        end: 22,
                        value: 'rule1',
                    },
                    {
                        type: 'Value',
                        start: 24,
                        end: 29,
                        value: 'rule2',
                    },
                ],
            },
        });

        expect(CommentParser.parse('! aglint-enable rule1, rule2')).toMatchObject({
            type: 'ConfigCommentRule',
            start: 0,
            end: 28,
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '!',
            },
            command: {
                type: 'Value',
                start: 2,
                end: 15,
                value: 'aglint-enable',
            },
            params: {
                type: 'ParameterList',
                start: 16,
                end: 28,
                children: [
                    {
                        type: 'Value',
                        start: 16,
                        end: 21,
                        value: 'rule1',
                    },
                    {
                        type: 'Value',
                        start: 23,
                        end: 28,
                        value: 'rule2',
                    },
                ],
            },
        });

        expect(CommentParser.parse('# aglint-disable rule1, rule2')).toMatchObject({
            type: 'ConfigCommentRule',
            start: 0,
            end: 29,
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '#',
            },
            command: {
                type: 'Value',
                start: 2,
                end: 16,
                value: 'aglint-disable',
            },
            params: {
                type: 'ParameterList',
                start: 17,
                end: 29,
                children: [
                    {
                        type: 'Value',
                        start: 17,
                        end: 22,
                        value: 'rule1',
                    },
                    {
                        type: 'Value',
                        start: 24,
                        end: 29,
                        value: 'rule2',
                    },
                ],
            },
        });

        expect(CommentParser.parse('# aglint-enable rule1, rule2')).toMatchObject({
            type: 'ConfigCommentRule',
            start: 0,
            end: 28,
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '#',
            },
            command: {
                type: 'Value',
                start: 2,
                end: 15,
                value: 'aglint-enable',
            },
            params: {
                type: 'ParameterList',
                start: 16,
                end: 28,
                children: [
                    {
                        type: 'Value',
                        start: 16,
                        end: 21,
                        value: 'rule1',
                    },
                    {
                        type: 'Value',
                        start: 23,
                        end: 28,
                        value: 'rule2',
                    },
                ],
            },
        });

        expect(CommentParser.parse('! aglint rule1: "off", rule2: ["a", "b"] -- this is a comment')).toMatchObject({
            type: 'ConfigCommentRule',
            start: 0,
            end: 61,
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '!',
            },
            command: {
                type: 'Value',
                start: 2,
                end: 8,
                value: 'aglint',
            },
            params: {
                type: 'ConfigNode',
                start: 9,
                end: 40,
                value: {
                    rule1: 'off',
                    rule2: [
                        'a',
                        'b',
                    ],
                },
            },
            comment: {
                type: 'Value',
                start: 41,
                end: 61,
                value: '-- this is a comment',
            },
        });

        expect(CommentParser.parse('# aglint rule1: "off", rule2: ["a", "b"] -- this is a comment')).toMatchObject({
            type: 'ConfigCommentRule',
            start: 0,
            end: 61,
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '#',
            },
            command: {
                type: 'Value',
                start: 2,
                end: 8,
                value: 'aglint',
            },
            params: {
                type: 'ConfigNode',
                start: 9,
                end: 40,
                value: {
                    rule1: 'off',
                    rule2: [
                        'a',
                        'b',
                    ],
                },
            },
            comment: {
                type: 'Value',
                start: 41,
                end: 61,
                value: '-- this is a comment',
            },
        });

        // Comments
        expect(CommentParser.parse('! This is just a comment')).toMatchObject({
            category: 'Comment',
            type: 'CommentRule',
            start: 0,
            end: 24,
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '!',
            },
            text: {
                type: 'Value',
                start: 1,
                end: 24,
                value: ' This is just a comment',
            },
        });

        expect(CommentParser.parse('# This is just a comment')).toMatchObject({
            category: 'Comment',
            type: 'CommentRule',
            start: 0,
            end: 24,
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '#',
            },
            text: {
                type: 'Value',
                start: 1,
                end: 24,
                value: ' This is just a comment',
            },
        });

        expect(CommentParser.parse('!#########################')).toMatchObject({
            category: 'Comment',
            type: 'CommentRule',
            start: 0,
            end: 26,
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '!',
            },
            text: {
                type: 'Value',
                start: 1,
                end: 26,
                value: '#########################',
            },
        });

        expect(CommentParser.parse('##########################')).toMatchObject({
            category: 'Comment',
            type: 'CommentRule',
            start: 0,
            end: 26,
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '#',
            },
            text: {
                type: 'Value',
                start: 1,
                end: 26,
                value: '#########################',
            },
        });
    });

    describe('parser options should work as expected', () => {
        // TODO: Add template for test.each
        test.each([
            {
                actual: '! This is just a comment',
                expected: {
                    category: 'Comment',
                    type: 'CommentRule',
                    syntax: 'Common',
                    raws: {
                        text: '! This is just a comment',
                    },
                    marker: {
                        type: 'Value',
                        value: '!',
                    },
                    text: {
                        type: 'Value',
                        value: ' This is just a comment',
                    },
                },
            },
        ])('isLocIncluded should work for $actual', ({ actual, expected }) => {
            expect(
                CommentParser.parse(actual, { ...defaultParserOptions, isLocIncluded: false }),
            ).toEqual(expected);
        });
    });

    test('generate', () => {
        const parseAndGenerate = (raw: string) => {
            const ast = CommentParser.parse(raw);

            if (ast) {
                return CommentRuleGenerator.generate(ast);
            }

            return null;
        };

        // TODO: Refactor to test.each
        expect(parseAndGenerate('[Adblock Plus 2.0]')).toEqual('[Adblock Plus 2.0]');

        expect(parseAndGenerate('[Adblock Plus 2.0; AdGuard]')).toEqual('[Adblock Plus 2.0; AdGuard]');

        expect(parseAndGenerate('!+ NOT_OPTIMIZED')).toEqual('!+ NOT_OPTIMIZED');

        expect(parseAndGenerate('!+ NOT_OPTIMIZED PLATFORM(windows) NOT_PLATFORM(mac)')).toEqual(
            '!+ NOT_OPTIMIZED PLATFORM(windows) NOT_PLATFORM(mac)',
        );

        expect(parseAndGenerate('!#if (adguard && !adguard_ext_safari)')).toEqual(
            '!#if (adguard && !adguard_ext_safari)',
        );

        expect(parseAndGenerate('! Homepage: https://github.com/AdguardTeam/some-repo/wiki')).toEqual(
            '! Homepage: https://github.com/AdguardTeam/some-repo/wiki',
        );

        expect(parseAndGenerate('! aglint-enable rule1, rule2 -- comment')).toEqual(
            '! aglint-enable rule1, rule2 -- comment',
        );

        expect(parseAndGenerate('# aglint-enable rule1, rule2 -- comment')).toEqual(
            '# aglint-enable rule1, rule2 -- comment',
        );

        expect(parseAndGenerate('! This is just a comment')).toEqual('! This is just a comment');
    });

    describe('serialize & deserialize', () => {
        test.each([
            '[Adblock Plus 2.0]',
            '[Adblock Plus 2.0; AdGuard]',
            '!+ NOT_OPTIMIZED',
            '!+ NOT_OPTIMIZED PLATFORM(windows) NOT_PLATFORM(mac)',
            '!#if (adguard && !adguard_ext_safari)',
            '! Homepage: example.org',
            '! aglint-enable rule1, rule2 -- comment',
            '# aglint-enable rule1, rule2 -- comment',
            '! This is just a comment',
            '# This is just a comment',
        ])("should serialize and deserialize '%p'", async (input) => {
            await expect(input).toBeSerializedAndDeserializedProperly(
                CommentParser,
                CommentRuleGenerator,
                CommentRuleSerializer,
                CommentRuleDeserializer,
            );
        });
    });
});
