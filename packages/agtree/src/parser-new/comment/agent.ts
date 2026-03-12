/**
 * @file Agent comment AST parser.
 *
 * Builds {@link AgentCommentRule} nodes from preparsed data.
 */

import {
    type Agent,
    type AgentCommentRule,
    CommentRuleType,
    RuleCategory,
} from '../../nodes';
import { AdblockSyntax } from '../../utils/adblockers';
import {
    CM_AGENT_COUNT_OFFSET,
    CM_AGENT_RECORDS_OFFSET,
    AGENT_RECORD_STRIDE,
    AGENT_FIELD_START,
    AGENT_FIELD_END,
} from '../../preparser/comment/agent';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { getAdblockSyntax } from '../../common/agent-common';
import type { PreparserParseOptions } from '../network/network-rule';
import { ValueParser } from '../misc/value';
import { CHAR_SPACE, CHAR_TAB } from '../../tokenizer/char-codes';

/**
 * Builds {@link AgentCommentRule} AST nodes from preparsed data.
 */
export class AgentCommentAstParser {
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
     * @returns Agent AST node.
     * @throws {AdblockSyntaxError} If the agent name is empty.
     */
    private static parseOneAgent(source: string, start: number, end: number, options: PreparserParseOptions): Agent {
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

            if (AgentCommentAstParser.VERSION_RE.test(source.slice(offset, wordEnd))) {
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
        const name = ValueParser.parse(source, nameStart, nameEnd, isLoc);
        const syntax = getAdblockSyntax(source.slice(nameStart, nameEnd));

        const result: Agent = { type: 'Agent', adblock: name, syntax };

        if (versionStart !== -1) {
            result.version = ValueParser.parse(source, versionStart, versionEnd, isLoc);
        }

        if (isLoc) {
            result.start = start;
            result.end = end;
        }

        return result;
    }

    /**
     * Builds an {@link AgentCommentRule} node from preparsed buffer data.
     *
     * @param source Original source string.
     * @param data Buffer written by `AgentCommentPreparser.preparse`.
     * @param options Parse options.
     * @returns AgentCommentRule AST node.
     */
    static parse(source: string, data: Int32Array, options: PreparserParseOptions = {}): AgentCommentRule {
        const count = data[CM_AGENT_COUNT_OFFSET];
        const children: Agent[] = new Array(count);

        for (let i = 0; i < count; i += 1) {
            const base = CM_AGENT_RECORDS_OFFSET + i * AGENT_RECORD_STRIDE;
            const agentStart = data[base + AGENT_FIELD_START];
            const agentEnd = data[base + AGENT_FIELD_END];

            children[i] = AgentCommentAstParser.parseOneAgent(source, agentStart, agentEnd, options);
        }

        const result: AgentCommentRule = {
            type: CommentRuleType.AgentCommentRule,
            category: RuleCategory.Comment,
            syntax: AdblockSyntax.Common,
            children,
        };

        if (options.includeRaws) {
            result.raws = { text: source };
        }

        if (options.isLocIncluded) {
            result.start = 0;
            result.end = source.length;
        }

        return result;
    }
}
