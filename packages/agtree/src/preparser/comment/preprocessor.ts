/**
 * @file Preprocessor comment preparser.
 *
 * Handles `!#directive[ params]` rules. Records the directive name bounds and
 * optional parameter bounds in `ctx.data`.
 *
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#pre-processor-directives}
 */

import { TokenType } from '../../tokenizer/token-types';
import type { PreparserContext } from '../context';
import {
    lastNonWs,
    regionEquals,
    skipWs,
    tokenStart,
} from '../context';
import { LogicalExpressionPreparser } from '../misc/logical-expression';
import { ParameterListPreparser } from '../misc/parameter-list';
import {
    CM_KIND,
    CM_PREP_LE_OFFSET,
    CM_PREP_NAME_END,
    CM_PREP_NAME_START,
    CM_PREP_PARAMS_END,
    CM_PREP_PARAMS_START,
    CM_PREP_PL_OFFSET,
    CommentKind,
} from './types';

const IF_DIRECTIVE = 'if';
const SAFARI_CB_AFFINITY_DIRECTIVE = 'safari_cb_affinity';

/**
 * Preparser for preprocessor comment rules (`!#directive[ params]`).
 */
export class PreprocessorCommentPreparser {
    /**
     * Fills `ctx.data` with preprocessor structural indices.
     *
     * Assumes the caller has verified the rule starts with `!#`.
     *
     * When the directive is `if`, also writes the flat logical-expression node
     * tree into `ctx.data` starting at {@link CM_PREP_LE_OFFSET} via
     * {@link LogicalExpressionPreparser.preparse}.
     *
     * @param ctx Preparser context (tokenizer output must be loaded).
     */
    public static preparse(ctx: PreparserContext): void {
        const { data } = ctx;

        // Skip leading whitespace, then `!` (ExclamationMark), then `#` (HashMark)
        let ti = skipWs(ctx, 0);
        ti += 2; // skip ! and #

        // Skip optional whitespace after `!#` (tolerant parsing)
        ti = skipWs(ctx, ti);

        // Directive name starts here
        const nameStart = tokenStart(ctx, ti);

        // Consume name tokens: stop at whitespace, OpenParen, or end
        while (
            ti < ctx.tokenCount
            && ctx.types[ti] !== TokenType.Whitespace
            && ctx.types[ti] !== TokenType.OpenParen
        ) {
            ti += 1;
        }

        const nameEnd = ti > 0 ? ctx.ends[ti - 1] : nameStart;

        // Skip optional whitespace after directive name
        ti = skipWs(ctx, ti);

        // Check for parameters (rest of the line after the name, trimmed)
        let paramsStart = -1;
        let paramsEnd = -1;

        if (ti < ctx.tokenCount) {
            paramsStart = tokenStart(ctx, ti);
            const lastTi = lastNonWs(ctx, ti, ctx.tokenCount);
            paramsEnd = lastTi >= 0 ? ctx.ends[lastTi] : paramsStart;

            const paramEndTi = lastTi >= 0 ? lastTi + 1 : ti;

            if (regionEquals(ctx.source, nameStart, nameEnd, IF_DIRECTIVE)) {
                LogicalExpressionPreparser.preparse(ctx, ti, paramEndTi, ctx.data.subarray(CM_PREP_LE_OFFSET));
            } else if (regionEquals(ctx.source, nameStart, nameEnd, SAFARI_CB_AFFINITY_DIRECTIVE)) {
                if (ctx.types[ti] === TokenType.OpenParen) {
                    const listStart = ctx.ends[ti]; // source position right after `(`
                    let closeTi = ti + 1;
                    while (closeTi < paramEndTi && ctx.types[closeTi] !== TokenType.CloseParen) {
                        closeTi += 1;
                    }
                    const listEnd = closeTi < paramEndTi ? tokenStart(ctx, closeTi) : listStart;
                    ParameterListPreparser.preparse(
                        ctx,
                        ti + 1,
                        closeTi,
                        listStart,
                        listEnd,
                        ctx.data.subarray(CM_PREP_PL_OFFSET),
                    );
                }
            }
        }

        data[CM_KIND] = CommentKind.Preprocessor;
        data[CM_PREP_NAME_START] = nameStart;
        data[CM_PREP_NAME_END] = nameEnd;
        data[CM_PREP_PARAMS_START] = paramsStart;
        data[CM_PREP_PARAMS_END] = paramsEnd;
    }

    /**
     * Returns the source start of the directive name.
     *
     * @param data Buffer written by `preparse`.
     * @returns Source start offset of the name.
     */
    public static nameStart(data: Int32Array): number {
        return data[CM_PREP_NAME_START];
    }

    /**
     * Returns the exclusive source end of the directive name.
     *
     * @param data Buffer written by `preparse`.
     * @returns Source end offset of the name.
     */
    public static nameEnd(data: Int32Array): number {
        return data[CM_PREP_NAME_END];
    }

    /**
     * Returns the source start of the directive parameters, or `-1` if absent.
     *
     * @param data Buffer written by `preparse`.
     * @returns Source start offset of the parameters, or `-1`.
     */
    public static paramsStart(data: Int32Array): number {
        return data[CM_PREP_PARAMS_START];
    }

    /**
     * Returns the exclusive source end of the directive parameters, or `-1` if absent.
     *
     * @param data Buffer written by `preparse`.
     * @returns Source end offset of the parameters, or `-1`.
     */
    public static paramsEnd(data: Int32Array): number {
        return data[CM_PREP_PARAMS_END];
    }
}
