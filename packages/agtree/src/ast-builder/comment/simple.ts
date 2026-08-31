/**
 * @file Simple comment AST parser.
 *
 * Builds {@link CommentRule} nodes from parsed data.
 */

import { type CommentRule, CommentRuleType, RuleCategory } from '../../nodes';
import {
    CM_SIMPLE_MARKER_IS_HASH,
    CM_SIMPLE_MARKER_OFFSET,
    CM_SIMPLE_TEXT_END_OFFSET,
    CM_SIMPLE_TEXT_START_OFFSET,
} from '../../parser/comment/simple';
import { SPACE } from '../../utils/constants';
import {
    SYNTAX_ADG,
    SYNTAX_ALL,
    SYNTAX_UBO,
    type SyntaxFlags,
} from '../../utils/syntax-flags';
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
        const isHash = data[dataOffset + CM_SIMPLE_MARKER_IS_HASH] === 1;

        const marker = ValueAstBuilder.parse(source, markerStart, markerStart + 1, options.isLocIncluded ?? false);
        const text = ValueAstBuilder.parse(source, textStart, textEnd, options.isLocIncluded ?? false);

        const result: CommentRule = {
            type: CommentRuleType.CommentRule,
            category: RuleCategory.Comment,
            syntax: isHash ? (SYNTAX_ADG | SYNTAX_UBO) as SyntaxFlags : SYNTAX_ALL,
            marker,
            text,
        };

        // Preserve the original marker-to-text whitespace when it deviates from a
        // single space (the generator's default). The structural parser trims this
        // gap off the text bounds, so without this the spacing would be lost and
        // `#comment` / `# comment` would become indistinguishable.
        const markerSpacing = source.slice(markerStart + 1, textStart);
        if (markerSpacing !== SPACE) {
            result.markerSpacing = markerSpacing;
        }

        if (options.isLocIncluded) {
            result.start = 0;
            result.end = source.length;
        }

        return result;
    }
}
