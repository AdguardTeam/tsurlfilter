import { describe, expect, test } from 'vitest';

import {
    CommentKind,
    CommentParser,
    createParserContext,
    initParserContext,
    MetadataCommentParser,
} from '../../../src/parser';
import { Tokenizer } from '../../../src/tokenizer/tokenizer';

const tokenizer = new Tokenizer(1024);

const ctx = createParserContext();

/**
 * Tokenize + parse a comment rule in one step for convenience.
 *
 * @param source Source string to parse.
 *
 * @returns Preparsed data buffer.
 */
function parse(source: string): Int32Array {
    tokenizer.setSource(source);
    initParserContext(ctx, source, tokenizer);
    CommentParser.parse(ctx);
    return ctx.data;
}

describe('MetadataCommentParser', () => {
    describe('classification', () => {
        test('! Title: FilterList Title', () => {
            parse('! Title: FilterList Title');
            expect(CommentParser.kind(ctx)).toBe(CommentKind.Metadata);
        });

        test('# Title: FilterList Title — hash marker', () => {
            parse('# Title: FilterList Title');
            expect(CommentParser.kind(ctx)).toBe(CommentKind.Metadata);
        });

        test('! title: FilterList Title — case-insensitive header', () => {
            parse('! title: FilterList Title');
            expect(CommentParser.kind(ctx)).toBe(CommentKind.Metadata);
        });

        test('! Homepage: https://example.com', () => {
            parse('! Homepage: https://example.com');
            expect(CommentParser.kind(ctx)).toBe(CommentKind.Metadata);
        });

        test('! Version: 2.0.0', () => {
            parse('! Version: 2.0.0');
            expect(CommentParser.kind(ctx)).toBe(CommentKind.Metadata);
        });

        test('! Expires: 4 days (update frequency)', () => {
            parse('! Expires: 4 days (update frequency)');
            expect(CommentParser.kind(ctx)).toBe(CommentKind.Metadata);
        });
    });

    describe('marker position', () => {
        test('! Title: ... — marker at 0', () => {
            expect(MetadataCommentParser.markerStart(parse('! Title: FilterList Title'))).toBe(0);
        });

        test('# Title: ... — hash marker at 0', () => {
            expect(MetadataCommentParser.markerStart(parse('# Title: FilterList Title'))).toBe(0);
        });
    });

    describe('header bounds', () => {
        test('! Title: FilterList Title — header at [2, 7)', () => {
            const source = '! Title: FilterList Title';
            const d = parse(source);
            expect(MetadataCommentParser.headerStart(d)).toBe(2);
            expect(MetadataCommentParser.headerEnd(d)).toBe(7);
            expect(source.slice(2, 7)).toBe('Title');
        });

        test('# Title: FilterList Title — header at [2, 7)', () => {
            const source = '# Title: FilterList Title';
            const d = parse(source);
            expect(MetadataCommentParser.headerStart(d)).toBe(2);
            expect(MetadataCommentParser.headerEnd(d)).toBe(7);
        });

        test('! title: FilterList Title — lowercase header at [2, 7)', () => {
            const source = '! title: FilterList Title';
            const d = parse(source);
            expect(MetadataCommentParser.headerStart(d)).toBe(2);
            expect(MetadataCommentParser.headerEnd(d)).toBe(7);
            expect(source.slice(2, 7)).toBe('title');
        });

        test('!    title:    Filter   — header after leading spaces at [5, 10)', () => {
            const source = '!    title:    Filter   ';
            const d = parse(source);
            expect(MetadataCommentParser.headerStart(d)).toBe(5);
            expect(MetadataCommentParser.headerEnd(d)).toBe(10);
            expect(source.slice(5, 10)).toBe('title');
        });

        test('! Homepage: ... — header at [2, 10)', () => {
            const source = '! Homepage: https://github.com/AdguardTeam/some-repo/wiki';
            const d = parse(source);
            expect(MetadataCommentParser.headerStart(d)).toBe(2);
            expect(MetadataCommentParser.headerEnd(d)).toBe(10);
            expect(source.slice(2, 10)).toBe('Homepage');
        });
    });

    describe('value bounds', () => {
        test('! Title: FilterList Title — value at [9, 25)', () => {
            const source = '! Title: FilterList Title';
            const d = parse(source);
            expect(MetadataCommentParser.valueStart(d)).toBe(9);
            expect(MetadataCommentParser.valueEnd(d)).toBe(25);
            expect(source.slice(9, 25)).toBe('FilterList Title');
        });

        test('!    title:    Filter   — trailing whitespace trimmed, value at [15, 21)', () => {
            const source = '!    title:    Filter   ';
            const d = parse(source);
            expect(MetadataCommentParser.valueStart(d)).toBe(15);
            expect(MetadataCommentParser.valueEnd(d)).toBe(21);
            expect(source.slice(15, 21)).toBe('Filter');
        });

        test('! Homepage: URL — value at [12, 57)', () => {
            const source = '! Homepage: https://github.com/AdguardTeam/some-repo/wiki';
            const d = parse(source);
            expect(MetadataCommentParser.valueStart(d)).toBe(12);
            expect(MetadataCommentParser.valueEnd(d)).toBe(57);
            expect(source.slice(12, 57)).toBe('https://github.com/AdguardTeam/some-repo/wiki');
        });
    });
});
