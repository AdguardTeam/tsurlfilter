import { describe, expect, test } from 'vitest';

import { parseCommentRule } from '../../helpers/parse-helpers';

describe('CommentAstBuilder — metadata comments', () => {
    describe('parse (with location)', () => {
        test('! Title: FilterList Title', () => {
            expect(parseCommentRule('! Title: FilterList Title', { isLocIncluded: true })).toMatchObject({
                type: 'MetadataCommentRule',
                start: 0,
                end: 25,
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
                    end: 25,
                    value: 'FilterList Title',
                },
            });
        });

        test('# Title: FilterList Title — hash marker', () => {
            expect(parseCommentRule('# Title: FilterList Title', { isLocIncluded: true })).toMatchObject({
                type: 'MetadataCommentRule',
                start: 0,
                end: 25,
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
                    end: 7,
                    value: 'Title',
                },
                value: {
                    type: 'Value',
                    start: 9,
                    end: 25,
                    value: 'FilterList Title',
                },
            });
        });

        test('! title: FilterList Title — case-insensitive header', () => {
            expect(parseCommentRule('! title: FilterList Title', { isLocIncluded: true })).toMatchObject({
                type: 'MetadataCommentRule',
                start: 0,
                end: 25,
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
                    value: 'title',
                },
                value: {
                    type: 'Value',
                    start: 9,
                    end: 25,
                    value: 'FilterList Title',
                },
            });
        });

        test('!    title:    Filter   — extra whitespace, trailing trimmed', () => {
            expect(parseCommentRule('!    title:    Filter   ', { isLocIncluded: true })).toMatchObject({
                type: 'MetadataCommentRule',
                start: 0,
                end: 24,
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
                    start: 5,
                    end: 10,
                    value: 'title',
                },
                value: {
                    type: 'Value',
                    start: 15,
                    end: 21,
                    value: 'Filter',
                },
            });
        });

        test('! Homepage: https://github.com/AdguardTeam/some-repo/wiki — single-word header', () => {
            expect(
                parseCommentRule('! Homepage: https://github.com/AdguardTeam/some-repo/wiki', { isLocIncluded: true }),
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
        });

        test('! Last Modified: 2024-03-12 — multi-word header', () => {
            expect(parseCommentRule('! Last Modified: 2024-03-12', { isLocIncluded: true })).toMatchObject({
                type: 'MetadataCommentRule',
                start: 0,
                end: 27,
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
                    end: 15,
                    value: 'Last Modified',
                },
                value: {
                    type: 'Value',
                    start: 17,
                    end: 27,
                    value: '2024-03-12',
                },
            });
        });

        test('! last modified: 2024-03-12 — multi-word header case-insensitive', () => {
            expect(parseCommentRule('! last modified: 2024-03-12', { isLocIncluded: true })).toMatchObject({
                type: 'MetadataCommentRule',
                start: 0,
                end: 27,
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
                    end: 15,
                    value: 'last modified',
                },
                value: {
                    type: 'Value',
                    start: 17,
                    end: 27,
                    value: '2024-03-12',
                },
            });
        });

        test('! Time Updated: 15:30:00 — another multi-word header', () => {
            expect(parseCommentRule('! Time Updated: 15:30:00', { isLocIncluded: true })).toMatchObject({
                type: 'MetadataCommentRule',
                start: 0,
                end: 24,
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
                    end: 14,
                    value: 'Time Updated',
                },
                value: {
                    type: 'Value',
                    start: 16,
                    end: 24,
                    value: '15:30:00',
                },
            });
        });
    });

    describe('parse (without location)', () => {
        test('! Title: FilterList Title — no loc, no raws by default', () => {
            expect(parseCommentRule('! Title: FilterList Title')).toEqual({
                type: 'MetadataCommentRule',
                category: 'Comment',
                syntax: 'Common',
                marker: {
                    type: 'Value',
                    value: '!',
                },
                header: {
                    type: 'Value',
                    value: 'Title',
                },
                value: {
                    type: 'Value',
                    value: 'FilterList Title',
                },
            });
        });

        test('# Title: FilterList Title — hash marker without location', () => {
            expect(parseCommentRule('# Title: FilterList Title')).toEqual({
                type: 'MetadataCommentRule',
                category: 'Comment',
                syntax: 'Common',
                marker: {
                    type: 'Value',
                    value: '#',
                },
                header: {
                    type: 'Value',
                    value: 'Title',
                },
                value: {
                    type: 'Value',
                    value: 'FilterList Title',
                },
            });
        });

        test('includeRaws adds raws.text', () => {
            const source = '! Title: FilterList Title';
            const result = parseCommentRule(source, { includeRaws: true });
            expect(result.raws).toEqual({ text: source });
        });
    });

    describe('non-metadata falls back to SimpleCommentRule', () => {
        // Unknown header names are classified as Simple, not Metadata
        test('! aaa: bbb — unknown header classifies as SimpleCommentRule', () => {
            expect(parseCommentRule('! aaa: bbb')).toMatchObject({ type: 'CommentRule' });
        });

        test('!aaa:bbb — missing marker space classifies as SimpleCommentRule', () => {
            expect(parseCommentRule('!aaa:bbb')).toMatchObject({ type: 'CommentRule' });
        });
    });
});
