/**
 * @file Tests for overflow signalling via `ctx.status = 1`.
 *
 * Verifies that structural parsers signal recoverable overflow by
 * setting `ctx.status` to 1 and bailing out gracefully — rather than
 * throwing a `RangeError` or `AdblockSyntaxError` for the overflow case.
 */

import { describe, expect, test } from 'vitest';

import { createParserContext, initParserContext } from '../../src/parser/context';
import { DeclarationListParser } from '../../src/parser/css/declaration-list';
import { Tokenizer } from '../../src/tokenizer/tokenizer';

const tokenizer = new Tokenizer(1024);
const ctx = createParserContext();

describe('overflow status', () => {
    test('DeclarationListParser sets ctx.status=1 on capacity overflow', () => {
        const source = 'a: 1; b: 2; c: 3';
        tokenizer.setSource(source);
        initParserContext(ctx, source, tokenizer);
        ctx.status = 0;
        // maxDeclarations = 1 → overflow on second declaration.
        DeclarationListParser.parse(ctx, 0, ctx.tokenCount, 0, 1);
        expect(ctx.status).toBe(1);
    });

    test('DeclarationListParser leaves ctx.status=0 within capacity', () => {
        const source = 'a: 1';
        tokenizer.setSource(source);
        initParserContext(ctx, source, tokenizer);
        ctx.status = 0;
        DeclarationListParser.parse(ctx, 0, ctx.tokenCount, 0, 4);
        expect(ctx.status).toBe(0);
    });
});
