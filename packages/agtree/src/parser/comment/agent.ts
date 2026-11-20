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

import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
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
 * Maximum number of agents in one comment rule.
 *
 * Fixed so the limit does not depend on the buffer size left by a previous
 * parse (A06 S-6). 480 records occupy `2 + 480 * 2 = 962` slots, which fits
 * the minimum default `ctx.data` (965 slots). Above the limit the parser threw
 * a misleading "Agent name cannot be empty" error (F-013).
 */
export const MAX_AGENT_COUNT = 480;

/**
 * A filter-list header naming the same agent twice, e.g.
 * `[Adblock Plus 2.0 3.1]`.
 */
const DUPLICATED_VERSIONS_PATTERN = /^Adblock Plus\s+\S+\s+\S+$/;

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

        const ruleStart = startTi > 0 ? ctx.ends[startTi - 1] : ctx.sourceStart;
        const ruleEnd = endTi > 0 && endTi <= ctx.tokenCount ? ctx.ends[endTi - 1] : ruleStart;
        const maxRecords = Math.min(
            MAX_AGENT_COUNT,
            Math.floor((data.length - dataOffset - CM_AGENT_RECORDS_OFFSET) / AGENT_RECORD_STRIDE),
        );

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

            // An empty slot between `;` separators (and therefore an empty
            // list, `[]`) is a syntax error in 4.x; v5 used to drop it and
            // keep the remaining agents (F-028).
            if (agentEnd <= agentStart) {
                throw new AdblockSyntaxError('Agent name cannot be empty', agentStart, ruleEnd);
            }

            if (count >= maxRecords) {
                throw new AdblockSyntaxError(
                    `Agent list exceeds the maximum of ${maxRecords} agents`,
                    ruleStart,
                    ruleEnd,
                );
            }

            const base = dataOffset + CM_AGENT_RECORDS_OFFSET + count * AGENT_RECORD_STRIDE;

            data[base + AGENT_FIELD_START] = agentStart;
            data[base + AGENT_FIELD_END] = agentEnd;
            count += 1;

            // Skip `;` separator
            if (ti < closeTi && ctx.types[ti] === TokenType.Semicolon) {
                ti += 1;
            }
        }

        // A list without any agent, e.g. `[]` or `[ ]`.
        if (count === 0) {
            throw new AdblockSyntaxError('Empty agent list', ruleStart, ruleEnd);
        }

        // `[Adblock Plus <version> <version>]` is a filter-list header with two
        // versions: 4.x rejects it, while v5 kept only the last version and
        // silently dropped the first one (F-028).
        if (count === 1) {
            const agent = ctx.source.slice(
                data[dataOffset + CM_AGENT_RECORDS_OFFSET + AGENT_FIELD_START],
                data[dataOffset + CM_AGENT_RECORDS_OFFSET + AGENT_FIELD_END],
            );
            if (DUPLICATED_VERSIONS_PATTERN.test(agent)) {
                throw new AdblockSyntaxError('Duplicated versions are not allowed', ruleStart, ruleEnd);
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
