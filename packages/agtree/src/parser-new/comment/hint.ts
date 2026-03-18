/**
 * @file Hint comment AST parser.
 *
 * Builds {@link HintCommentRule} nodes from preparsed data.
 */

import {
    CommentRuleType,
    type Hint,
    type HintCommentRule,
    RuleCategory,
} from '../../nodes';
import { ParameterListParser } from '../../parser/misc/parameter-list-parser';
import {
    CM_HINT_COUNT_OFFSET,
    CM_HINT_RECORDS_OFFSET,
    HINT_FIELD_NAME_END,
    HINT_FIELD_NAME_START,
    HINT_FIELD_PARAMS_END,
    HINT_FIELD_PARAMS_START,
    HINT_RECORD_STRIDE,
} from '../../preparser/comment/hint';
import { AdblockSyntax } from '../../utils/adblockers';
import { COMMA } from '../../utils/constants';
import { ValueParser } from '../misc/value';
import type { PreparserParseOptions } from '../network/network-rule';

/**
 * Builds {@link HintCommentRule} AST nodes from preparsed data.
 */
export class HintCommentAstParser {
    /**
     * Builds a {@link HintCommentRule} node from preparsed buffer data.
     *
     * @param source Original source string.
     * @param data Buffer written by `HintCommentPreparser.preparse`.
     * @param options Parse options.
     *
     * @returns HintCommentRule AST node.
     */
    public static parse(source: string, data: Int32Array, options: PreparserParseOptions = {}): HintCommentRule {
        const count = data[CM_HINT_COUNT_OFFSET];
        const children: Hint[] = new Array(count);

        for (let i = 0; i < count; i += 1) {
            const base = CM_HINT_RECORDS_OFFSET + i * HINT_RECORD_STRIDE;
            const nameStart = data[base + HINT_FIELD_NAME_START];
            const nameEnd = data[base + HINT_FIELD_NAME_END];
            const paramsStart = data[base + HINT_FIELD_PARAMS_START];
            const paramsEnd = data[base + HINT_FIELD_PARAMS_END];

            const name = ValueParser.parse(source, nameStart, nameEnd, options.isLocIncluded ?? false);

            const hint: Hint = {
                type: 'Hint',
                name,
            };

            if (paramsStart !== -1) {
                // paramsStart/paramsEnd include the `(` and `)` characters;
                // pass only the inner content to ParameterListParser.
                const innerStart = paramsStart + 1;
                const innerEnd = paramsEnd - 1;

                hint.params = ParameterListParser.parse(
                    source.slice(innerStart, innerEnd),
                    options,
                    innerStart,
                    COMMA,
                );
            }

            if (options.isLocIncluded) {
                hint.start = nameStart;
                hint.end = paramsStart !== -1 ? paramsEnd : nameEnd;
            }

            children[i] = hint;
        }

        const result: HintCommentRule = {
            type: CommentRuleType.HintCommentRule,
            category: RuleCategory.Comment,
            syntax: AdblockSyntax.Adg,
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
