import { describe, expect, test } from 'vitest';

import { RuleParserPipeline } from '../../src/ast-builder/rule-parser';
import * as parserApi from '../../src/parser';
import { RuleKind } from '../../src/parser/classifier';

const pipeline = new RuleParserPipeline();

describe('RuleParserPipeline.parseStructural', () => {
    test('classifies without building an AST', () => {
        expect(pipeline.parseStructural('||example.org^').kind).toBe(RuleKind.Network);
        expect(pipeline.parseStructural('##.ad').kind).toBe(RuleKind.Cosmetic);
        expect(pipeline.parseStructural('! comment').kind).toBe(RuleKind.Comment);
    });

    test('returns the shared ctx with populated data', () => {
        const { ctx } = pipeline.parseStructural('||a.com^$third-party');
        expect(ctx.status).toBe(0);
        expect(ctx.source).toBe('||a.com^$third-party');
    });

    test('flags host candidates', () => {
        expect(pipeline.parseStructural('127.0.0.1 example.com').isHostCandidate).toBe(true);
        expect(pipeline.parseStructural('||example.org^').isHostCandidate).toBe(false);
    });

    test('barrel exports the new public API', () => {
        expect(parserApi.NetworkRuleDataReader).toBeTypeOf('function');
        expect(parserApi.CosmeticRuleDataReader).toBeTypeOf('function');
        expect(parserApi.isHostRuleCandidate).toBeTypeOf('function');
        expect(parserApi.RuleParser).toBeTypeOf('function');
        expect(parserApi.defaultParserOptions).toBeTypeOf('object');
    });

    test('parseFromCurrentCtx builds the same AST as parse without re-parsing', () => {
        const rules = [
            '||example.org^$third-party,domain=x.com|~y.com',
            'example.com##.ad',
            'example.com#@#.ad',
            "example.com#%#//scriptlet('set-constant', 'a', 'true')",
            '127.0.0.1 example.com',
        ];

        for (const rule of rules) {
            const { kind, ctx } = pipeline.parseStructural(rule);
            const fromCtx = pipeline.parseFromCurrentCtx(rule, kind);
            const full = pipeline.parse(rule);

            // Deep equality covers every node field (category, type, syntax,
            // pattern/modifiers/body values) without string round-trips.
            expect(fromCtx).toEqual(full);

            // The context returned by parseStructural must have been the one
            // used to build the AST (no re-tokenization in between).
            expect(ctx.status).toBe(0);
        }
    });
});
