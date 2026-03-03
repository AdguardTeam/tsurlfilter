/**
 * @file Metadata comment AST parser.
 *
 * Builds {@link MetadataCommentRule} nodes from preparsed data.
 */

import { AdblockSyntax } from '../../utils/adblockers';
import { type MetadataCommentRule, CommentRuleType, RuleCategory } from '../../nodes';
import {
    CM_META_HEADER_END,
    CM_META_HEADER_START,
    CM_META_MARKER,
    CM_META_VALUE_END,
    CM_META_VALUE_START,
} from '../../preparser/comment/types';
import type { PreparserParseOptions } from '../network-rule';
import { ValueParser } from '../value';

/**
 * Builds {@link MetadataCommentRule} AST nodes from preparsed data.
 */
export class MetadataCommentAstParser {
    /**
     * Builds a {@link MetadataCommentRule} node from preparsed buffer data.
     *
     * @param source Original source string.
     * @param data Buffer written by `MetadataCommentPreparser.preparse`.
     * @param options Parse options.
     * @returns MetadataCommentRule AST node.
     */
    static parse(
        source: string,
        data: Int32Array,
        options: PreparserParseOptions = {},
    ): MetadataCommentRule {
        const markerStart = data[CM_META_MARKER];
        const headerStart = data[CM_META_HEADER_START];
        const headerEnd = data[CM_META_HEADER_END];
        const valueStart = data[CM_META_VALUE_START];
        const valueEnd = data[CM_META_VALUE_END];

        const isLoc = options.isLocIncluded ?? false;
        const marker = ValueParser.parse(source, markerStart, markerStart + 1, isLoc);
        const header = ValueParser.parse(source, headerStart, headerEnd, isLoc);
        const value = ValueParser.parse(source, valueStart, valueEnd, isLoc);

        const result: MetadataCommentRule = {
            type: CommentRuleType.MetadataCommentRule,
            category: RuleCategory.Comment,
            syntax: AdblockSyntax.Common,
            marker,
            header,
            value,
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
