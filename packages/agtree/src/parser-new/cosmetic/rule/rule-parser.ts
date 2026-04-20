/**
 * @file Convenience CSS rule parser — full pipeline.
 *
 * Owns a reusable tokenizer and preparser context and runs the complete
 * pipeline (tokenize → preparse rule → conditionally preparse sub-structures
 * → AST build) from a raw CSS rule string.
 */

import type { CssRule, CssRuleParseOptions } from '../../../nodes-new';
import { createPreparserContext, initPreparserContext } from '../../../preparser/context';
import { CssRulePreparser } from '../../../preparser/css/rule';
import { CR_MIN_DATA_SLOTS } from '../../../preparser/css/rule/constants';
import { Tokenizer } from '../../../tokenizer/tokenizer';

import { CssRuleAstParser } from './rule';

/**
 * Default tokenizer capacity for standalone CSS rule parsing.
 * Sized to handle selector + declaration tokens.
 */
const CR_TOKEN_CAPACITY = 512;

/**
 * Convenience parser for CSS qualified rules.
 *
 * Allocates a reusable tokenizer and preparser context on first use
 * and reuses them across calls via the static `parse()` method. Runs the
 * full pipeline (tokenize → preparse → AST build) from a raw string.
 */
export class CssRuleParser {
    /**
     * Reusable tokenizer instance shared across all calls.
     */
    private static readonly tokenizer = new Tokenizer(CR_TOKEN_CAPACITY);

    /**
     * Reusable preparser context shared across all calls.
     * Data buffer is sized to hold the rule header + sub-preparser regions.
     */
    private static readonly ctx = (() => {
        const c = createPreparserContext(CR_TOKEN_CAPACITY);
        // Ensure the data buffer is large enough for rule + sub-preparsers
        if (c.data.length < CR_MIN_DATA_SLOTS) {
            c.data = new Int32Array(CR_MIN_DATA_SLOTS);
        }
        return c;
    })();

    /**
     * Parse a CSS qualified rule from a raw string.
     *
     * Defaults to `isLocIncluded: true`.
     *
     * @param raw Raw CSS rule string (e.g., `"div { color: red; }"`).
     * @param options Parse options.
     * @param baseOffset Starting offset of the input within the original source.
     *
     * @returns CssRule AST node.
     *
     * @throws {AdblockSyntaxError} If the rule contains syntax errors.
     */
    public static parse(
        raw: string,
        options: CssRuleParseOptions = {},
        baseOffset = 0,
    ): CssRule {
        const { tokenizer, ctx } = CssRuleParser;
        const dataOffset = 0;

        // Stage 1: tokenize
        tokenizer.setSource(raw, 0);

        // Stage 2: bind tokenizer output to preparser context.
        // Always use sourceStart=0 so every token position stored in ctx.data is a
        // LOCAL offset (0-based within `raw`). The `baseOffset` shift is applied
        // later in CssRuleAstParser when setting node boundary positions, keeping
        // source.slice() calls consistent with the local string.
        initPreparserContext(ctx, raw, tokenizer, 0);

        // Stage 3: preparse rule structure — may throw AdblockSyntaxError
        CssRulePreparser.preparse(
            ctx,
            0,
            ctx.tokenCount,
            dataOffset,
        );

        // Stage 4: build AST from preparsed data (includes sub-preparsing)
        return CssRuleAstParser.parse(
            ctx,
            raw,
            ctx.data,
            dataOffset,
            baseOffset,
            baseOffset + raw.length,
            options,
        );
    }
}
