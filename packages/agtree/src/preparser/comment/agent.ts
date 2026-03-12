/**
 * @file Agent comment preparser.
 *
 * Handles `[Agent1; Agent2]` rules. Records per-agent name bounds (trimmed)
 * in `ctx.data`.
 *
 * ## Data Layout
 * [0] KIND - CommentKind.Agent
 * [1] COUNT - Number of agents
 * [2+] Per agent (stride=2): START, END (trimmed source offsets, exclusive end)
 */

import { TokenType } from '../../tokenizer/token-types';
import type { PreparserContext } from '../context';
import { lastNonWs, skipWs, tokenStart } from '../context';
import { CM_KIND, CommentKind } from './types';

export const CM_AGENT_COUNT = 1;
export const CM_AGENT_HEADER = 2;
export const CM_AGENT_STRIDE = 2;
export const CM_AGENT_START = 0;
export const CM_AGENT_END = 1;

/**
 * Preparser for adblock agent comment rules (`[Agent1; Agent2]`).
 */
export class AgentCommentPreparser {
    /**
     * Fills `ctx.data` with agent structural indices.
     *
     * Assumes the caller has verified the rule starts with `[` and ends with `]`.
     *
     * @param ctx Preparser context (tokenizer output must be loaded).
     */
    public static preparse(ctx: PreparserContext): void {
        const { data, tokenCount } = ctx;

        // Skip leading whitespace, then `[`
        let ti = skipWs(ctx, 0);

        // skip OpenSquare
        ti += 1;

        // Find the closing bracket token index
        let closeTi = tokenCount - 1;

        while (closeTi > ti && ctx.types[closeTi] !== TokenType.CloseSquare) {
            closeTi -= 1;
        }

        let count = 0;

        while (ti < closeTi) {
            // Skip whitespace before the agent name
            ti = skipWs(ctx, ti);

            if (ti >= closeTi) {
                break;
            }

            const agentTi = ti;
            const agentStart = tokenStart(ctx, ti);

            // Consume until `;` or closing `]` boundary
            while (ti < closeTi && ctx.types[ti] !== TokenType.Semicolon) {
                ti += 1;
            }

            // Trim trailing whitespace using the last non-whitespace token
            const lastTi = lastNonWs(ctx, agentTi, ti);
            const agentEnd = lastTi >= 0 ? ctx.ends[lastTi] : agentStart;

            // Record the agent if non-empty
            if (agentEnd > agentStart) {
                const base = CM_AGENT_HEADER + count * CM_AGENT_STRIDE;

                data[base + CM_AGENT_START] = agentStart;
                data[base + CM_AGENT_END] = agentEnd;
                count += 1;
            }

            // Skip `;` separator
            if (ti < closeTi && ctx.types[ti] === TokenType.Semicolon) {
                ti += 1;
            }
        }

        data[CM_KIND] = CommentKind.Agent;
        data[CM_AGENT_COUNT] = count;
    }

    /**
     * Returns the number of agents recorded in the buffer.
     *
     * @param data Buffer written by `preparse`.
     * @returns Agent count.
     */
    public static count(data: Int32Array): number {
        return data[CM_AGENT_COUNT];
    }

    /**
     * Returns the source start of the agent name at index `i`.
     *
     * @param data Buffer written by `preparse`.
     * @param i Agent index (0-based).
     * @returns Source start offset of the agent name.
     */
    public static agentStart(data: Int32Array, i: number): number {
        return data[CM_AGENT_HEADER + i * CM_AGENT_STRIDE + CM_AGENT_START];
    }

    /**
     * Returns the exclusive source end of the agent name at index `i`.
     *
     * @param data Buffer written by `preparse`.
     * @param i Agent index (0-based).
     * @returns Source end offset of the agent name.
     */
    public static agentEnd(data: Int32Array, i: number): number {
        return data[CM_AGENT_HEADER + i * CM_AGENT_STRIDE + CM_AGENT_END];
    }
}
