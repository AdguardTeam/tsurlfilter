/**
 * @file Hint comment AST parser.
 *
 * Builds {@link HintCommentRule} nodes from parsed data.
 */

import {
    CommentRuleType,
    type Hint,
    type HintCommentRule,
    NodeType,
    type ParameterList,
    RuleCategory,
} from '../../nodes';
import {
    CM_HINT_COUNT_OFFSET,
    CM_HINT_RECORDS_OFFSET,
    HINT_FIELD_NAME_END,
    HINT_FIELD_NAME_START,
    HINT_FIELD_PARAMS_END,
    HINT_FIELD_PARAMS_START,
    HINT_RECORD_STRIDE,
} from '../../parser/comment/hint';
import { createParserContext, initParserContext } from '../../parser/context';
import { ParameterListParser as ParameterListStage2Parser, PL_BUFFER_SIZE } from '../../parser/misc/parameter-list';
import { Tokenizer } from '../../tokenizer/tokenizer';
import { SYNTAX_ADG } from '../../utils/syntax-flags';
import { ParameterListAstBuilder } from '../misc/parameter-list';
import { ValueAstBuilder } from '../misc/value';
import type { ParseOptions } from '../options';

/**
 * Default token capacity for parameter list tokenization.
 */
const PL_TOKEN_CAPACITY = 1024;

/**
 * Reusable tokenizer for parameter list parsing.
 */
const plTokenizer = new Tokenizer(PL_TOKEN_CAPACITY);

/**
 * Reusable parser context for parameter list parsing.
 */
const plCtx = createParserContext();

/**
 * Reusable output buffer for parameter list parsing.
 */
const plBuf = new Int32Array(PL_BUFFER_SIZE);

/**
 * Parses a parenthesised, comma-separated parameter list from a source string.
 *
 * @param source Original source string.
 * @param paramsStart Source offset of the opening `(` (inclusive).
 * @param paramsEnd Source offset just past the closing `)` (exclusive).
 * @param isLocIncluded Whether to attach source locations to AST nodes.
 *
 * @returns ParameterList AST node.
 */
function parseParameterList(
    source: string,
    paramsStart: number,
    paramsEnd: number,
    isLocIncluded: boolean,
): ParameterList {
    const innerStart = paramsStart + 1;
    const innerEnd = paramsEnd - 1;

    plTokenizer.setSource(source, innerStart);
    initParserContext(plCtx, source, plTokenizer, innerStart);

    const { tokenCount } = plTokenizer;
    let closeParenTi = 0;
    while (closeParenTi < tokenCount && plTokenizer.ends[closeParenTi] < paramsEnd) {
        closeParenTi += 1;
    }

    ParameterListStage2Parser.parse(plCtx, 0, closeParenTi, innerStart, innerEnd, plBuf);

    return ParameterListAstBuilder.parse(source, plBuf, isLocIncluded);
}

/**
 * Builds {@link HintCommentRule} AST nodes from parsed data.
 */
export class HintCommentAstBuilder {
    /**
     * Builds a {@link HintCommentRule} node from parsed buffer data.
     *
     * @param source Original source string.
     * @param data Buffer written by `HintCommentParser.parse`.
     * @param dataOffset Offset within `data` where the comment header starts.
     * @param options Parse options.
     *
     * @returns HintCommentRule AST node.
     */
    public static parse(
        source: string,
        data: Int32Array,
        dataOffset = 0,
        options: ParseOptions = {},
    ): HintCommentRule {
        const count = data[dataOffset + CM_HINT_COUNT_OFFSET];
        const children: Hint[] = new Array(count);

        for (let i = 0; i < count; i += 1) {
            const base = dataOffset + CM_HINT_RECORDS_OFFSET + i * HINT_RECORD_STRIDE;
            const nameStart = data[base + HINT_FIELD_NAME_START];
            const nameEnd = data[base + HINT_FIELD_NAME_END];
            const paramsStart = data[base + HINT_FIELD_PARAMS_START];
            const paramsEnd = data[base + HINT_FIELD_PARAMS_END];

            const name = ValueAstBuilder.parse(source, nameStart, nameEnd, options.isLocIncluded ?? false);

            const hint: Hint = {
                type: NodeType.Hint,
                name,
            };

            if (paramsStart !== -1) {
                hint.params = parseParameterList(
                    source,
                    paramsStart,
                    paramsEnd,
                    options.isLocIncluded ?? false,
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
            syntax: SYNTAX_ADG,
            children,
        };

        if (options.isLocIncluded) {
            result.start = 0;
            result.end = source.length;
        }

        return result;
    }
}
