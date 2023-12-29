import { AgentCommentRuleParser } from '../../../src/parser/comment/agent-rule';
import { AdblockSyntax } from '../../../src/utils/adblockers';
import { EMPTY, SPACE } from '../../../src/utils/constants';

describe('AgentCommentRuleParser', () => {
    test('isAgent', () => {
        // TODO: Refactor to test.each
        // Invalid
        expect(AgentCommentRuleParser.isAgentRule(EMPTY)).toBeFalsy();
        expect(AgentCommentRuleParser.isAgentRule(SPACE)).toBeFalsy();
        expect(AgentCommentRuleParser.isAgentRule('[')).toBeFalsy();

        // Cosmetic rule modifiers
        expect(AgentCommentRuleParser.isAgentRule('[$path=/test]example.org##.ad')).toBeFalsy();
        expect(AgentCommentRuleParser.isAgentRule('[$path=/test]##.ad')).toBeFalsy();

        // Special case: starts with [ and ends with ] but not an agent
        expect(AgentCommentRuleParser.isAgentRule('[$path=/test]##.ad[a="b"]')).toBeFalsy();

        // Empty agent
        expect(AgentCommentRuleParser.isAgentRule('[]')).toBeTruthy();
        expect(AgentCommentRuleParser.isAgentRule('[ ]')).toBeTruthy();

        // Agents
        expect(AgentCommentRuleParser.isAgentRule('[Adblock Plus 2.0]')).toBeTruthy();
        expect(AgentCommentRuleParser.isAgentRule('[Adblock Plus 3.1; AdGuard 1.0]')).toBeTruthy();
    });

    test('parse', () => {
        expect(AgentCommentRuleParser.parse('##[class="ad"]')).toBeNull();

        // Empty agents
        expect(AgentCommentRuleParser.parse(EMPTY)).toBeNull();
        expect(AgentCommentRuleParser.parse(SPACE)).toBeNull();

        // Valid agents
        expect(AgentCommentRuleParser.parse('[AdBlock]')).toMatchObject({
            type: 'AgentCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 9,
                    line: 1,
                    column: 10,
                },
            },
            syntax: 'Common',
            category: 'Comment',
            children: [
                {
                    type: 'Agent',
                    loc: {
                        start: {
                            offset: 1,
                            line: 1,
                            column: 2,
                        },
                        end: {
                            offset: 8,
                            line: 1,
                            column: 9,
                        },
                    },
                    adblock: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 1,
                                line: 1,
                                column: 2,
                            },
                            end: {
                                offset: 8,
                                line: 1,
                                column: 9,
                            },
                        },
                        value: 'AdBlock',
                    },
                    version: null,
                    syntax: AdblockSyntax.Abp,
                },
            ],
        });

        expect(AgentCommentRuleParser.parse('[AdGuard]')).toMatchObject({
            type: 'AgentCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 9,
                    line: 1,
                    column: 10,
                },
            },
            syntax: 'Common',
            category: 'Comment',
            children: [
                {
                    type: 'Agent',
                    loc: {
                        start: {
                            offset: 1,
                            line: 1,
                            column: 2,
                        },
                        end: {
                            offset: 8,
                            line: 1,
                            column: 9,
                        },
                    },
                    adblock: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 1,
                                line: 1,
                                column: 2,
                            },
                            end: {
                                offset: 8,
                                line: 1,
                                column: 9,
                            },
                        },
                        value: 'AdGuard',
                    },
                    version: null,
                    syntax: AdblockSyntax.Adg,
                },
            ],
        });

        expect(AgentCommentRuleParser.parse('[uBlock]')).toMatchObject({
            type: 'AgentCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 8,
                    line: 1,
                    column: 9,
                },
            },
            syntax: 'Common',
            category: 'Comment',
            children: [
                {
                    type: 'Agent',
                    loc: {
                        start: {
                            offset: 1,
                            line: 1,
                            column: 2,
                        },
                        end: {
                            offset: 7,
                            line: 1,
                            column: 8,
                        },
                    },
                    adblock: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 1,
                                line: 1,
                                column: 2,
                            },
                            end: {
                                offset: 7,
                                line: 1,
                                column: 8,
                            },
                        },
                        value: 'uBlock',
                    },
                    version: null,
                    syntax: AdblockSyntax.Ubo,
                },
            ],
        });

        expect(AgentCommentRuleParser.parse('[uBlock Origin]')).toMatchObject(
            {
                type: 'AgentCommentRule',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 15,
                        line: 1,
                        column: 16,
                    },
                },
                syntax: 'Common',
                category: 'Comment',
                children: [
                    {
                        type: 'Agent',
                        loc: {
                            start: {
                                offset: 1,
                                line: 1,
                                column: 2,
                            },
                            end: {
                                offset: 14,
                                line: 1,
                                column: 15,
                            },
                        },
                        adblock: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 1,
                                    line: 1,
                                    column: 2,
                                },
                                end: {
                                    offset: 14,
                                    line: 1,
                                    column: 15,
                                },
                            },
                            value: 'uBlock Origin',
                        },
                        version: null,
                        syntax: AdblockSyntax.Ubo,
                    },
                ],
            },
        );

        expect(AgentCommentRuleParser.parse('[Adblock Plus 2.0]')).toMatchObject(
            {
                type: 'AgentCommentRule',
                loc: {
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
                syntax: 'Common',
                category: 'Comment',
                children: [
                    {
                        type: 'Agent',
                        loc: {
                            start: {
                                offset: 1,
                                line: 1,
                                column: 2,
                            },
                            end: {
                                offset: 17,
                                line: 1,
                                column: 18,
                            },
                        },
                        adblock: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 1,
                                    line: 1,
                                    column: 2,
                                },
                                end: {
                                    offset: 13,
                                    line: 1,
                                    column: 14,
                                },
                            },
                            value: 'Adblock Plus',
                        },
                        version: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 14,
                                    line: 1,
                                    column: 15,
                                },
                                end: {
                                    offset: 17,
                                    line: 1,
                                    column: 18,
                                },
                            },
                            value: '2.0',
                        },
                        syntax: AdblockSyntax.Abp,
                    },
                ],
            },
        );

        expect(AgentCommentRuleParser.parse('[uBlock Origin 1.0.0]')).toMatchObject({
            type: 'AgentCommentRule',
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
            syntax: 'Common',
            category: 'Comment',
            children: [
                {
                    type: 'Agent',
                    loc: {
                        start: {
                            offset: 1,
                            line: 1,
                            column: 2,
                        },
                        end: {
                            offset: 20,
                            line: 1,
                            column: 21,
                        },
                    },
                    adblock: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 1,
                                line: 1,
                                column: 2,
                            },
                            end: {
                                offset: 14,
                                line: 1,
                                column: 15,
                            },
                        },
                        value: 'uBlock Origin',
                    },
                    version: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 15,
                                line: 1,
                                column: 16,
                            },
                            end: {
                                offset: 20,
                                line: 1,
                                column: 21,
                            },
                        },
                        value: '1.0.0',
                    },
                    syntax: AdblockSyntax.Ubo,
                },
            ],
        });

        expect(AgentCommentRuleParser.parse('[Adblock Plus 2.0; AdGuard]')).toMatchObject({
            type: 'AgentCommentRule',
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
            syntax: 'Common',
            category: 'Comment',
            children: [
                {
                    type: 'Agent',
                    loc: {
                        start: {
                            offset: 1,
                            line: 1,
                            column: 2,
                        },
                        end: {
                            offset: 17,
                            line: 1,
                            column: 18,
                        },
                    },
                    adblock: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 1,
                                line: 1,
                                column: 2,
                            },
                            end: {
                                offset: 13,
                                line: 1,
                                column: 14,
                            },
                        },
                        value: 'Adblock Plus',
                    },
                    version: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 14,
                                line: 1,
                                column: 15,
                            },
                            end: {
                                offset: 17,
                                line: 1,
                                column: 18,
                            },
                        },
                        value: '2.0',
                    },
                    syntax: AdblockSyntax.Abp,
                },
                {
                    type: 'Agent',
                    loc: {
                        start: {
                            offset: 19,
                            line: 1,
                            column: 20,
                        },
                        end: {
                            offset: 26,
                            line: 1,
                            column: 27,
                        },
                    },
                    adblock: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 19,
                                line: 1,
                                column: 20,
                            },
                            end: {
                                offset: 26,
                                line: 1,
                                column: 27,
                            },
                        },
                        value: 'AdGuard',
                    },
                    version: null,
                    syntax: AdblockSyntax.Adg,
                },
            ],
        });

        expect(AgentCommentRuleParser.parse('[Adblock Plus 2.0; AdGuard 1.0.1.10]')).toMatchObject(
            {
                type: 'AgentCommentRule',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 36,
                        line: 1,
                        column: 37,
                    },
                },
                syntax: 'Common',
                category: 'Comment',
                children: [
                    {
                        type: 'Agent',
                        loc: {
                            start: {
                                offset: 1,
                                line: 1,
                                column: 2,
                            },
                            end: {
                                offset: 17,
                                line: 1,
                                column: 18,
                            },
                        },
                        adblock: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 1,
                                    line: 1,
                                    column: 2,
                                },
                                end: {
                                    offset: 13,
                                    line: 1,
                                    column: 14,
                                },
                            },
                            value: 'Adblock Plus',
                        },
                        version: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 14,
                                    line: 1,
                                    column: 15,
                                },
                                end: {
                                    offset: 17,
                                    line: 1,
                                    column: 18,
                                },
                            },
                            value: '2.0',
                        },
                        syntax: AdblockSyntax.Abp,
                    },
                    {
                        type: 'Agent',
                        loc: {
                            start: {
                                offset: 19,
                                line: 1,
                                column: 20,
                            },
                            end: {
                                offset: 35,
                                line: 1,
                                column: 36,
                            },
                        },
                        adblock: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 19,
                                    line: 1,
                                    column: 20,
                                },
                                end: {
                                    offset: 26,
                                    line: 1,
                                    column: 27,
                                },
                            },
                            value: 'AdGuard',
                        },
                        version: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 27,
                                    line: 1,
                                    column: 28,
                                },
                                end: {
                                    offset: 35,
                                    line: 1,
                                    column: 36,
                                },
                            },
                            value: '1.0.1.10',
                        },
                        syntax: AdblockSyntax.Adg,
                    },
                ],
            },
        );

        expect(
            AgentCommentRuleParser.parse('[Adblock Plus 3.1; AdGuard 1.4; uBlock Origin 1.0.15.0]'),
        ).toMatchObject({
            type: 'AgentCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 55,
                    line: 1,
                    column: 56,
                },
            },
            syntax: 'Common',
            category: 'Comment',
            children: [
                {
                    type: 'Agent',
                    loc: {
                        start: {
                            offset: 1,
                            line: 1,
                            column: 2,
                        },
                        end: {
                            offset: 17,
                            line: 1,
                            column: 18,
                        },
                    },
                    adblock: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 1,
                                line: 1,
                                column: 2,
                            },
                            end: {
                                offset: 13,
                                line: 1,
                                column: 14,
                            },
                        },
                        value: 'Adblock Plus',
                    },
                    version: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 14,
                                line: 1,
                                column: 15,
                            },
                            end: {
                                offset: 17,
                                line: 1,
                                column: 18,
                            },
                        },
                        value: '3.1',
                    },
                    syntax: AdblockSyntax.Abp,
                },
                {
                    type: 'Agent',
                    loc: {
                        start: {
                            offset: 19,
                            line: 1,
                            column: 20,
                        },
                        end: {
                            offset: 30,
                            line: 1,
                            column: 31,
                        },
                    },
                    adblock: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 19,
                                line: 1,
                                column: 20,
                            },
                            end: {
                                offset: 26,
                                line: 1,
                                column: 27,
                            },
                        },
                        value: 'AdGuard',
                    },
                    version: {
                        type: 'Value',
                        loc: {
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
                        value: '1.4',
                    },
                    syntax: AdblockSyntax.Adg,
                },
                {
                    type: 'Agent',
                    loc: {
                        start: {
                            offset: 32,
                            line: 1,
                            column: 33,
                        },
                        end: {
                            offset: 54,
                            line: 1,
                            column: 55,
                        },
                    },
                    adblock: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 32,
                                line: 1,
                                column: 33,
                            },
                            end: {
                                offset: 45,
                                line: 1,
                                column: 46,
                            },
                        },
                        value: 'uBlock Origin',
                    },
                    version: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 46,
                                line: 1,
                                column: 47,
                            },
                            end: {
                                offset: 54,
                                line: 1,
                                column: 55,
                            },
                        },
                        value: '1.0.15.0',
                    },
                    syntax: AdblockSyntax.Ubo,
                },
            ],
        });

        expect(
            AgentCommentRuleParser.parse('[Adblock Plus 3.1 ; AdGuard  1.4 ;   uBlock Origin    1.0.15.0    ]'),
        ).toMatchObject({
            type: 'AgentCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 67,
                    line: 1,
                    column: 68,
                },
            },
            syntax: 'Common',
            category: 'Comment',
            children: [
                {
                    type: 'Agent',
                    loc: {
                        start: {
                            offset: 1,
                            line: 1,
                            column: 2,
                        },
                        end: {
                            offset: 17,
                            line: 1,
                            column: 18,
                        },
                    },
                    adblock: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 1,
                                line: 1,
                                column: 2,
                            },
                            end: {
                                offset: 13,
                                line: 1,
                                column: 14,
                            },
                        },
                        value: 'Adblock Plus',
                    },
                    version: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 14,
                                line: 1,
                                column: 15,
                            },
                            end: {
                                offset: 17,
                                line: 1,
                                column: 18,
                            },
                        },
                        value: '3.1',
                    },
                    syntax: AdblockSyntax.Abp,
                },
                {
                    type: 'Agent',
                    loc: {
                        start: {
                            offset: 20,
                            line: 1,
                            column: 21,
                        },
                        end: {
                            offset: 32,
                            line: 1,
                            column: 33,
                        },
                    },
                    adblock: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 20,
                                line: 1,
                                column: 21,
                            },
                            end: {
                                offset: 27,
                                line: 1,
                                column: 28,
                            },
                        },
                        value: 'AdGuard',
                    },
                    version: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 29,
                                line: 1,
                                column: 30,
                            },
                            end: {
                                offset: 32,
                                line: 1,
                                column: 33,
                            },
                        },
                        value: '1.4',
                    },
                    syntax: AdblockSyntax.Adg,
                },
                {
                    type: 'Agent',
                    loc: {
                        start: {
                            offset: 37,
                            line: 1,
                            column: 38,
                        },
                        end: {
                            offset: 62,
                            line: 1,
                            column: 63,
                        },
                    },
                    adblock: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 37,
                                line: 1,
                                column: 38,
                            },
                            end: {
                                offset: 50,
                                line: 1,
                                column: 51,
                            },
                        },
                        value: 'uBlock Origin',
                    },
                    version: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 54,
                                line: 1,
                                column: 55,
                            },
                            end: {
                                offset: 62,
                                line: 1,
                                column: 63,
                            },
                        },
                        value: '1.0.15.0',
                    },
                    syntax: AdblockSyntax.Ubo,
                },
            ],
        });

        // AgentParser not called in the following case
        expect(() => AgentCommentRuleParser.parse('[]')).toThrowError('Empty agent list');

        // AgentParser called in these cases
        expect(() => AgentCommentRuleParser.parse('[ ]')).toThrowError('Agent name cannot be empty');
        expect(() => AgentCommentRuleParser.parse('[  ]')).toThrowError('Agent name cannot be empty');
        expect(() => AgentCommentRuleParser.parse('[;]')).toThrowError('Agent name cannot be empty');
        expect(() => AgentCommentRuleParser.parse('[ ; ]')).toThrowError('Agent name cannot be empty');
        expect(() => AgentCommentRuleParser.parse('[;;]')).toThrowError('Agent name cannot be empty');
        expect(() => AgentCommentRuleParser.parse('[ ;; ]')).toThrowError('Agent name cannot be empty');
        expect(() => AgentCommentRuleParser.parse('[ ; ; ]')).toThrowError('Agent name cannot be empty');
        expect(() => AgentCommentRuleParser.parse('[2.0]')).toThrowError('Agent name cannot be empty');
        expect(() => AgentCommentRuleParser.parse('[Adblock Plus 2.0 3.1]')).toThrowError(
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
                            version: null,
                            syntax: AdblockSyntax.Adg,
                        },
                    ],
                },
            },
        ])('isLocIncluded should work for $actual', ({ actual, expected }) => {
            expect(AgentCommentRuleParser.parse(actual, { isLocIncluded: false })).toEqual(expected);
        });
    });

    test('generate', () => {
        const parseAndGenerate = (raw: string) => {
            const ast = AgentCommentRuleParser.parse(raw);

            if (ast) {
                return AgentCommentRuleParser.generate(ast);
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
});
