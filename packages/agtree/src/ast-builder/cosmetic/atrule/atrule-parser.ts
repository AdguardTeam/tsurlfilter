/**
 * @file CSS at-rule pipeline parser.
 *
 * Instance-based parser that owns a `Tokenizer` and a `ParserContext`,
 * reusing them across calls for optimal performance. Exposes a high-level
 * `parse()` entry point that runs the full three-stage pipeline:
 * tokenize → structural parse → AST build.
 */

import type { CssAtRule, CssAtRuleParseOptions } from '../../../nodes';
import { createParserContext, initParserContext, type ParserContext } from '../../../parser/context';
import { CssAtRuleParser } from '../../../parser/css/atrule';
import { AT_MIN_DATA_SLOTS } from '../../../parser/css/atrule/constants';
import { Tokenizer } from '../../../tokenizer/tokenizer';
import type { ParserCapacity } from '../../capacity';

import { CssAtRuleAstBuilder } from './atrule';

/**
 * Default token capacity for the CSS at-rule pipeline parser.
 */
const DEFAULT_TOKEN_CAPACITY = 1024;

/**
 * CSS at-rule pipeline parser.
 *
 * Owns the tokenizer and parser context, reusing them across `parse()` calls.
 * Wrap this in a singleton or a per-worker instance for best performance.
 *
 * @example
 * ```typescript
 * const parser = new CssAtRulePipelineParser();
 * const ast = parser.parse('@media (min-width: 400px) { div { color: red; } }');
 * console.log(ast.name.value); // 'media'
 * ```
 */
export class CssAtRulePipelineParser {
    /**
     * Tokenizer instance — reused across `parse()` calls.
     */
    private readonly tokenizer: Tokenizer;

    /**
     * Parser context — reused across `parse()` calls.
     */
    private readonly ctx: ParserContext;

    /**
     * Creates a new `CssAtRulePipelineParser`.
     *
     * @param capacity Optional capacity configuration. When omitted, sensible
     *   defaults are used (`tokenCapacity = 1024`).
     */
    constructor(capacity?: ParserCapacity) {
        const tokenCapacity = capacity?.tokenCapacity ?? DEFAULT_TOKEN_CAPACITY;

        this.tokenizer = new Tokenizer(tokenCapacity);
        this.ctx = createParserContext(tokenCapacity);

        // Ensure the data buffer is large enough for the at-rule header
        // plus the inner CSS-rule sub-parser region.
        if (this.ctx.data.length < AT_MIN_DATA_SLOTS) {
            this.ctx.data = new Int32Array(AT_MIN_DATA_SLOTS);
        }
    }

    /**
     * Parse a CSS at-rule string.
     *
     * Runs the full pipeline on `source` and returns a `CssAtRule` AST node.
     *
     * @param source Raw CSS at-rule string (e.g. `'@media screen { ... }'`).
     * @param options Parse options.
     *
     * @returns `CssAtRule` AST node.
     */
    public parse(source: string, options: CssAtRuleParseOptions = {}): CssAtRule {
        const { tokenizer, ctx } = this;

        // Stage 1: tokenize
        tokenizer.setSource(source, 0);
        initParserContext(ctx, source, tokenizer, 0);

        // Stage 2: structural parse
        CssAtRuleParser.parse(ctx, 0, ctx.tokenCount, 0);

        // Stage 3: AST build
        return CssAtRuleAstBuilder.parse(ctx, source, ctx.data, 0, 0, source.length, options);
    }

    /**
     * Parse a CSS at-rule from a token sub-range within an already-tokenized context.
     *
     * Use this when a parent parser has already tokenized a larger source and
     * wants to parse an at-rule covering tokens `[startTi, endTi)` without
     * re-tokenizing.
     *
     * @param ctx Pre-populated parser context (the caller's tokenized context).
     * @param startTi Index of the first token in the at-rule range.
     * @param endTi Index one past the last token in the at-rule range.
     * @param dataOffset Offset within `ctx.data` where the at-rule structural
     *   data should be written (must leave room for `AT_MIN_DATA_SLOTS` slots).
     * @param options Parse options.
     *
     * @returns `CssAtRule` AST node.
     */
    // eslint-disable-next-line class-methods-use-this
    public parseRange(
        ctx: ParserContext,
        startTi: number,
        endTi: number,
        dataOffset: number,
        options: CssAtRuleParseOptions = {},
    ): CssAtRule {
        // Stage 2: structural parse into the caller's context
        CssAtRuleParser.parse(ctx, startTi, endTi, dataOffset);

        // Compute source boundaries from the parsed data
        const ruleStart = CssAtRuleParser.sourceStart(ctx.data, dataOffset);
        const ruleEnd = endTi > 0 ? ctx.ends[endTi - 1] : ruleStart;

        // Stage 3: AST build
        return CssAtRuleAstBuilder.parse(
            ctx,
            ctx.source,
            ctx.data,
            dataOffset,
            ruleStart,
            ruleEnd,
            options,
        );
    }
}
