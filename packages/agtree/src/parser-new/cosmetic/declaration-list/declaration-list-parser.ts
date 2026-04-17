/**
 * @file Convenience declaration list parser — full pipeline.
 *
 * Owns a reusable tokenizer and preparser context and runs the complete
 * pipeline (tokenize → preparse → AST build) from a raw CSS declaration string.
 */

import type { CssDeclarationList } from '../../../nodes-new';
import { createPreparserContext, initPreparserContext } from '../../../preparser/context';
import { DeclarationListPreparser } from '../../../preparser/css/declaration-list';
import { DEFAULT_MAX_DECLARATIONS } from '../../../preparser/css/declaration-list/constants';
import { Tokenizer } from '../../../tokenizer/tokenizer';

import { DeclarationListAstParser, type DeclarationListParseOptions } from './declaration-list';

/**
 * Default tokenizer capacity for standalone declaration list parsing.
 */
const DL_TOKEN_CAPACITY = 256;

/**
 * Convenience parser for CSS declaration lists.
 *
 * Allocates a reusable tokenizer and preparser context on first use
 * and reuses them across calls via the static `parse()` method.
 */
export class DeclarationListParser {
    /**
     * Reusable tokenizer instance shared across all calls.
     */
    private static readonly tokenizer = new Tokenizer(DL_TOKEN_CAPACITY);

    /**
     * Reusable preparser context shared across all calls.
     */
    private static readonly ctx = createPreparserContext(DL_TOKEN_CAPACITY);

    /**
     * Parse a CSS declaration list from a raw string.
     *
     * Defaults to `isLocIncluded: true`.
     *
     * @param raw Raw CSS declaration list string.
     * @param options Parse options.
     * @param baseOffset Starting offset of the input within the original source.
     *
     * @returns CssDeclarationList AST node.
     *
     * @throws {AdblockSyntaxError} If the declaration list contains syntax errors.
     */
    public static parse(
        raw: string,
        options: DeclarationListParseOptions = {},
        baseOffset = 0,
    ): CssDeclarationList {
        const { tokenizer, ctx } = DeclarationListParser;
        const dataOffset = 0;
        const maxDeclarations = DEFAULT_MAX_DECLARATIONS;
        const { isLocIncluded = true } = options;

        // Stage 1: tokenize
        tokenizer.setSource(raw, 0);

        // Stage 2: bind tokenizer output to preparser context
        initPreparserContext(ctx, raw, tokenizer, baseOffset);

        // Stage 3: preparse — may throw AdblockSyntaxError
        DeclarationListPreparser.preparse(
            ctx,
            0,
            ctx.tokenCount,
            dataOffset,
            maxDeclarations,
        );

        // Stage 4: build AST from preparsed data
        return DeclarationListAstParser.parse(
            raw,
            ctx.data,
            dataOffset,
            maxDeclarations,
            baseOffset,
            baseOffset + raw.length,
            { isLocIncluded },
        );
    }
}
