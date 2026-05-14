import { describe, expect, test } from 'vitest';

import {
    SYNTAX_ABP,
    SYNTAX_ADG,
    SYNTAX_ALL,
    SYNTAX_UBO,
} from '../../../src/utils/syntax-flags';
import { parseCommentRule } from '../../helpers/parse-helpers';

describe('CommentAstBuilder — agent comments', () => {
    describe('parse (with location)', () => {
        test('[AdBlock]', () => {
            expect(parseCommentRule('[AdBlock]', { isLocIncluded: true })).toMatchObject({
                type: 'AgentCommentRule',
                start: 0,
                end: 9,
                syntax: SYNTAX_ALL,
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
                        syntax: SYNTAX_ABP,
                    },
                ],
            });
        });

        test('[AdGuard]', () => {
            expect(parseCommentRule('[AdGuard]', { isLocIncluded: true })).toMatchObject({
                type: 'AgentCommentRule',
                start: 0,
                end: 9,
                syntax: SYNTAX_ALL,
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
                        syntax: SYNTAX_ADG,
                    },
                ],
            });
        });

        test('[uBlock]', () => {
            expect(parseCommentRule('[uBlock]', { isLocIncluded: true })).toMatchObject({
                type: 'AgentCommentRule',
                start: 0,
                end: 8,
                syntax: SYNTAX_ALL,
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
                        syntax: SYNTAX_UBO,
                    },
                ],
            });
        });

        test('[uBlock Origin]', () => {
            expect(parseCommentRule('[uBlock Origin]', { isLocIncluded: true })).toMatchObject({
                type: 'AgentCommentRule',
                start: 0,
                end: 15,
                syntax: SYNTAX_ALL,
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
                        syntax: SYNTAX_UBO,
                    },
                ],
            });
        });

        test('[Adblock Plus 2.0]', () => {
            expect(parseCommentRule('[Adblock Plus 2.0]', { isLocIncluded: true })).toMatchObject({
                type: 'AgentCommentRule',
                start: 0,
                end: 18,
                syntax: SYNTAX_ALL,
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
                        syntax: SYNTAX_ABP,
                    },
                ],
            });
        });

        test('[uBlock Origin 1.0.0]', () => {
            expect(parseCommentRule('[uBlock Origin 1.0.0]', { isLocIncluded: true })).toMatchObject({
                type: 'AgentCommentRule',
                start: 0,
                end: 21,
                syntax: SYNTAX_ALL,
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
                        syntax: SYNTAX_UBO,
                    },
                ],
            });
        });

        test('[Adblock Plus 2.0; AdGuard]', () => {
            expect(parseCommentRule('[Adblock Plus 2.0; AdGuard]', { isLocIncluded: true })).toMatchObject({
                type: 'AgentCommentRule',
                start: 0,
                end: 27,
                syntax: SYNTAX_ALL,
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
                        syntax: SYNTAX_ABP,
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
                        syntax: SYNTAX_ADG,
                    },
                ],
            });
        });

        test('[Adblock Plus 2.0; AdGuard 1.0.1.10]', () => {
            expect(parseCommentRule('[Adblock Plus 2.0; AdGuard 1.0.1.10]', { isLocIncluded: true })).toMatchObject({
                type: 'AgentCommentRule',
                start: 0,
                end: 36,
                syntax: SYNTAX_ALL,
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
                        syntax: SYNTAX_ABP,
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
                        syntax: SYNTAX_ADG,
                    },
                ],
            });
        });

        test('[Adblock Plus 3.1; AdGuard 1.4; uBlock Origin 1.0.15.0]', () => {
            expect(
                parseCommentRule('[Adblock Plus 3.1; AdGuard 1.4; uBlock Origin 1.0.15.0]', { isLocIncluded: true }),
            ).toMatchObject({
                type: 'AgentCommentRule',
                start: 0,
                end: 55,
                syntax: SYNTAX_ALL,
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
                        syntax: SYNTAX_ABP,
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
                        syntax: SYNTAX_ADG,
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
                        syntax: SYNTAX_UBO,
                    },
                ],
            });
        });

        test('extra whitespace around agents and separators', () => {
            expect(
                parseCommentRule(
                    '[Adblock Plus 3.1 ; AdGuard  1.4 ;   uBlock Origin    1.0.15.0    ]',
                    { isLocIncluded: true },
                ),
            ).toMatchObject({
                type: 'AgentCommentRule',
                start: 0,
                end: 67,
                syntax: SYNTAX_ALL,
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
                        syntax: SYNTAX_ABP,
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
                        syntax: SYNTAX_ADG,
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
                        syntax: SYNTAX_UBO,
                    },
                ],
            });
        });
    });

    describe('parse (without location)', () => {
        test('[Adblock Plus 2.0; AdGuard] — no loc, no raws by default', () => {
            expect(parseCommentRule('[Adblock Plus 2.0; AdGuard]')).toEqual({
                type: 'AgentCommentRule',
                syntax: SYNTAX_ALL,
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
                        syntax: SYNTAX_ABP,
                    },
                    {
                        type: 'Agent',
                        adblock: {
                            type: 'Value',
                            value: 'AdGuard',
                        },
                        syntax: SYNTAX_ADG,
                    },
                ],
            });
        });
    });

    describe('error cases', () => {
        test('[2.0] — agent name cannot be empty (version without name)', () => {
            expect(() => parseCommentRule('[2.0]')).toThrowError('Agent name cannot be empty');
        });

        test('[] — returns AgentCommentRule with 0 children (no throw)', () => {
            const result = parseCommentRule('[]');
            expect(result).toMatchObject({
                type: 'AgentCommentRule',
                children: [],
            });
        });

        test('[ ] — returns AgentCommentRule with 0 children (no throw)', () => {
            const result = parseCommentRule('[ ]');
            expect(result).toMatchObject({
                type: 'AgentCommentRule',
                children: [],
            });
        });

        test('[;] — returns AgentCommentRule with 0 children', () => {
            const result = parseCommentRule('[;]');
            expect(result).toMatchObject({
                type: 'AgentCommentRule',
                children: [],
            });
        });

        test('[Adblock Plus 2.0 3.1] — last version wins, no throw', () => {
            const result = parseCommentRule('[Adblock Plus 2.0 3.1]', { isLocIncluded: true });
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
