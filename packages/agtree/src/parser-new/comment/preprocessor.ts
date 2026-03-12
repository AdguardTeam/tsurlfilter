/**
 * @file Preprocessor comment AST parser.
 *
 * Builds {@link PreProcessorCommentRule} nodes from preparsed data.
 */

import { AdblockSyntax } from '../../utils/adblockers';
import { type PreProcessorCommentRule, CommentRuleType, RuleCategory } from '../../nodes';
import {
    CM_PREP_LE_DATA_OFFSET,
    CM_PREP_NAME_START_OFFSET,
    CM_PREP_NAME_END_OFFSET,
    CM_PREP_PARAMS_START_OFFSET,
    CM_PREP_PARAMS_END_OFFSET,
    CM_PREP_PL_DATA_OFFSET,
} from '../../preparser/comment/preprocessor';
import type { PreparserParseOptions } from '../network/network-rule';
import { ValueParser } from '../misc/value';
import { LogicalExpressionAstParser } from '../misc/logical-expression';
import { ParameterListAstParser } from '../misc/parameter-list';
import { regionEquals } from '../../preparser/context';

const IF_DIRECTIVE = 'if';
const SAFARI_CB_AFFINITY_DIRECTIVE = 'safari_cb_affinity';

/**
 * Builds {@link PreProcessorCommentRule} AST nodes from preparsed data.
 *
 * For `!#if` directives the `params` field is an `AnyExpressionNode` built
 * from the logical-expression node tree embedded in `data` at
 * {@link CM_PREP_LE_DATA_OFFSET} by `PreprocessorCommentPreparser.preparse`.
 * For `!#safari_cb_affinity` the `params` field is a `ParameterList` built
 * from the parameter-list buffer embedded at {@link CM_PREP_PL_DATA_OFFSET}.
 */
export class PreprocessorCommentAstParser {
    /**
     * Builds a {@link PreProcessorCommentRule} node from preparsed buffer data.
     *
     * @param source Original source string.
     * @param data Buffer written by `PreprocessorCommentPreparser.preparse`.
     * @param options Parse options.
     * @returns PreProcessorCommentRule AST node.
     */
    static parse(
        source: string,
        data: Int32Array,
        options: PreparserParseOptions = {},
    ): PreProcessorCommentRule {
        const nameStart = data[CM_PREP_NAME_START_OFFSET];
        const nameEnd = data[CM_PREP_NAME_END_OFFSET];
        const paramsStart = data[CM_PREP_PARAMS_START_OFFSET];
        const paramsEnd = data[CM_PREP_PARAMS_END_OFFSET];

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
                    data.subarray(CM_PREP_LE_DATA_OFFSET),
                    options.isLocIncluded ?? false,
                );
            } else if (regionEquals(source, nameStart, nameEnd, SAFARI_CB_AFFINITY_DIRECTIVE)) {
                const plBuf = data.subarray(CM_PREP_PL_DATA_OFFSET);

                if (plBuf[0] >= 0 || plBuf[1] !== -1) {
                    result.params = ParameterListAstParser.parse(
                        source,
                        plBuf,
                        options.isLocIncluded ?? false,
                    );
                } else {
                    result.params = ValueParser.parse(source, paramsStart, paramsEnd, options.isLocIncluded ?? false);
                }
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
