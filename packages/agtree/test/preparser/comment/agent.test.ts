import { describe, test, expect } from 'vitest';

import { tokenizeLine } from '../../../src/tokenizer/tokenizer';
import type { TokenizeResult } from '../../../src/tokenizer/tokenizer';
import {
    createPreparserContext,
    initPreparserContext,
    AgentCommentPreparser,
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
 *
 * @param source - Source string to preparse.
 * @returns Preparsed data buffer.
 */
function preparse(source: string): Int32Array {
    tokenizeLine(source, 0, tokenResult);
    initPreparserContext(ctx, source, tokenResult);
    CommentClassifier.preparse(ctx);
    return ctx.data;
}

describe('AgentCommentPreparser', () => {
    describe('classification', () => {
        test('[AdBlock]', () => {
            preparse('[AdBlock]');
            expect(CommentClassifier.kind(ctx)).toBe(CommentKind.Agent);
        });

        test('[AdGuard]', () => {
            preparse('[AdGuard]');
            expect(CommentClassifier.kind(ctx)).toBe(CommentKind.Agent);
        });

        test('[uBlock Origin]', () => {
            preparse('[uBlock Origin]');
            expect(CommentClassifier.kind(ctx)).toBe(CommentKind.Agent);
        });

        test('[Adblock Plus 2.0]', () => {
            preparse('[Adblock Plus 2.0]');
            expect(CommentClassifier.kind(ctx)).toBe(CommentKind.Agent);
        });

        test('[Adblock Plus 2.0; AdGuard]', () => {
            preparse('[Adblock Plus 2.0; AdGuard]');
            expect(CommentClassifier.kind(ctx)).toBe(CommentKind.Agent);
        });

        test('[Adblock Plus 3.1; AdGuard 1.4; uBlock Origin 1.0.15.0]', () => {
            preparse('[Adblock Plus 3.1; AdGuard 1.4; uBlock Origin 1.0.15.0]');
            expect(CommentClassifier.kind(ctx)).toBe(CommentKind.Agent);
        });

        test('[] — empty brackets', () => {
            preparse('[]');
            expect(CommentClassifier.kind(ctx)).toBe(CommentKind.Agent);
        });

        test('[ ] — whitespace only', () => {
            preparse('[ ]');
            expect(CommentClassifier.kind(ctx)).toBe(CommentKind.Agent);
        });
    });

    describe('count', () => {
        test('[AdBlock] → 1', () => {
            expect(AgentCommentPreparser.count(preparse('[AdBlock]'))).toBe(1);
        });

        test('[Adblock Plus 2.0] → 1', () => {
            expect(AgentCommentPreparser.count(preparse('[Adblock Plus 2.0]'))).toBe(1);
        });

        test('[uBlock Origin 1.0.0] → 1', () => {
            expect(AgentCommentPreparser.count(preparse('[uBlock Origin 1.0.0]'))).toBe(1);
        });

        test('[Adblock Plus 2.0; AdGuard] → 2', () => {
            expect(AgentCommentPreparser.count(preparse('[Adblock Plus 2.0; AdGuard]'))).toBe(2);
        });

        test('[Adblock Plus 2.0; AdGuard 1.0.1.10] → 2', () => {
            expect(AgentCommentPreparser.count(preparse('[Adblock Plus 2.0; AdGuard 1.0.1.10]'))).toBe(2);
        });

        test('[Adblock Plus 3.1; AdGuard 1.4; uBlock Origin 1.0.15.0] → 3', () => {
            const d = preparse('[Adblock Plus 3.1; AdGuard 1.4; uBlock Origin 1.0.15.0]');
            expect(AgentCommentPreparser.count(d)).toBe(3);
        });

        test('[] → 0', () => {
            expect(AgentCommentPreparser.count(preparse('[]'))).toBe(0);
        });

        test('[ ] → 0', () => {
            expect(AgentCommentPreparser.count(preparse('[ ]'))).toBe(0);
        });

        test('[;] → 0', () => {
            expect(AgentCommentPreparser.count(preparse('[;]'))).toBe(0);
        });

        test('[ ; ] → 0', () => {
            expect(AgentCommentPreparser.count(preparse('[ ; ]'))).toBe(0);
        });

        test('[;;] → 0', () => {
            expect(AgentCommentPreparser.count(preparse('[;;]'))).toBe(0);
        });

        test('[ ; ; ] → 0', () => {
            expect(AgentCommentPreparser.count(preparse('[ ; ; ]'))).toBe(0);
        });
    });

    describe('agent source bounds', () => {
        test('[AdBlock] — single agent', () => {
            const source = '[AdBlock]';
            const d = preparse(source);
            expect(AgentCommentPreparser.count(d)).toBe(1);
            expect(AgentCommentPreparser.agentStart(d, 0)).toBe(1);
            expect(AgentCommentPreparser.agentEnd(d, 0)).toBe(8);
        });

        test('[AdGuard] — single agent', () => {
            const source = '[AdGuard]';
            const d = preparse(source);
            expect(AgentCommentPreparser.agentStart(d, 0)).toBe(1);
            expect(AgentCommentPreparser.agentEnd(d, 0)).toBe(8);
        });

        test('[uBlock Origin] — multi-word name', () => {
            const source = '[uBlock Origin]';
            const d = preparse(source);
            expect(AgentCommentPreparser.count(d)).toBe(1);
            expect(AgentCommentPreparser.agentStart(d, 0)).toBe(1);
            expect(AgentCommentPreparser.agentEnd(d, 0)).toBe(14);
        });

        test('[Adblock Plus 2.0] — name + version', () => {
            const source = '[Adblock Plus 2.0]';
            const d = preparse(source);
            expect(AgentCommentPreparser.count(d)).toBe(1);
            expect(AgentCommentPreparser.agentStart(d, 0)).toBe(1);
            expect(AgentCommentPreparser.agentEnd(d, 0)).toBe(17);
        });

        test('[uBlock Origin 1.0.0] — multi-word name + version', () => {
            const source = '[uBlock Origin 1.0.0]';
            const d = preparse(source);
            expect(AgentCommentPreparser.count(d)).toBe(1);
            expect(AgentCommentPreparser.agentStart(d, 0)).toBe(1);
            expect(AgentCommentPreparser.agentEnd(d, 0)).toBe(20);
        });

        test('[Adblock Plus 2.0; AdGuard] — two agents', () => {
            const source = '[Adblock Plus 2.0; AdGuard]';
            const d = preparse(source);
            expect(AgentCommentPreparser.count(d)).toBe(2);
            expect(AgentCommentPreparser.agentStart(d, 0)).toBe(1);
            expect(AgentCommentPreparser.agentEnd(d, 0)).toBe(17);
            expect(AgentCommentPreparser.agentStart(d, 1)).toBe(19);
            expect(AgentCommentPreparser.agentEnd(d, 1)).toBe(26);
        });

        test('[Adblock Plus 2.0; AdGuard 1.0.1.10] — two agents with versions', () => {
            const source = '[Adblock Plus 2.0; AdGuard 1.0.1.10]';
            const d = preparse(source);
            expect(AgentCommentPreparser.count(d)).toBe(2);
            expect(AgentCommentPreparser.agentStart(d, 0)).toBe(1);
            expect(AgentCommentPreparser.agentEnd(d, 0)).toBe(17);
            expect(AgentCommentPreparser.agentStart(d, 1)).toBe(19);
            expect(AgentCommentPreparser.agentEnd(d, 1)).toBe(35);
        });

        test('[Adblock Plus 3.1; AdGuard 1.4; uBlock Origin 1.0.15.0] — three agents', () => {
            const source = '[Adblock Plus 3.1; AdGuard 1.4; uBlock Origin 1.0.15.0]';
            const d = preparse(source);
            expect(AgentCommentPreparser.count(d)).toBe(3);
            expect(AgentCommentPreparser.agentStart(d, 0)).toBe(1);
            expect(AgentCommentPreparser.agentEnd(d, 0)).toBe(17);
            expect(AgentCommentPreparser.agentStart(d, 1)).toBe(19);
            expect(AgentCommentPreparser.agentEnd(d, 1)).toBe(30);
            expect(AgentCommentPreparser.agentStart(d, 2)).toBe(32);
            expect(AgentCommentPreparser.agentEnd(d, 2)).toBe(54);
        });

        test('trailing whitespace is trimmed from each agent span', () => {
            const source = '[Adblock Plus 3.1 ; AdGuard  1.4 ;   uBlock Origin    1.0.15.0    ]';
            const d = preparse(source);
            expect(AgentCommentPreparser.count(d)).toBe(3);
            expect(AgentCommentPreparser.agentStart(d, 0)).toBe(1);
            expect(AgentCommentPreparser.agentEnd(d, 0)).toBe(17);
            expect(AgentCommentPreparser.agentStart(d, 1)).toBe(20);
            expect(AgentCommentPreparser.agentEnd(d, 1)).toBe(32);
            expect(AgentCommentPreparser.agentStart(d, 2)).toBe(37);
            expect(AgentCommentPreparser.agentEnd(d, 2)).toBe(62);
        });

        test('[;] — single semicolon produces no agents', () => {
            expect(AgentCommentPreparser.count(preparse('[;]'))).toBe(0);
        });

        test('[ ; ] — semicolon with spaces produces no agents', () => {
            expect(AgentCommentPreparser.count(preparse('[ ; ]'))).toBe(0);
        });

        test('[;;] — multiple semicolons produce no agents', () => {
            expect(AgentCommentPreparser.count(preparse('[;;]'))).toBe(0);
        });

        test('[ ;; ] — multiple semicolons with spaces produce no agents', () => {
            expect(AgentCommentPreparser.count(preparse('[ ;; ]'))).toBe(0);
        });

        test('[ ; ; ] — alternating spaces and semicolons produce no agents', () => {
            expect(AgentCommentPreparser.count(preparse('[ ; ; ]'))).toBe(0);
        });
    });
});
