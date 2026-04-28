/**
 * @file Comment classifier.
 *
 * Identifies the comment sub-type and dispatches to the appropriate parser,
 * which fills `ctx.data` with structural indices.
 *
 * Classification order (first match wins):
 *   1. `!#directive`     → Preprocessor
 *   2. `!+`              → Hint
 *   3. `[…]`             → Agent
 *   4. `! Header: value` → Metadata
 *   5. Otherwise         → Simple.
 */

import { TokenType } from '../../tokenizer/token-types';
import type { ParserContext } from '../context';
import { skipWs, skipWsBack, tokenStart } from '../context';
import { LE_BUFFER_SIZE } from '../misc/logical-expression';

import { AgentCommentParser } from './agent';
import { HintCommentParser } from './hint';
import { matchMetadataHeader, MetadataCommentParser } from './metadata';
import { CM_PREP_LE_DATA_OFFSET, PreprocessorCommentParser } from './preprocessor';
import { SimpleCommentParser } from './simple';
import { CommentKind } from './types';

export { CommentKind };

/**
 * Zero-allocation comment sub-type classifier.
 *
 * After `RuleClassifier` identifies a rule as `RuleKind.Comment`, call
 * `CommentParser.parse(ctx)` to fill `ctx.data` with the comment's
 * structural indices. Read `ctx.data[0]` to get the `CommentKind`.
 */
export class CommentParser {
    /**
     * Minimum `ctx.data` slots required by this classifier (and any comment
     * sub-parser it dispatches to) with the default capacity.
     *
     * The preprocessor parser embeds a logical-expression node tree at
     * `CM_PREP_LE_DATA_OFFSET`; that sub-buffer is the largest among all
     * comment types:
     *   CM_PREP_LE_DATA_OFFSET(5) + LE_BUFFER_SIZE(162) = 167.
     */
    public static readonly MIN_DATA_SLOTS = CM_PREP_LE_DATA_OFFSET + LE_BUFFER_SIZE;

    /**
     * Identifies the comment sub-type and fills `ctx.data` via the
     * appropriate parser.
     *
     * @param ctx Parser context (tokenizer output must be loaded).
     * @param startTi Inclusive start token index. Defaults to 0.
     * @param endTi Exclusive end token index. Defaults to ctx.tokenCount.
     * @param dataOffset Offset within ctx.data to write output. Defaults to 0.
     */
    public static parse(ctx: ParserContext, startTi = 0, endTi = ctx.tokenCount, dataOffset = 0): void {
        const { types } = ctx;

        const ti = skipWs(ctx, startTi);

        if (ti >= endTi) {
            SimpleCommentParser.parse(ctx, startTi, endTi, dataOffset);
            return;
        }

        const t0 = types[ti];

        // Agent: starts with `[` and last significant token is `]`
        if (t0 === TokenType.OpenSquare) {
            const last = skipWsBack(ctx, endTi - 1, ti + 1);

            if (types[last] === TokenType.CloseSquare) {
                AgentCommentParser.parse(ctx, startTi, endTi, dataOffset);
                return;
            }
        }

        if (t0 === TokenType.ExclamationMark) {
            const ti2 = ti + 1;

            if (ti2 < endTi) {
                const t1 = types[ti2];

                // Preprocessor: `!#`
                if (t1 === TokenType.HashMark) {
                    PreprocessorCommentParser.parse(ctx, startTi, endTi, dataOffset);
                    return;
                }

                // Hint: `!+`
                if (t1 === TokenType.PlusSign) {
                    HintCommentParser.parse(ctx, startTi, endTi, dataOffset);
                    return;
                }
            }

            // Determine whether it is Config, Metadata, or Simple by inspecting
            // the text that follows `!` (after optional whitespace).
            const textTi = skipWs(ctx, ti + 1);

            if (textTi < endTi) {
                const textOff = tokenStart(ctx, textTi);

                // Metadata: `! Header: value`
                if (matchMetadataHeader(ctx.source, textOff) !== null) {
                    MetadataCommentParser.parse(ctx, startTi, endTi, dataOffset);
                    return;
                }
            }
        }

        // Metadata: `# Header: value`
        if (t0 === TokenType.HashMark) {
            const textTi = skipWs(ctx, ti + 1);

            if (textTi < endTi) {
                const textOff = tokenStart(ctx, textTi);

                if (matchMetadataHeader(ctx.source, textOff) !== null) {
                    MetadataCommentParser.parse(ctx, startTi, endTi, dataOffset);
                    return;
                }
            }
        }

        // Default: simple comment (`! text` or `# text`)
        SimpleCommentParser.parse(ctx, startTi, endTi, dataOffset);
    }

    /**
     * Returns the `CommentKind` written into `ctx.data` by `parse`.
     *
     * @param ctx Parser context after `parse` has been called.
     *
     * @returns The comment kind.
     */
    public static kind(ctx: ParserContext): CommentKind {
        return ctx.data[0] as CommentKind;
    }
}
