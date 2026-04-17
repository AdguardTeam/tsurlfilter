/**
 * @file Convenience selector list parser — full pipeline.
 *
 * Owns a reusable tokenizer and preparser context and runs the complete
 * pipeline (tokenize → preparse → AST build) from a raw CSS selector string.
 */

import type { SelectorList } from '../../../nodes-new';
import { createPreparserContext, initPreparserContext } from '../../../preparser/context';
import { SelectorListPreparser } from '../../../preparser/css/selector-list';
import { DEFAULT_MAX_COMPLEX } from '../../../preparser/css/selector-list/constants';
import { Tokenizer } from '../../../tokenizer/tokenizer';

import { SelectorListAstParser, type SelectorListParseOptions } from './selector-list';

/**
 * Default tokenizer capacity for standalone selector list parsing.
 * Sized to handle the largest realistic selector strings.
 */
const SL_TOKEN_CAPACITY = 512;

/**
 * Convenience parser for CSS selector lists.
 *
 * Allocates a reusable tokenizer and preparser context on first construction
 * and reuses them across calls via the static `parse()` method. Running the
 * full pipeline (tokenize → preparse → AST build) from a raw string.
 */
export class SelectorListParser {
    /**
     * Reusable tokenizer instance shared across all calls.
     */
    private static readonly tokenizer = new Tokenizer(SL_TOKEN_CAPACITY);

    /**
     * Reusable preparser context shared across all calls.
     */
    private static readonly ctx = createPreparserContext(SL_TOKEN_CAPACITY);

    /**
     * Parse a CSS selector list from a raw string.
     *
     * Defaults to `isLocIncluded: true` so that the output matches the
     * behaviour of the old `SelectorListParser.parse()`.
     *
     * @param raw Raw CSS selector list string.
     * @param options Parse options.
     * @param baseOffset Starting offset of the input within the original source
     *   (used to shift all source positions in the output nodes). Defaults to 0.
     *
     * @returns SelectorList AST node.
     *
     * @throws {AdblockSyntaxError} If the selector list contains syntax errors
     *   (thrown by the preparser during the preparse stage).
     */
    public static parse(
        raw: string,
        options: SelectorListParseOptions = {},
        baseOffset = 0,
    ): SelectorList {
        const { tokenizer, ctx } = SelectorListParser;
        const dataOffset = 0;
        const maxComplex = DEFAULT_MAX_COMPLEX;
        const { isLocIncluded = true } = options;

        // Stage 1: tokenize
        tokenizer.setSource(raw, 0);

        // Stage 2: bind tokenizer output to preparser context
        initPreparserContext(ctx, raw, tokenizer, baseOffset);

        // Stage 3: preparse — may throw AdblockSyntaxError
        SelectorListPreparser.preparse(
            ctx,
            0,
            ctx.tokenCount,
            dataOffset,
            maxComplex,
        );

        // Stage 4: build AST from preparsed data
        return SelectorListAstParser.parse(
            raw,
            ctx.data,
            dataOffset,
            maxComplex,
            baseOffset,
            baseOffset + raw.length,
            { isLocIncluded },
        );
    }
}
