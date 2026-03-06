/**
 * @file Comment classifier.
 *
 * Identifies the comment sub-type and dispatches to the appropriate preparser,
 * which fills `ctx.data` with structural indices.
 *
 * Classification order (first match wins):
 *   1. `!#directive`     → Preprocessor
 *   2. `!+`              → Hint
 *   3. `[…]`             → Agent
 *   4. `! Header: value` → Metadata
 *   5. Otherwise         → Simple
 */

import { TokenType } from '../../tokenizer/token-types';
import type { PreparserContext } from '../context';
import { skipWs, tokenStart } from '../context';
import { AgentCommentPreparser } from './agent';
import { HintCommentPreparser } from './hint';
import { matchMetadataHeader, MetadataCommentPreparser } from './metadata';
import { PreprocessorCommentPreparser } from './preprocessor';
import { SimpleCommentPreparser } from './simple';
import { CommentKind } from './types';

export { CommentKind };

/**
 * Zero-allocation comment sub-type classifier.
 *
 * After `RuleClassifier` identifies a rule as `RuleKind.Comment`, call
 * `CommentClassifier.preparse(ctx)` to fill `ctx.data` with the comment's
 * structural indices. Read `ctx.data[0]` to get the `CommentKind`.
 */
export class CommentClassifier {
    /**
     * Identifies the comment sub-type and fills `ctx.data` via the
     * appropriate preparser.
     *
     * @param ctx Preparser context (tokenizer output must be loaded).
     */
    public static preparse(ctx: PreparserContext): void {
        const { types, tokenCount } = ctx;

        const ti = skipWs(ctx, 0);

        if (ti >= tokenCount) {
            SimpleCommentPreparser.preparse(ctx);
            return;
        }

        const t0 = types[ti];

        // Agent: starts with `[` and last significant token is `]`
        if (t0 === TokenType.OpenSquare) {
            let last = tokenCount - 1;

            while (last > ti && types[last] === TokenType.Whitespace) {
                last -= 1;
            }

            if (types[last] === TokenType.CloseSquare) {
                AgentCommentPreparser.preparse(ctx);
                return;
            }
        }

        if (t0 === TokenType.ExclamationMark) {
            const ti2 = ti + 1;

            if (ti2 < tokenCount) {
                const t1 = types[ti2];

                // Preprocessor: `!#`
                if (t1 === TokenType.HashMark) {
                    PreprocessorCommentPreparser.preparse(ctx);
                    return;
                }

                // Hint: `!+`
                if (t1 === TokenType.PlusSign) {
                    HintCommentPreparser.preparse(ctx);
                    return;
                }
            }

            // Determine whether it is Config, Metadata, or Simple by inspecting
            // the text that follows `!` (after optional whitespace).
            const textTi = skipWs(ctx, ti + 1);

            if (textTi < tokenCount) {
                const textOff = tokenStart(ctx, textTi);

                // Metadata: `! Header: value`
                if (matchMetadataHeader(ctx.source, textOff) !== null) {
                    MetadataCommentPreparser.preparse(ctx);
                    return;
                }
            }
        }

        // Metadata: `# Header: value`
        if (t0 === TokenType.HashMark) {
            const textTi = skipWs(ctx, ti + 1);

            if (textTi < tokenCount) {
                const textOff = tokenStart(ctx, textTi);

                if (matchMetadataHeader(ctx.source, textOff) !== null) {
                    MetadataCommentPreparser.preparse(ctx);
                    return;
                }
            }
        }

        // Default: simple comment (`! text` or `# text`)
        SimpleCommentPreparser.preparse(ctx);
    }

    /**
     * Returns the `CommentKind` written into `ctx.data` by `preparse`.
     *
     * @param ctx Preparser context after `preparse` has been called.
     * @returns The comment kind.
     */
    public static kind(ctx: PreparserContext): CommentKind {
        return ctx.data[0] as CommentKind;
    }
}
