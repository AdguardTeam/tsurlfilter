/**
 * @file Metadata comment AST parser.
 *
 * Builds {@link MetadataCommentRule} nodes from parsed data.
 */

import { CommentRuleType, type MetadataCommentRule, RuleCategory } from '../../nodes';
import {
    CM_META_HEADER_END_OFFSET,
    CM_META_HEADER_START_OFFSET,
    CM_META_MARKER_IS_HASH,
    CM_META_MARKER_OFFSET,
    CM_META_VALUE_END_OFFSET,
    CM_META_VALUE_START_OFFSET,
} from '../../parser/comment/metadata';
import {
    SYNTAX_ADG,
    SYNTAX_ALL,
    SYNTAX_UBO,
    type SyntaxFlags,
} from '../../utils/syntax-flags';
import { ValueAstBuilder } from '../misc/value';
import type { ParseOptions } from '../options';

/**
 * Builds {@link MetadataCommentRule} AST nodes from parsed data.
 */
export class MetadataCommentAstBuilder {
    /**
     * Builds a {@link MetadataCommentRule} node from parsed buffer data.
     *
     * @param source Original source string.
     * @param data Buffer written by `MetadataCommentParser.parse`.
     * @param dataOffset Offset within `data` where the comment header starts.
     * @param options Parse options.
     *
     * @returns MetadataCommentRule AST node.
     */
    public static parse(
        source: string,
        data: Int32Array,
        dataOffset = 0,
        options: ParseOptions = {},
    ): MetadataCommentRule {
        const markerStart = data[dataOffset + CM_META_MARKER_OFFSET];
        const headerStart = data[dataOffset + CM_META_HEADER_START_OFFSET];
        const headerEnd = data[dataOffset + CM_META_HEADER_END_OFFSET];
        const valueStart = data[dataOffset + CM_META_VALUE_START_OFFSET];
        const valueEnd = data[dataOffset + CM_META_VALUE_END_OFFSET];

        const isLoc = options.isLocIncluded ?? false;
        const isHash = data[dataOffset + CM_META_MARKER_IS_HASH] === 1;
        const marker = ValueAstBuilder.parse(source, markerStart, markerStart + 1, isLoc);
        const header = ValueAstBuilder.parse(source, headerStart, headerEnd, isLoc);
        const value = ValueAstBuilder.parse(source, valueStart, valueEnd, isLoc);

        const result: MetadataCommentRule = {
            type: CommentRuleType.MetadataCommentRule,
            category: RuleCategory.Comment,
            syntax: isHash ? (SYNTAX_ADG | SYNTAX_UBO) as SyntaxFlags : SYNTAX_ALL,
            marker,
            header,
            value,
        };

        if (options.isLocIncluded) {
            result.start = 0;
            result.end = source.length;
        }

        return result;
    }
}
