/**
 * @file Simple comment AST parser.
 *
 * Builds {@link CommentRule} nodes from preparsed data.
 */

import { type CommentRule, CommentRuleType, RuleCategory } from '../../nodes';
import {
    CM_SIMPLE_MARKER_OFFSET,
    CM_SIMPLE_TEXT_END_OFFSET,
    CM_SIMPLE_TEXT_START_OFFSET,
} from '../../preparser/comment/simple';
import { AdblockSyntax } from '../../utils/adblockers';
import { ValueParser } from '../misc/value';
import type { PreparserParseOptions } from '../network/network-rule';

/**
 * Builds {@link CommentRule} AST nodes from preparsed data.
 */
export class SimpleCommentAstParser {
    /**
     * Builds a {@link CommentRule} node from preparsed buffer data.
     *
     * @param source Original source string.
     * @param data Buffer written by `SimpleCommentPreparser.preparse`.
     * @param options Parse options.
     *
     * @returns CommentRule AST node.
     */
    public static parse(source: string, data: Int32Array, options: PreparserParseOptions = {}): CommentRule {
        const markerStart = data[CM_SIMPLE_MARKER_OFFSET];
        const textStart = data[CM_SIMPLE_TEXT_START_OFFSET];
        const textEnd = data[CM_SIMPLE_TEXT_END_OFFSET];

        const marker = ValueParser.parse(source, markerStart, markerStart + 1, options.isLocIncluded ?? false);
        const text = ValueParser.parse(source, textStart, textEnd, options.isLocIncluded ?? false);

        const result: CommentRule = {
            type: CommentRuleType.CommentRule,
            category: RuleCategory.Comment,
            syntax: AdblockSyntax.Common,
            marker,
            text,
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
