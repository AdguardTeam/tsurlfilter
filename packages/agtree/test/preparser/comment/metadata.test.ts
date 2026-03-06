import { describe, test, expect } from 'vitest';

import { tokenizeLine } from '../../../src/tokenizer/tokenizer';
import type { TokenizeResult } from '../../../src/tokenizer/tokenizer';
import {
    createPreparserContext,
    initPreparserContext,
    MetadataCommentPreparser,
    CommentClassifier,
    CommentKind,
} from '../../../src/preparser';

const tokenResult: TokenizeResult = {
    tokenCount: 0,
    types: new Uint8Array(1024),
    ends: new Uint32Array(1024),
    actualEnd: 0,
    overflowed: 0,
};

const ctx = createPreparserContext();

/**
 * Tokenize + preparse a comment rule in one step for convenience.
 */
function preparse(source: string): Int32Array {
    tokenizeLine(source, 0, tokenResult);
    initPreparserContext(ctx, source, tokenResult);
    CommentClassifier.preparse(ctx);
    return ctx.data;
}

describe('MetadataCommentPreparser', () => {
    describe('classification', () => {
        test('! Title: FilterList Title', () => {
            preparse('! Title: FilterList Title');
            expect(CommentClassifier.kind(ctx)).toBe(CommentKind.Metadata);
        });

        test('# Title: FilterList Title — hash marker', () => {
            preparse('# Title: FilterList Title');
            expect(CommentClassifier.kind(ctx)).toBe(CommentKind.Metadata);
        });

        test('! title: FilterList Title — case-insensitive header', () => {
            preparse('! title: FilterList Title');
            expect(CommentClassifier.kind(ctx)).toBe(CommentKind.Metadata);
        });

        test('! Homepage: https://example.com', () => {
            preparse('! Homepage: https://example.com');
            expect(CommentClassifier.kind(ctx)).toBe(CommentKind.Metadata);
        });

        test('! Version: 2.0.0', () => {
            preparse('! Version: 2.0.0');
            expect(CommentClassifier.kind(ctx)).toBe(CommentKind.Metadata);
        });

        test('! Expires: 4 days (update frequency)', () => {
            preparse('! Expires: 4 days (update frequency)');
            expect(CommentClassifier.kind(ctx)).toBe(CommentKind.Metadata);
        });
    });

    describe('marker position', () => {
        test('! Title: ... — marker at 0', () => {
            expect(MetadataCommentPreparser.markerStart(preparse('! Title: FilterList Title'))).toBe(0);
        });

        test('# Title: ... — hash marker at 0', () => {
            expect(MetadataCommentPreparser.markerStart(preparse('# Title: FilterList Title'))).toBe(0);
        });
    });

    describe('header bounds', () => {
        test('! Title: FilterList Title — header at [2, 7)', () => {
            const source = '! Title: FilterList Title';
            const d = preparse(source);
            expect(MetadataCommentPreparser.headerStart(d)).toBe(2);
            expect(MetadataCommentPreparser.headerEnd(d)).toBe(7);
            expect(source.slice(2, 7)).toBe('Title');
        });

        test('# Title: FilterList Title — header at [2, 7)', () => {
            const source = '# Title: FilterList Title';
            const d = preparse(source);
            expect(MetadataCommentPreparser.headerStart(d)).toBe(2);
            expect(MetadataCommentPreparser.headerEnd(d)).toBe(7);
        });

        test('! title: FilterList Title — lowercase header at [2, 7)', () => {
            const source = '! title: FilterList Title';
            const d = preparse(source);
            expect(MetadataCommentPreparser.headerStart(d)).toBe(2);
            expect(MetadataCommentPreparser.headerEnd(d)).toBe(7);
            expect(source.slice(2, 7)).toBe('title');
        });

        test('!    title:    Filter   — header after leading spaces at [5, 10)', () => {
            const source = '!    title:    Filter   ';
            const d = preparse(source);
            expect(MetadataCommentPreparser.headerStart(d)).toBe(5);
            expect(MetadataCommentPreparser.headerEnd(d)).toBe(10);
            expect(source.slice(5, 10)).toBe('title');
        });

        test('! Homepage: ... — header at [2, 10)', () => {
            const source = '! Homepage: https://github.com/AdguardTeam/some-repo/wiki';
            const d = preparse(source);
            expect(MetadataCommentPreparser.headerStart(d)).toBe(2);
            expect(MetadataCommentPreparser.headerEnd(d)).toBe(10);
            expect(source.slice(2, 10)).toBe('Homepage');
        });
    });

    describe('value bounds', () => {
        test('! Title: FilterList Title — value at [9, 25)', () => {
            const source = '! Title: FilterList Title';
            const d = preparse(source);
            expect(MetadataCommentPreparser.valueStart(d)).toBe(9);
            expect(MetadataCommentPreparser.valueEnd(d)).toBe(25);
            expect(source.slice(9, 25)).toBe('FilterList Title');
        });

        test('!    title:    Filter   — trailing whitespace trimmed, value at [15, 21)', () => {
            const source = '!    title:    Filter   ';
            const d = preparse(source);
            expect(MetadataCommentPreparser.valueStart(d)).toBe(15);
            expect(MetadataCommentPreparser.valueEnd(d)).toBe(21);
            expect(source.slice(15, 21)).toBe('Filter');
        });

        test('! Homepage: URL — value at [12, 57)', () => {
            const source = '! Homepage: https://github.com/AdguardTeam/some-repo/wiki';
            const d = preparse(source);
            expect(MetadataCommentPreparser.valueStart(d)).toBe(12);
            expect(MetadataCommentPreparser.valueEnd(d)).toBe(57);
            expect(source.slice(12, 57)).toBe('https://github.com/AdguardTeam/some-repo/wiki');
        });
    });
});
