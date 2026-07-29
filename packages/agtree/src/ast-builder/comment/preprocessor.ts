/**
 * @file Preprocessor comment AST parser.
 *
 * Builds {@link PreProcessorCommentRule} nodes from parsed data.
 */

import { CommentRuleType, type PreProcessorCommentRule, RuleCategory } from '../../nodes';
import {
    CM_PREP_LE_DATA_OFFSET,
    CM_PREP_NAME_END_OFFSET,
    CM_PREP_NAME_START_OFFSET,
    CM_PREP_PARAMS_END_OFFSET,
    CM_PREP_PARAMS_START_OFFSET,
    CM_PREP_PL_DATA_OFFSET,
} from '../../parser/comment/preprocessor';
import { regionEquals } from '../../parser/context';
import { SYNTAX_ADG, SYNTAX_UBO, type SyntaxFlags } from '../../utils/syntax-flags';
import { LogicalExpressionAstBuilder } from '../misc/logical-expression';
import { ParameterListAstBuilder } from '../misc/parameter-list';
import { ValueAstBuilder } from '../misc/value';
import type { ParseOptions } from '../options';

const IF_DIRECTIVE = 'if';
const SAFARI_CB_AFFINITY_DIRECTIVE = 'safari_cb_affinity';

/**
 * Explicit compatibility table for preprocessor directives.
 *
 * Maps directive names to their syntax bitflags. Directives not in this table
 * default to `SYNTAX_ADG | SYNTAX_UBO` since the `!#` prefix itself is only
 * recognized by AdGuard and uBlock Origin.
 *
 * @see https://adguard.com/kb/general/ad-filtering/create-own-filters/#pre-processor-directives
 * @see https://github.com/nickspaargaren/no-google/wiki/AdGuard-Specific-Syntax#pre-processor-directives
 */
const DIRECTIVE_SYNTAX: ReadonlyMap<string, SyntaxFlags> = new Map([
    // Conditional compilation — both ADG and UBO
    ['if', (SYNTAX_ADG | SYNTAX_UBO) as SyntaxFlags],
    ['else', (SYNTAX_ADG | SYNTAX_UBO) as SyntaxFlags],
    ['endif', (SYNTAX_ADG | SYNTAX_UBO) as SyntaxFlags],

    // File inclusion — both ADG and UBO
    ['include', (SYNTAX_ADG | SYNTAX_UBO) as SyntaxFlags],

    // AdGuard-only directives
    ['safari_cb_affinity', SYNTAX_ADG],
]);

/**
 * Builds {@link PreProcessorCommentRule} AST nodes from parsed data.
 *
 * For `!#if` directives the `params` field is an `AnyExpressionNode` built
 * from the logical-expression node tree embedded in `data` at
 * {@link CM_PREP_LE_DATA_OFFSET} by `PreprocessorCommentParser.parse`.
 * For `!#safari_cb_affinity` the `params` field is a `ParameterList` built
 * from the parameter-list buffer embedded at {@link CM_PREP_PL_DATA_OFFSET}.
 */
export class PreprocessorCommentAstBuilder {
    /**
     * Builds a {@link PreProcessorCommentRule} node from parsed buffer data.
     *
     * @param source Original source string.
     * @param data Buffer written by `PreprocessorCommentParser.parse`.
     * @param dataOffset Offset within `data` where the comment header starts.
     * @param options Parse options.
     *
     * @returns PreProcessorCommentRule AST node.
     */
    public static parse(
        source: string,
        data: Int32Array,
        dataOffset = 0,
        options: ParseOptions = {},
    ): PreProcessorCommentRule {
        const nameStart = data[dataOffset + CM_PREP_NAME_START_OFFSET];
        const nameEnd = data[dataOffset + CM_PREP_NAME_END_OFFSET];
        const paramsStart = data[dataOffset + CM_PREP_PARAMS_START_OFFSET];
        const paramsEnd = data[dataOffset + CM_PREP_PARAMS_END_OFFSET];

        const name = ValueAstBuilder.parse(source, nameStart, nameEnd, options.isLocIncluded ?? false);

        // Look up directive syntax from the explicit compatibility table.
        // Default to ADG | UBO for any directive not in the table, since the
        // `!#` prefix itself is only recognized by AdGuard and uBlock Origin.
        const directiveName = source.slice(nameStart, nameEnd);
        const syntax: SyntaxFlags = DIRECTIVE_SYNTAX.get(directiveName)
            ?? (SYNTAX_ADG | SYNTAX_UBO) as SyntaxFlags;

        const result: PreProcessorCommentRule = {
            type: CommentRuleType.PreProcessorCommentRule,
            category: RuleCategory.Comment,
            syntax,
            name,
        };

        if (paramsStart !== -1 && paramsStart < paramsEnd) {
            if (regionEquals(source, nameStart, nameEnd, IF_DIRECTIVE)) {
                result.params = LogicalExpressionAstBuilder.parse(
                    source,
                    data.subarray(dataOffset + CM_PREP_LE_DATA_OFFSET),
                    options.isLocIncluded ?? false,
                );
            } else if (regionEquals(source, nameStart, nameEnd, SAFARI_CB_AFFINITY_DIRECTIVE)) {
                const plBuf = data.subarray(dataOffset + CM_PREP_PL_DATA_OFFSET);

                if (plBuf[0] >= 0 || plBuf[1] !== -1) {
                    result.params = ParameterListAstBuilder.parse(
                        source,
                        plBuf,
                        options.isLocIncluded ?? false,
                    );
                } else {
                    // eslint-disable-next-line max-len
                    result.params = ValueAstBuilder.parse(source, paramsStart, paramsEnd, options.isLocIncluded ?? false);
                }
            } else {
                // eslint-disable-next-line max-len
                result.params = ValueAstBuilder.parse(source, paramsStart, paramsEnd, options.isLocIncluded ?? false);
            }
        }

        if (options.isLocIncluded) {
            result.start = 0;
            result.end = source.length;
        }

        return result;
    }
}
