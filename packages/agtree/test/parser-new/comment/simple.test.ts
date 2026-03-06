import { describe, test, expect } from 'vitest';

import { CommentRuleParser } from '../../../src/parser-new/comment/comment-rule-parser';

const parser = new CommentRuleParser();

describe('CommentRuleParser — simple comments', () => {
    describe('parse (with location)', () => {
        test('! This is just a comment', () => {
            expect(parser.parse('! This is just a comment', { isLocIncluded: true })).toMatchObject({
                type: 'CommentRule',
                start: 0,
                end: 24,
                syntax: 'Common',
                category: 'Comment',
                marker: {
                    type: 'Value',
                    start: 0,
                    end: 1,
                    value: '!',
                },
                text: {
                    type: 'Value',
                    start: 2,
                    end: 24,
                    value: 'This is just a comment',
                },
            });
        });

        test('# This is just a comment', () => {
            expect(parser.parse('# This is just a comment', { isLocIncluded: true })).toMatchObject({
                type: 'CommentRule',
                start: 0,
                end: 24,
                syntax: 'Common',
                category: 'Comment',
                marker: {
                    type: 'Value',
                    start: 0,
                    end: 1,
                    value: '#',
                },
                text: {
                    type: 'Value',
                    start: 2,
                    end: 24,
                    value: 'This is just a comment',
                },
            });
        });

        test('! comment — marker only, no text', () => {
            expect(parser.parse('!', { isLocIncluded: true })).toMatchObject({
                type: 'CommentRule',
                start: 0,
                end: 1,
                marker: {
                    type: 'Value',
                    start: 0,
                    end: 1,
                    value: '!',
                },
            });
        });

        test('# marker only', () => {
            expect(parser.parse('#', { isLocIncluded: true })).toMatchObject({
                type: 'CommentRule',
                start: 0,
                end: 1,
                marker: {
                    type: 'Value',
                    start: 0,
                    end: 1,
                    value: '#',
                },
            });
        });

        test('!comment — no space, text immediately after marker', () => {
            expect(parser.parse('!comment', { isLocIncluded: true })).toMatchObject({
                type: 'CommentRule',
                start: 0,
                end: 8,
                marker: {
                    type: 'Value',
                    start: 0,
                    end: 1,
                    value: '!',
                },
                text: {
                    type: 'Value',
                    start: 1,
                    end: 8,
                    value: 'comment',
                },
            });
        });

        test('##########################', () => {
            expect(parser.parse('##########################', { isLocIncluded: true })).toMatchObject({
                type: 'CommentRule',
                start: 0,
                end: 26,
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

        test('! #########################', () => {
            expect(parser.parse('! #########################', { isLocIncluded: true })).toMatchObject({
                type: 'CommentRule',
                start: 0,
                end: 27,
                marker: {
                    type: 'Value',
                    start: 0,
                    end: 1,
                    value: '!',
                },
                text: {
                    type: 'Value',
                    start: 2,
                    end: 27,
                    value: '#########################',
                },
            });
        });
    });

    describe('parse (without location)', () => {
        test('! This is just a comment — no loc, no raws by default', () => {
            expect(parser.parse('! This is just a comment')).toEqual({
                type: 'CommentRule',
                syntax: 'Common',
                category: 'Comment',
                marker: {
                    type: 'Value',
                    value: '!',
                },
                text: {
                    type: 'Value',
                    value: 'This is just a comment',
                },
            });
        });

        test('# This is just a comment — no loc, no raws by default', () => {
            expect(parser.parse('# This is just a comment')).toEqual({
                type: 'CommentRule',
                syntax: 'Common',
                category: 'Comment',
                marker: {
                    type: 'Value',
                    value: '#',
                },
                text: {
                    type: 'Value',
                    value: 'This is just a comment',
                },
            });
        });

        test('includeRaws adds raws.text', () => {
            const source = '! This is just a comment';
            const result = parser.parse(source, { includeRaws: true });
            expect(result.raws).toEqual({ text: source });
        });
    });

    describe('syntax detection', () => {
        test('! comment — AdGuard syntax (! marker)', () => {
            const result = parser.parse('! AdGuard comment');
            expect(result).toMatchObject({
                type: 'CommentRule',
                syntax: 'Common',
            });
        });

        test('# comment — uBlock/Common syntax (# marker)', () => {
            const result = parser.parse('# some comment');
            expect(result).toMatchObject({
                type: 'CommentRule',
                syntax: 'Common',
            });
        });
    });
});
