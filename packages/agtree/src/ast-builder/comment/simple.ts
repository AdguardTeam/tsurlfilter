/**
 * @file Simple comment AST parser.
 *
 * Builds {@link CommentRule} nodes from parsed data.
 */

import { type CommentRule, CommentRuleType, RuleCategory } from '../../nodes-new';
import {
    CM_SIMPLE_MARKER_OFFSET,
    CM_SIMPLE_TEXT_END_OFFSET,
    CM_SIMPLE_TEXT_START_OFFSET,
} from '../../parser/comment/simple';
import { AdblockSyntax } from '../../utils/adblockers';
import { ValueAstBuilder } from '../misc/value';
import type { ParseOptions } from '../options';

/**
 * Builds {@link CommentRule} AST nodes from parsed data.
 */
export class SimpleCommentAstBuilder {
    /**
     * Builds a {@link CommentRule} node from parsed buffer data.
     *
     * @param source Original source string.
     * @param data Buffer written by `SimpleCommentParser.parse`.
     * @param dataOffset Offset within `data` where the comment header starts.
     * @param options Parse options.
     *
     * @returns CommentRule AST node.
     */
    public static parse(
        source: string,
        data: Int32Array,
        dataOffset = 0,
        options: ParseOptions = {},
    ): CommentRule {
        const markerStart = data[dataOffset + CM_SIMPLE_MARKER_OFFSET];
        const textStart = data[dataOffset + CM_SIMPLE_TEXT_START_OFFSET];
        const textEnd = data[dataOffset + CM_SIMPLE_TEXT_END_OFFSET];

        const marker = ValueAstBuilder.parse(source, markerStart, markerStart + 1, options.isLocIncluded ?? false);
        const text = ValueAstBuilder.parse(source, textStart, textEnd, options.isLocIncluded ?? false);

        const result: CommentRule = {
            type: CommentRuleType.CommentRule,
            category: RuleCategory.Comment,
            syntax: AdblockSyntax.Common,
            marker,
            text,
        };

        if (options.isLocIncluded) {
            result.start = 0;
            result.end = source.length;
        }

        return result;
    }
}
