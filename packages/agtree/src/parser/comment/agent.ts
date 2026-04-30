/**
 * @file Agent comment parser.
 *
 * Handles `[Agent1; Agent2]` rules. Records per-agent name bounds (trimmed)
 * in `ctx.data`.
 *
 * ## Data Layout
 * [0] KIND - CommentKind.Agent
 * [1] COUNT - Number of agents
 * [2+] Per agent (stride=2): START, END (trimmed source offsets, exclusive end).
 */

import { TokenType } from '../../tokenizer/token-types';
import type { ParserContext } from '../context';
import { lastNonWs, skipWs, tokenStart } from '../context';
import type { StructuralParser } from '../types';

import { CM_KIND, CommentKind } from './types';

/**
 * Buffer offset: number of agents in the rule.
 */
export const CM_AGENT_COUNT_OFFSET = 1;

/**
 * Buffer offset: where agent records begin.
 */
export const CM_AGENT_RECORDS_OFFSET = 2;

/**
 * Record size: number of Int32Array slots per agent.
 */
export const AGENT_RECORD_STRIDE = 2;

/**
 * Record field: start offset of agent name.
 */
export const AGENT_FIELD_START = 0;

/**
 * Record field: end offset of agent name.
 */
export const AGENT_FIELD_END = 1;

/**
 * Parser for adblock agent comment rules (`[Agent1; Agent2]`).
 */
export class AgentCommentParser implements StructuralParser {
    /**
     * Fills `ctx.data` with agent structural indices.
     *
     * Assumes the caller has verified the rule starts with `[` and ends with `]`.
     *
     * @param ctx Parser context (tokenizer output must be loaded).
     * @param startTi Inclusive start token index. Defaults to 0.
     * @param endTi Exclusive end token index. Defaults to ctx.tokenCount.
     * @param dataOffset Offset within ctx.data to write output. Defaults to 0.
     */
    public static parse(ctx: ParserContext, startTi = 0, endTi = ctx.tokenCount, dataOffset = 0): void {
        const { data } = ctx;

        // Skip leading whitespace, then `[`
        let ti = skipWs(ctx, startTi);

        // skip OpenSquare
        ti += 1;

        // Find the closing bracket token index
        let closeTi = endTi - 1;

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
                const base = dataOffset + CM_AGENT_RECORDS_OFFSET + count * AGENT_RECORD_STRIDE;

                data[base + AGENT_FIELD_START] = agentStart;
                data[base + AGENT_FIELD_END] = agentEnd;
                count += 1;
            }

            // Skip `;` separator
            if (ti < closeTi && ctx.types[ti] === TokenType.Semicolon) {
                ti += 1;
            }
        }

        data[dataOffset + CM_KIND] = CommentKind.Agent;
        data[dataOffset + CM_AGENT_COUNT_OFFSET] = count;
    }

    /**
     * Returns the number of agents recorded in the buffer.
     *
     * @param data Buffer written by `parse`.
     *
     * @returns Agent count.
     */
    public static count(data: Int32Array): number {
        return data[CM_AGENT_COUNT_OFFSET];
    }

    /**
     * Returns the source start of the agent name at index `i`.
     *
     * @param data Buffer written by `parse`.
     * @param i Agent index (0-based).
     *
     * @returns Source start offset of the agent name.
     */
    public static agentStart(data: Int32Array, i: number): number {
        return data[CM_AGENT_RECORDS_OFFSET + i * AGENT_RECORD_STRIDE + AGENT_FIELD_START];
    }

    /**
     * Returns the exclusive source end of the agent name at index `i`.
     *
     * @param data Buffer written by `parse`.
     * @param i Agent index (0-based).
     *
     * @returns Source end offset of the agent name.
     */
    public static agentEnd(data: Int32Array, i: number): number {
        return data[CM_AGENT_RECORDS_OFFSET + i * AGENT_RECORD_STRIDE + AGENT_FIELD_END];
    }
}
