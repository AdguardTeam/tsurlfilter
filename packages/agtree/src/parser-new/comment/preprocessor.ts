/**
 * @file Preprocessor comment AST parser.
 *
 * Builds {@link PreProcessorCommentRule} nodes from preparsed data.
 */

import { AdblockSyntax } from '../../utils/adblockers';
import { type PreProcessorCommentRule, CommentRuleType, RuleCategory } from '../../nodes';
import {
    CM_PREP_LE_OFFSET,
    CM_PREP_NAME_END,
    CM_PREP_NAME_START,
    CM_PREP_PARAMS_END,
    CM_PREP_PARAMS_START,
} from '../../preparser/comment/types';
import type { PreparserParseOptions } from '../network/network-rule';
import { ValueParser } from '../misc/value';
import { LogicalExpressionAstParser } from '../misc/logical-expression';
import { regionEquals } from '../../preparser/context';

const IF_DIRECTIVE = 'if';

/**
 * Builds {@link PreProcessorCommentRule} AST nodes from preparsed data.
 *
 * For `!#if` directives the `params` field is an `AnyExpressionNode` built
 * from the logical-expression node tree embedded in `data` at
 * {@link CM_PREP_LE_OFFSET} by `PreprocessorCommentPreparser.preparse`.
 * Parameter-list parsing for `!#safari_cb_affinity` is not yet integrated.
 */
export class PreprocessorCommentAstParser {
    /**
     * Builds a {@link PreProcessorCommentRule} node from preparsed buffer data.
     *
     * @param source  Original source string.
     * @param data    Buffer written by `PreprocessorCommentPreparser.preparse`.
     * @param options Parse options.
     * @returns PreProcessorCommentRule AST node.
     */
    static parse(
        source: string,
        data: Int32Array,
        options: PreparserParseOptions = {},
    ): PreProcessorCommentRule {
        const nameStart = data[CM_PREP_NAME_START];
        const nameEnd = data[CM_PREP_NAME_END];
        const paramsStart = data[CM_PREP_PARAMS_START];
        const paramsEnd = data[CM_PREP_PARAMS_END];

        const name = ValueParser.parse(source, nameStart, nameEnd, options.isLocIncluded ?? false);

        const result: PreProcessorCommentRule = {
            type: CommentRuleType.PreProcessorCommentRule,
            category: RuleCategory.Comment,
            syntax: AdblockSyntax.Adg,
            name,
        };

        if (paramsStart !== -1 && paramsStart < paramsEnd) {
            if (regionEquals(source, nameStart, nameEnd, IF_DIRECTIVE)) {
                result.params = LogicalExpressionAstParser.parse(
                    source,
                    data.subarray(CM_PREP_LE_OFFSET),
                    options.isLocIncluded ?? false,
                );
            } else {
                result.params = ValueParser.parse(source, paramsStart, paramsEnd, options.isLocIncluded ?? false);
            }
        }

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
