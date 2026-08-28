/**
 * @file Agent comment AST parser.
 *
 * Builds {@link AgentCommentRule} nodes from parsed data.
 */

import { getAdblockSyntax } from '../../common/agent-common';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import {
    type Agent,
    type AgentCommentRule,
    CommentRuleType,
    NodeType,
    RuleCategory,
} from '../../nodes';
import {
    AGENT_FIELD_END,
    AGENT_FIELD_START,
    AGENT_RECORD_STRIDE,
    CM_AGENT_COUNT_OFFSET,
    CM_AGENT_RECORDS_OFFSET,
} from '../../parser/comment/agent';
import { CHAR_SPACE, CHAR_TAB } from '../../tokenizer/char-codes';
import { SYNTAX_ALL } from '../../utils/syntax-flags';
import { ValueAstBuilder } from '../misc/value';
import type { ParseOptions } from '../options';

/**
 * Builds {@link AgentCommentRule} AST nodes from parsed data.
 */
export class AgentCommentAstBuilder {
    /**
     * Regex that matches a version token (e.g. `2.0`, `1.16.4`).
     */
    private static readonly VERSION_RE = /\b\d+\.\d+(\.\d+)?\b/;

    /**
     * Parses the agent span `source[start..end]` into an {@link Agent} node.
     *
     * Works directly on the source string without allocating the agent
     * substring. Only the name string is sliced for {@link getAdblockSyntax}.
     *
     * @param source Full source string.
     * @param start Start offset of the agent span (inclusive).
     * @param end End offset of the agent span (exclusive).
     * @param options Parse options.
     *
     * @returns Agent AST node.
     *
     * @throws If the agent name is empty.
     */
    private static parseOneAgent(source: string, start: number, end: number, options: ParseOptions): Agent {
        let offset = start;

        while (
            offset < end
            && (source.charCodeAt(offset) === CHAR_SPACE
                || source.charCodeAt(offset) === CHAR_TAB)
        ) {
            offset += 1;
        }

        const nameStart = offset;
        let nameEnd = offset;
        let versionStart = -1;
        let versionEnd = -1;

        while (offset < end) {
            let wordEnd = offset;
            while (
                wordEnd < end
                && source.charCodeAt(wordEnd) !== CHAR_SPACE
                && source.charCodeAt(wordEnd) !== CHAR_TAB
            ) {
                wordEnd += 1;
            }

            if (AgentCommentAstBuilder.VERSION_RE.test(source.slice(offset, wordEnd))) {
                versionStart = offset;
                versionEnd = wordEnd;
            } else {
                nameEnd = wordEnd;
            }

            offset = wordEnd;
            while (
                offset < end
                && (source.charCodeAt(offset) === CHAR_SPACE
                    || source.charCodeAt(offset) === CHAR_TAB)
            ) {
                offset += 1;
            }
        }

        if (nameEnd === nameStart) {
            throw new AdblockSyntaxError('Agent name cannot be empty', start, end);
        }

        const isLoc = options.isLocIncluded ?? false;
        const name = ValueAstBuilder.parse(source, nameStart, nameEnd, isLoc);
        const syntax = getAdblockSyntax(source.slice(nameStart, nameEnd));

        const result: Agent = { type: NodeType.Agent, adblock: name, syntax };

        if (versionStart !== -1) {
            result.version = ValueAstBuilder.parse(source, versionStart, versionEnd, isLoc);
        }

        if (isLoc) {
            result.start = start;
            result.end = end;
        }

        return result;
    }

    /**
     * Builds an {@link AgentCommentRule} node from parsed buffer data.
     *
     * @param source Original source string.
     * @param data Buffer written by `AgentCommentParser.parse`.
     * @param dataOffset Offset within `data` where the comment header starts.
     * @param options Parse options.
     *
     * @returns AgentCommentRule AST node.
     */
    public static parse(
        source: string,
        data: Int32Array,
        dataOffset = 0,
        options: ParseOptions = {},
    ): AgentCommentRule {
        const count = data[dataOffset + CM_AGENT_COUNT_OFFSET];
        const children: Agent[] = new Array(count);

        for (let i = 0; i < count; i += 1) {
            const base = dataOffset + CM_AGENT_RECORDS_OFFSET + i * AGENT_RECORD_STRIDE;
            const agentStart = data[base + AGENT_FIELD_START];
            const agentEnd = data[base + AGENT_FIELD_END];

            children[i] = AgentCommentAstBuilder.parseOneAgent(source, agentStart, agentEnd, options);
        }

        const result: AgentCommentRule = {
            type: CommentRuleType.AgentCommentRule,
            category: RuleCategory.Comment,
            syntax: SYNTAX_ALL,
            children,
        };

        if (options.isLocIncluded) {
            result.start = 0;
            result.end = source.length;
        }

        return result;
    }
}
