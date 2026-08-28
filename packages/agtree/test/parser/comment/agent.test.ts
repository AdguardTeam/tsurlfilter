import { describe, expect, test } from 'vitest';

import {
    AgentCommentParser,
    CommentKind,
    CommentParser,
    createParserContext,
    initParserContext,
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

describe('AgentCommentParser', () => {
    describe('classification', () => {
        test('[AdBlock]', () => {
            parse('[AdBlock]');
            expect(CommentParser.kind(ctx)).toBe(CommentKind.Agent);
        });

        test('[AdGuard]', () => {
            parse('[AdGuard]');
            expect(CommentParser.kind(ctx)).toBe(CommentKind.Agent);
        });

        test('[uBlock Origin]', () => {
            parse('[uBlock Origin]');
            expect(CommentParser.kind(ctx)).toBe(CommentKind.Agent);
        });

        test('[Adblock Plus 2.0]', () => {
            parse('[Adblock Plus 2.0]');
            expect(CommentParser.kind(ctx)).toBe(CommentKind.Agent);
        });

        test('[Adblock Plus 2.0; AdGuard]', () => {
            parse('[Adblock Plus 2.0; AdGuard]');
            expect(CommentParser.kind(ctx)).toBe(CommentKind.Agent);
        });

        test('[Adblock Plus 3.1; AdGuard 1.4; uBlock Origin 1.0.15.0]', () => {
            parse('[Adblock Plus 3.1; AdGuard 1.4; uBlock Origin 1.0.15.0]');
            expect(CommentParser.kind(ctx)).toBe(CommentKind.Agent);
        });

        test('[] — empty brackets', () => {
            parse('[]');
            expect(CommentParser.kind(ctx)).toBe(CommentKind.Agent);
        });

        test('[ ] — whitespace only', () => {
            parse('[ ]');
            expect(CommentParser.kind(ctx)).toBe(CommentKind.Agent);
        });
    });

    describe('count', () => {
        test('[AdBlock] → 1', () => {
            expect(AgentCommentParser.count(parse('[AdBlock]'))).toBe(1);
        });

        test('[Adblock Plus 2.0] → 1', () => {
            expect(AgentCommentParser.count(parse('[Adblock Plus 2.0]'))).toBe(1);
        });

        test('[uBlock Origin 1.0.0] → 1', () => {
            expect(AgentCommentParser.count(parse('[uBlock Origin 1.0.0]'))).toBe(1);
        });

        test('[Adblock Plus 2.0; AdGuard] → 2', () => {
            expect(AgentCommentParser.count(parse('[Adblock Plus 2.0; AdGuard]'))).toBe(2);
        });

        test('[Adblock Plus 2.0; AdGuard 1.0.1.10] → 2', () => {
            expect(AgentCommentParser.count(parse('[Adblock Plus 2.0; AdGuard 1.0.1.10]'))).toBe(2);
        });

        test('[Adblock Plus 3.1; AdGuard 1.4; uBlock Origin 1.0.15.0] → 3', () => {
            const d = parse('[Adblock Plus 3.1; AdGuard 1.4; uBlock Origin 1.0.15.0]');
            expect(AgentCommentParser.count(d)).toBe(3);
        });

        test('[] → 0', () => {
            expect(AgentCommentParser.count(parse('[]'))).toBe(0);
        });

        test('[ ] → 0', () => {
            expect(AgentCommentParser.count(parse('[ ]'))).toBe(0);
        });

        test('[;] → 0', () => {
            expect(AgentCommentParser.count(parse('[;]'))).toBe(0);
        });

        test('[ ; ] → 0', () => {
            expect(AgentCommentParser.count(parse('[ ; ]'))).toBe(0);
        });

        test('[;;] → 0', () => {
            expect(AgentCommentParser.count(parse('[;;]'))).toBe(0);
        });

        test('[ ; ; ] → 0', () => {
            expect(AgentCommentParser.count(parse('[ ; ; ]'))).toBe(0);
        });
    });

    describe('agent source bounds', () => {
        test('[AdBlock] — single agent', () => {
            const source = '[AdBlock]';
            const d = parse(source);
            expect(AgentCommentParser.count(d)).toBe(1);
            expect(AgentCommentParser.agentStart(d, 0)).toBe(1);
            expect(AgentCommentParser.agentEnd(d, 0)).toBe(8);
        });

        test('[AdGuard] — single agent', () => {
            const source = '[AdGuard]';
            const d = parse(source);
            expect(AgentCommentParser.agentStart(d, 0)).toBe(1);
            expect(AgentCommentParser.agentEnd(d, 0)).toBe(8);
        });

        test('[uBlock Origin] — multi-word name', () => {
            const source = '[uBlock Origin]';
            const d = parse(source);
            expect(AgentCommentParser.count(d)).toBe(1);
            expect(AgentCommentParser.agentStart(d, 0)).toBe(1);
            expect(AgentCommentParser.agentEnd(d, 0)).toBe(14);
        });

        test('[Adblock Plus 2.0] — name + version', () => {
            const source = '[Adblock Plus 2.0]';
            const d = parse(source);
            expect(AgentCommentParser.count(d)).toBe(1);
            expect(AgentCommentParser.agentStart(d, 0)).toBe(1);
            expect(AgentCommentParser.agentEnd(d, 0)).toBe(17);
        });

        test('[uBlock Origin 1.0.0] — multi-word name + version', () => {
            const source = '[uBlock Origin 1.0.0]';
            const d = parse(source);
            expect(AgentCommentParser.count(d)).toBe(1);
            expect(AgentCommentParser.agentStart(d, 0)).toBe(1);
            expect(AgentCommentParser.agentEnd(d, 0)).toBe(20);
        });

        test('[Adblock Plus 2.0; AdGuard] — two agents', () => {
            const source = '[Adblock Plus 2.0; AdGuard]';
            const d = parse(source);
            expect(AgentCommentParser.count(d)).toBe(2);
            expect(AgentCommentParser.agentStart(d, 0)).toBe(1);
            expect(AgentCommentParser.agentEnd(d, 0)).toBe(17);
            expect(AgentCommentParser.agentStart(d, 1)).toBe(19);
            expect(AgentCommentParser.agentEnd(d, 1)).toBe(26);
        });

        test('[Adblock Plus 2.0; AdGuard 1.0.1.10] — two agents with versions', () => {
            const source = '[Adblock Plus 2.0; AdGuard 1.0.1.10]';
            const d = parse(source);
            expect(AgentCommentParser.count(d)).toBe(2);
            expect(AgentCommentParser.agentStart(d, 0)).toBe(1);
            expect(AgentCommentParser.agentEnd(d, 0)).toBe(17);
            expect(AgentCommentParser.agentStart(d, 1)).toBe(19);
            expect(AgentCommentParser.agentEnd(d, 1)).toBe(35);
        });

        test('[Adblock Plus 3.1; AdGuard 1.4; uBlock Origin 1.0.15.0] — three agents', () => {
            const source = '[Adblock Plus 3.1; AdGuard 1.4; uBlock Origin 1.0.15.0]';
            const d = parse(source);
            expect(AgentCommentParser.count(d)).toBe(3);
            expect(AgentCommentParser.agentStart(d, 0)).toBe(1);
            expect(AgentCommentParser.agentEnd(d, 0)).toBe(17);
            expect(AgentCommentParser.agentStart(d, 1)).toBe(19);
            expect(AgentCommentParser.agentEnd(d, 1)).toBe(30);
            expect(AgentCommentParser.agentStart(d, 2)).toBe(32);
            expect(AgentCommentParser.agentEnd(d, 2)).toBe(54);
        });

        test('trailing whitespace is trimmed from each agent span', () => {
            const source = '[Adblock Plus 3.1 ; AdGuard  1.4 ;   uBlock Origin    1.0.15.0    ]';
            const d = parse(source);
            expect(AgentCommentParser.count(d)).toBe(3);
            expect(AgentCommentParser.agentStart(d, 0)).toBe(1);
            expect(AgentCommentParser.agentEnd(d, 0)).toBe(17);
            expect(AgentCommentParser.agentStart(d, 1)).toBe(20);
            expect(AgentCommentParser.agentEnd(d, 1)).toBe(32);
            expect(AgentCommentParser.agentStart(d, 2)).toBe(37);
            expect(AgentCommentParser.agentEnd(d, 2)).toBe(62);
        });

        test('[;] — single semicolon produces no agents', () => {
            expect(AgentCommentParser.count(parse('[;]'))).toBe(0);
        });

        test('[ ; ] — semicolon with spaces produces no agents', () => {
            expect(AgentCommentParser.count(parse('[ ; ]'))).toBe(0);
        });

        test('[;;] — multiple semicolons produce no agents', () => {
            expect(AgentCommentParser.count(parse('[;;]'))).toBe(0);
        });

        test('[ ;; ] — multiple semicolons with spaces produce no agents', () => {
            expect(AgentCommentParser.count(parse('[ ;; ]'))).toBe(0);
        });

        test('[ ; ; ] — alternating spaces and semicolons produce no agents', () => {
            expect(AgentCommentParser.count(parse('[ ; ; ]'))).toBe(0);
        });
    });
});
