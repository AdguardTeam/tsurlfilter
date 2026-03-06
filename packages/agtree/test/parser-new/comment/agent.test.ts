import { describe, test, expect } from 'vitest';

import { CommentRuleParser } from '../../../src/parser-new/comment/comment-rule-parser';
import { AdblockSyntax } from '../../../src/utils/adblockers';

const parser = new CommentRuleParser();

describe('CommentRuleParser — agent comments', () => {
    describe('parse (with location)', () => {
        test('[AdBlock]', () => {
            expect(parser.parse('[AdBlock]', { isLocIncluded: true })).toMatchObject({
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
        });

        test('[AdGuard]', () => {
            expect(parser.parse('[AdGuard]', { isLocIncluded: true })).toMatchObject({
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
        });

        test('[uBlock]', () => {
            expect(parser.parse('[uBlock]', { isLocIncluded: true })).toMatchObject({
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
        });

        test('[uBlock Origin]', () => {
            expect(parser.parse('[uBlock Origin]', { isLocIncluded: true })).toMatchObject({
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
            });
        });

        test('[Adblock Plus 2.0]', () => {
            expect(parser.parse('[Adblock Plus 2.0]', { isLocIncluded: true })).toMatchObject({
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
            });
        });

        test('[uBlock Origin 1.0.0]', () => {
            expect(parser.parse('[uBlock Origin 1.0.0]', { isLocIncluded: true })).toMatchObject({
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
        });

        test('[Adblock Plus 2.0; AdGuard]', () => {
            expect(parser.parse('[Adblock Plus 2.0; AdGuard]', { isLocIncluded: true })).toMatchObject({
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
        });

        test('[Adblock Plus 2.0; AdGuard 1.0.1.10]', () => {
            expect(parser.parse('[Adblock Plus 2.0; AdGuard 1.0.1.10]', { isLocIncluded: true })).toMatchObject({
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
            });
        });

        test('[Adblock Plus 3.1; AdGuard 1.4; uBlock Origin 1.0.15.0]', () => {
            expect(
                parser.parse('[Adblock Plus 3.1; AdGuard 1.4; uBlock Origin 1.0.15.0]', { isLocIncluded: true }),
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
        });

        test('extra whitespace around agents and separators', () => {
            expect(
                parser.parse(
                    '[Adblock Plus 3.1 ; AdGuard  1.4 ;   uBlock Origin    1.0.15.0    ]',
                    { isLocIncluded: true },
                ),
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
        });
    });

    describe('parse (without location)', () => {
        test('[Adblock Plus 2.0; AdGuard] — no loc, no raws by default', () => {
            expect(parser.parse('[Adblock Plus 2.0; AdGuard]')).toEqual({
                type: 'AgentCommentRule',
                syntax: 'Common',
                category: 'Comment',
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
            });
        });

        test('includeRaws adds raws.text', () => {
            const source = '[Adblock Plus 2.0; AdGuard]';
            const result = parser.parse(source, { includeRaws: true });
            expect(result.raws).toEqual({ text: source });
        });
    });

    describe('error cases', () => {
        test('[2.0] — agent name cannot be empty (version without name)', () => {
            expect(() => parser.parse('[2.0]')).toThrowError('Agent name cannot be empty');
        });

        test('[] — returns AgentCommentRule with 0 children (no throw)', () => {
            const result = parser.parse('[]');
            expect(result).toMatchObject({
                type: 'AgentCommentRule',
                children: [],
            });
        });

        test('[ ] — returns AgentCommentRule with 0 children (no throw)', () => {
            const result = parser.parse('[ ]');
            expect(result).toMatchObject({
                type: 'AgentCommentRule',
                children: [],
            });
        });

        test('[;] — returns AgentCommentRule with 0 children', () => {
            const result = parser.parse('[;]');
            expect(result).toMatchObject({
                type: 'AgentCommentRule',
                children: [],
            });
        });

        test('[Adblock Plus 2.0 3.1] — last version wins, no throw', () => {
            const result = parser.parse('[Adblock Plus 2.0 3.1]', { isLocIncluded: true });
            expect(result).toMatchObject({
                type: 'AgentCommentRule',
                children: [
                    {
                        type: 'Agent',
                        adblock: {
                            type: 'Value',
                            value: 'Adblock Plus',
                        },
                        version: {
                            type: 'Value',
                            value: '3.1',
                        },
                    },
                ],
            });
        });
    });
});
