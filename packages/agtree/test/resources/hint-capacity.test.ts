/**
 * @file Resource bounds and history independence for comment records
 * (F-006, F-013, A11-11).
 *
 * Hint and agent records live at the start of `ctx.data`. Before the guards,
 * a long hint comment wrote its records past the buffer, the count stayed
 * large, and every AST child's name aliased the whole source (a memory
 * amplification), while a long agent list failed with a misleading
 * "Agent name cannot be empty". The capacity is now a fixed constant, so the
 * outcome must not depend on what the pipeline parsed before.
 */

import { describe, expect, test } from 'vitest';

import { RuleParserPipeline } from '../../src/ast-builder/rule-parser';
import { FilterListPipeline } from '../../src/filter-list/pipeline';
import { RuleGenerator } from '../../src/generator/rule-generator';
import type { HintCommentRule } from '../../src/nodes';
import { NodeType } from '../../src/nodes';

/**
 * Builds a hint comment with `count` hints.
 *
 * @param count Number of hints.
 *
 * @returns Hint comment source.
 */
const buildHints = (count: number): string => `!+ ${Array.from({ length: count }, (_, i) => `H${i}`).join(' ')}`;

/**
 * A rule that grows the parser context well beyond the default buffer: 600
 * domains and 60 modifiers. Used to prove the comment capacity does not grow
 * with the buffer left by the previous parse (A06 S-6).
 */
const GROWING_RULE = `${Array.from({ length: 600 }, (_, i) => `d${i}.example`).join(',')}##div`;

/**
 * Parses `source` with a pipeline that has already parsed `GROWING_RULE`.
 *
 * @param source Rule to parse.
 *
 * @returns The AST node, or the thrown error.
 */
function parseAfterGrowingRule(source: string): HintCommentRule {
    const pipeline = new RuleParserPipeline();
    pipeline.parse(GROWING_RULE);
    return pipeline.parse(source) as HintCommentRule;
}

describe('hint capacity (F-006)', () => {
    test('three hints are returned in order', () => {
        const ast = new RuleParserPipeline().parse(buildHints(3)) as HintCommentRule;

        expect(ast.children.map((hint) => hint.name.value)).toEqual(['H0', 'H1', 'H2']);
    });

    test.each([3, 240, 241, 300, 3_000])('n = %i: all hints or a capacity error, never a corrupted name', (count) => {
        const source = buildHints(count);
        const pipelines = [
            new RuleParserPipeline(),
            new RuleParserPipeline(),
        ];

        pipelines[1].parse(GROWING_RULE);

        for (const pipeline of pipelines) {
            let ast: HintCommentRule | undefined;
            try {
                ast = pipeline.parse(source) as HintCommentRule;
            } catch (error) {
                expect((error as Error).message).toMatch(/maximum of 240 hints/i);
            }

            if (!ast) {
                expect(count).toBeGreaterThan(240);
                continue;
            }

            expect(ast.children).toHaveLength(count);
            for (const [i, hint] of ast.children.entries()) {
                expect(hint.name.value).toBe(`H${i}`);
                expect(hint.name.value.length).toBeLessThanOrEqual(source.length);
            }

            // The generated text must stay comparable to the input: a name
            // that aliased the whole source generated megabytes from a line.
            expect(RuleGenerator.generate(ast).length).toBeLessThanOrEqual(source.length * 2);
        }
    });

    test('history does not change the outcome', () => {
        const source = buildHints(240);
        const fresh = new RuleParserPipeline().parse(source) as HintCommentRule;
        const afterGrowing = parseAfterGrowingRule(source);

        expect(afterGrowing.children.map((hint) => hint.name.value))
            .toEqual(fresh.children.map((hint) => hint.name.value));

        expect(() => parseAfterGrowingRule(buildHints(241))).toThrow(/maximum of 240 hints/i);
    });

    test('tolerant list parsing turns an over-capacity hint comment into InvalidRule', () => {
        const pipeline = new FilterListPipeline();
        const errors: unknown[] = [];
        const ast = pipeline.parse(buildHints(300), { onParseError: (error) => errors.push(error) });

        expect(ast.children).toHaveLength(1);
        expect(ast.children[0].type).toBe(NodeType.InvalidRule);
        expect(errors).toHaveLength(1);
        expect((errors[0] as Error).message).toMatch(/maximum of 240 hints/i);
    });

    test('in-limit hint comments keep locations', () => {
        const source = buildHints(240);
        const ast = new RuleParserPipeline().parse(source, { isLocIncluded: true }) as HintCommentRule;

        for (const hint of ast.children) {
            expect(hint.start).toBeGreaterThanOrEqual(0);
            expect(hint.end).toBeGreaterThan(hint.start as number);
            expect(hint.end).toBeLessThanOrEqual(source.length);
        }
    });
});

describe('agent capacity (F-013)', () => {
    test.each([400, 480])('n = %i agents parse', (count) => {
        const source = `[${'AdGuard; '.repeat(count)}]`;
        const ast = new RuleParserPipeline().parse(source);

        expect((ast as unknown as { children: unknown[] }).children).toHaveLength(count);
    });

    test.each([481, 600])('n = %i agents gives a capacity error, not "Agent name cannot be empty"', (count) => {
        const source = `[${'AdGuard; '.repeat(count)}]`;

        expect(() => new RuleParserPipeline().parse(source)).toThrow(/maximum of 480 agents/i);
        expect(() => new RuleParserPipeline().parse(source)).not.toThrow(/Agent name cannot be empty/i);
    });

    test('history does not change the agent outcome', () => {
        const pipeline = new RuleParserPipeline();
        pipeline.parse(GROWING_RULE);
        expect(() => pipeline.parse(`[${'AdGuard; '.repeat(481)}]`)).toThrow(/maximum of 480 agents/i);
    });
});
