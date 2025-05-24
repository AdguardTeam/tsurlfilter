import { describe, test, expect } from 'vitest';

import { AgentCommentParser } from '../../../src/parser/comment/agent-comment-parser.js';
import { AdblockSyntax } from '../../../src/utils/adblockers.js';
import { EMPTY, SPACE } from '../../../src/utils/constants.js';
import { defaultParserOptions } from '../../../src/parser/options.js';
import { AgentCommentGenerator } from '../../../src/generator/comment/agent-comment-generator.js';
import { AgentCommentSerializer } from '../../../src/serializer/comment/agent-comment-serializer.js';
import { AgentCommentDeserializer } from '../../../src/deserializer/comment/agent-comment-deserializer.js';

describe('AgentCommentParser', () => {
    test('isAgent', () => {
        // TODO: Refactor to test.each
        // Invalid
        expect(AgentCommentParser.isAgentRule(EMPTY)).toBeFalsy();
        expect(AgentCommentParser.isAgentRule(SPACE)).toBeFalsy();
        expect(AgentCommentParser.isAgentRule('[')).toBeFalsy();

        // Cosmetic rule modifiers
        expect(AgentCommentParser.isAgentRule('[$path=/test]example.org##.ad')).toBeFalsy();
        expect(AgentCommentParser.isAgentRule('[$path=/test]##.ad')).toBeFalsy();

        // Special case: starts with [ and ends with ] but not an agent
        expect(AgentCommentParser.isAgentRule('[$path=/test]##.ad[a="b"]')).toBeFalsy();

        // Empty agent
        expect(AgentCommentParser.isAgentRule('[]')).toBeTruthy();
        expect(AgentCommentParser.isAgentRule('[ ]')).toBeTruthy();

        // Agents
        expect(AgentCommentParser.isAgentRule('[Adblock Plus 2.0]')).toBeTruthy();
        expect(AgentCommentParser.isAgentRule('[Adblock Plus 3.1; AdGuard 1.0]')).toBeTruthy();
    });

    test('parse', () => {
        expect(AgentCommentParser.parse('##[class="ad"]')).toBeNull();

        // Empty agents
        expect(AgentCommentParser.parse(EMPTY)).toBeNull();
        expect(AgentCommentParser.parse(SPACE)).toBeNull();

        // Valid agents
        expect(AgentCommentParser.parse('[AdBlock]')).toMatchObject({
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
                        value: 'AdBlock',
                    },
                    syntax: AdblockSyntax.Abp,
                },
            ],
        });

        expect(AgentCommentParser.parse('[AdGuard]')).toMatchObject({
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
                    syntax: AdblockSyntax.Adg,
                },
            ],
        });

        expect(AgentCommentParser.parse('[uBlock]')).toMatchObject({
            type: 'AgentCommentRule',
            start: 0,
            end: 8,
            syntax: 'Common',
            category: 'Comment',
            children: [
                {
                    type: 'Agent',
                    start: 1,
                    end: 7,
                    adblock: {
                        type: 'Value',
                        start: 1,
                        end: 7,
                        value: 'uBlock',
                    },
                    syntax: AdblockSyntax.Ubo,
                },
            ],
        });

        expect(AgentCommentParser.parse('[uBlock Origin]')).toMatchObject(
            {
                type: 'AgentCommentRule',
                start: 0,
                end: 15,
                syntax: 'Common',
                category: 'Comment',
                children: [
                    {
                        type: 'Agent',
                        start: 1,
                        end: 14,
                        adblock: {
                            type: 'Value',
                            start: 1,
                            end: 14,
                            value: 'uBlock Origin',
                        },
                        syntax: AdblockSyntax.Ubo,
                    },
                ],
            },
        );

        expect(AgentCommentParser.parse('[Adblock Plus 2.0]')).toMatchObject(
            {
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
                        syntax: AdblockSyntax.Abp,
                    },
                ],
            },
        );

        expect(AgentCommentParser.parse('[uBlock Origin 1.0.0]')).toMatchObject({
            type: 'AgentCommentRule',
            start: 0,
            end: 21,
            syntax: 'Common',
            category: 'Comment',
            children: [
                {
                    type: 'Agent',
                    start: 1,
                    end: 20,
                    adblock: {
                        type: 'Value',
                        start: 1,
                        end: 14,
                        value: 'uBlock Origin',
                    },
                    version: {
                        type: 'Value',
                        start: 15,
                        end: 20,
                        value: '1.0.0',
                    },
                    syntax: AdblockSyntax.Ubo,
                },
            ],
        });

        expect(AgentCommentParser.parse('[Adblock Plus 2.0; AdGuard]')).toMatchObject({
            type: 'AgentCommentRule',
            start: 0,
            end: 27,
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
                    syntax: AdblockSyntax.Abp,
                },
                {
                    type: 'Agent',
                    start: 19,
                    end: 26,
                    adblock: {
                        type: 'Value',
                        start: 19,
                        end: 26,
                        value: 'AdGuard',
                    },
                    syntax: AdblockSyntax.Adg,
                },
            ],
        });

        expect(AgentCommentParser.parse('[Adblock Plus 2.0; AdGuard 1.0.1.10]')).toMatchObject(
            {
                type: 'AgentCommentRule',
                start: 0,
                end: 36,
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
                        syntax: AdblockSyntax.Abp,
                    },
                    {
                        type: 'Agent',
                        start: 19,
                        end: 35,
                        adblock: {
                            type: 'Value',
                            start: 19,
                            end: 26,
                            value: 'AdGuard',
                        },
                        version: {
                            type: 'Value',
                            start: 27,
                            end: 35,
                            value: '1.0.1.10',
                        },
                        syntax: AdblockSyntax.Adg,
                    },
                ],
            },
        );

        expect(
            AgentCommentParser.parse('[Adblock Plus 3.1; AdGuard 1.4; uBlock Origin 1.0.15.0]'),
        ).toMatchObject({
            type: 'AgentCommentRule',
            start: 0,
            end: 55,
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
                        value: '3.1',
                    },
                    syntax: AdblockSyntax.Abp,
                },
                {
                    type: 'Agent',
                    start: 19,
                    end: 30,
                    adblock: {
                        type: 'Value',
                        start: 19,
                        end: 26,
                        value: 'AdGuard',
                    },
                    version: {
                        type: 'Value',
                        start: 27,
                        end: 30,
                        value: '1.4',
                    },
                    syntax: AdblockSyntax.Adg,
                },
                {
                    type: 'Agent',
                    start: 32,
                    end: 54,
                    adblock: {
                        type: 'Value',
                        start: 32,
                        end: 45,
                        value: 'uBlock Origin',
                    },
                    version: {
                        type: 'Value',
                        start: 46,
                        end: 54,
                        value: '1.0.15.0',
                    },
                    syntax: AdblockSyntax.Ubo,
                },
            ],
        });

        expect(
            AgentCommentParser.parse('[Adblock Plus 3.1 ; AdGuard  1.4 ;   uBlock Origin    1.0.15.0    ]'),
        ).toMatchObject({
            type: 'AgentCommentRule',
            start: 0,
            end: 67,
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
                        value: '3.1',
                    },
                    syntax: AdblockSyntax.Abp,
                },
                {
                    type: 'Agent',
                    start: 20,
                    end: 32,
                    adblock: {
                        type: 'Value',
                        start: 20,
                        end: 27,
                        value: 'AdGuard',
                    },
                    version: {
                        type: 'Value',
                        start: 29,
                        end: 32,
                        value: '1.4',
                    },
                    syntax: AdblockSyntax.Adg,
                },
                {
                    type: 'Agent',
                    start: 37,
                    end: 62,
                    adblock: {
                        type: 'Value',
                        start: 37,
                        end: 50,
                        value: 'uBlock Origin',
                    },
                    version: {
                        type: 'Value',
                        start: 54,
                        end: 62,
                        value: '1.0.15.0',
                    },
                    syntax: AdblockSyntax.Ubo,
                },
            ],
        });

        // AgentParser not called in the following case
        expect(() => AgentCommentParser.parse('[]')).toThrowError('Empty agent list');

        // AgentParser called in these cases
        expect(() => AgentCommentParser.parse('[ ]')).toThrowError('Agent name cannot be empty');
        expect(() => AgentCommentParser.parse('[  ]')).toThrowError('Agent name cannot be empty');
        expect(() => AgentCommentParser.parse('[;]')).toThrowError('Agent name cannot be empty');
        expect(() => AgentCommentParser.parse('[ ; ]')).toThrowError('Agent name cannot be empty');
        expect(() => AgentCommentParser.parse('[;;]')).toThrowError('Agent name cannot be empty');
        expect(() => AgentCommentParser.parse('[ ;; ]')).toThrowError('Agent name cannot be empty');
        expect(() => AgentCommentParser.parse('[ ; ; ]')).toThrowError('Agent name cannot be empty');
        expect(() => AgentCommentParser.parse('[2.0]')).toThrowError('Agent name cannot be empty');
        expect(() => AgentCommentParser.parse('[Adblock Plus 2.0 3.1]')).toThrowError(
            'Duplicated versions are not allowed',
        );
    });

    describe('parser options should work as expected', () => {
        // TODO: Add template for test.each
        test.each([
            {
                actual: '[Adblock Plus 2.0; AdGuard]',
                expected: {
                    type: 'AgentCommentRule',
                    syntax: 'Common',
                    category: 'Comment',
                    raws: {
                        text: '[Adblock Plus 2.0; AdGuard]',
                    },
                    children: [
                        {
                            type: 'Agent',
                            adblock: {
                                type: 'Value',
                                value: 'Adblock Plus',
                            },
                            version: {
                                type: 'Value',
                                value: '2.0',
                            },
                            syntax: AdblockSyntax.Abp,
                        },
                        {
                            type: 'Agent',
                            adblock: {
                                type: 'Value',
                                value: 'AdGuard',
                            },
                            syntax: AdblockSyntax.Adg,
                        },
                    ],
                },
            },
        ])('isLocIncluded should work for $actual', ({ actual, expected }) => {
            expect(
                AgentCommentParser.parse(actual, { ...defaultParserOptions, isLocIncluded: false }),
            ).toEqual(expected);
        });
    });

    test('generate', () => {
        const parseAndGenerate = (raw: string) => {
            const ast = AgentCommentParser.parse(raw);

            if (ast) {
                return AgentCommentGenerator.generate(ast);
            }

            return null;
        };

        // TODO: Refactor to test.each
        expect(parseAndGenerate('[AdGuard]')).toEqual('[AdGuard]');
        expect(parseAndGenerate('[ AdGuard ]')).toEqual('[AdGuard]');
        expect(parseAndGenerate('[Adblock Plus 2.0]')).toEqual('[Adblock Plus 2.0]');
        expect(parseAndGenerate('[Adblock Plus 2.0; AdGuard]')).toEqual('[Adblock Plus 2.0; AdGuard]');
        expect(parseAndGenerate('[  Adblock Plus 2.0  ; AdGuard  ]')).toEqual('[Adblock Plus 2.0; AdGuard]');
    });

    describe('serialize & deserialize', () => {
        test.each([
            '[Adblock Plus 2.0]',
            '[AdGuard]',
            '[AdGuard 1.0]',
            '[Adblock Plus 3.1; AdGuard]',

            // shorthands
            ['[abp]', '[ABP]'],
            ['[adg]', '[ADG]'],
            ['[abp 2.0]', '[ABP 2.0]'],
            ['[abp 3.1; adguard]', '[ABP 3.1; AdGuard]'],
        ])("should serialize and deserialize '%p'", async (input) => {
            await expect(input).toBeSerializedAndDeserializedProperly(
                AgentCommentParser,
                AgentCommentGenerator,
                AgentCommentSerializer,
                AgentCommentDeserializer,
            );
        });
    });
});
