/**
 * @file Parsers must not keep the source they were last given reachable once they are reset (F-012, F-079).
 *
 * A filter list is one big string, so a parser that keeps hold of it pins the whole list in memory.
 * The checks below measure the heap, so they force a garbage collection with `--expose-gc`
 * enabled at runtime.
 */

import { getHeapStatistics, setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';

import { describe, expect, test } from 'vitest';

import { RuleParserPipeline } from '../../src/ast-builder/rule-parser';
import { FilterListPipeline } from '../../src/filter-list/pipeline';
import { createParserContext, initParserContext, resetCtxData } from '../../src/parser/context';
import { Tokenizer } from '../../src/tokenizer/tokenizer';

/**
 * Size of the list used to detect a retained source, in characters (one byte each).
 * Large enough that a pinned copy dwarfs the noise of the test runner's own allocations.
 */
const LIST_SIZE = 16 * 1024 * 1024;

/**
 * Maximum heap growth tolerated after the list is released.
 * A retained list adds `LIST_SIZE`, so this is far below the failure and far above the noise.
 */
const MAX_RETAINED = LIST_SIZE / 4;

setFlagsFromString('--expose-gc');
const gc = runInNewContext('gc') as () => void;

/**
 * Forces a full garbage collection and returns the used heap size.
 *
 * @returns Used heap size in bytes.
 */
const heapUsed = (): number => {
    // A few rounds, because weakly held objects need more than one to go away
    for (let i = 0; i < 3; i += 1) {
        gc();
    }
    return getHeapStatistics().used_heap_size;
};

/**
 * Builds a list of about `LIST_SIZE` characters that contains a platform hint, which is the construct
 * that makes the hint builder tokenize a slice of the list.
 *
 * @returns Filter list source.
 */
const buildListWithHint = (): string => {
    // A unique, flat one-byte string: it is neither interned nor shared with anything else
    const filler = `! ${'a'.repeat(LIST_SIZE)}`;
    return `${filler}\n!+ PLATFORM(windows, mac)\n||example.com^\n`;
};

describe('Released sources', () => {
    test('resetCtxData() drops the source', () => {
        const tokenizer = new Tokenizer(16);
        const ctx = createParserContext(16);

        tokenizer.setSource('||example.com^', 0);
        initParserContext(ctx, '||example.com^', tokenizer, 3);
        ctx.overflowRegion = 'modifiers' as never;

        resetCtxData(ctx, ctx.maxMods, ctx.maxDomains, ctx.maxScriptletBody);

        expect(ctx.source).toBe('');
        expect(ctx.sourceStart).toBe(0);
        expect(ctx.overflowRegion).toBeUndefined();
        expect(ctx.tokenCount).toBe(0);
    });

    test('RuleParserPipeline.reset() drops the last rule and its grown token buffers', () => {
        const parser = new RuleParserPipeline();
        const bigRule = `||example.com^$domain=${Array.from({ length: 5000 }, (_, i) => `d${i}.com`).join('|')}`;

        parser.parse(bigRule);
        parser.reset();

        const { ctx } = parser as unknown as { ctx: { source: string; types: Uint8Array } };
        expect(ctx.source).toBe('');
        // The grown token buffers are released, not only the tokenizer's reference to them
        expect(ctx.types.length).toBeLessThan(5000);
    });

    test('FilterListPipeline.reset() releases the list, including the one the hint builder tokenized', () => {
        const pipeline = new FilterListPipeline();
        const before = heapUsed();

        // Scoped so that the caller keeps neither the list nor the AST
        const childCount = ((): number => {
            const list = buildListWithHint();
            return pipeline.parse(list).children.length;
        })();
        expect(childCount).toBeGreaterThan(0);

        pipeline.reset();

        const after = heapUsed();
        expect(after - before).toBeLessThan(MAX_RETAINED);
    });

    test('a dropped FilterListPipeline leaves no list reachable from module state', () => {
        // A small hinted list first, so that whatever an earlier test left in module state is replaced
        new FilterListPipeline().parse('!+ PLATFORM(windows, mac)\n||example.org^\n');

        const before = heapUsed();

        // Scoped so that nothing but module-level state can still reach the list
        (() => {
            const pipeline = new FilterListPipeline();
            const list = buildListWithHint();
            pipeline.parse(list);
        })();

        const after = heapUsed();
        expect(after - before).toBeLessThan(MAX_RETAINED);
    });
});
