/* eslint-disable max-classes-per-file */
/**
 * @file Parameter list AST parser.
 *
 * Converts the flat {@link Int32Array} buffer produced by
 * the parameter list preparser into a {@link ParameterList} AST node.
 */

import { type Parameter, type ParameterList } from '../../nodes-new';
import { createPreparserContext, initPreparserContext } from '../../preparser/context';
import type { PreparserContext } from '../../preparser/context';
import {
    ParameterListPreparser,
    PL_BUFFER_SIZE,
    PL_COUNT,
    PL_FLAG_TRANSFORM,
    PL_HEADER,
    PL_LIST_END,
    PL_LIST_START,
    PL_PARAM_END,
    PL_PARAM_FLAGS,
    PL_PARAM_START,
    PL_STRIDE,
} from '../../preparser/misc/parameter-list';
import { Tokenizer } from '../../tokenizer/tokenizer';
import { QuoteType, QuoteUtils } from '../../utils/quotes';

/**
 * Default token capacity for the reusable {@link ParameterListParser} tokenizer.
 */
const DEFAULT_TOKEN_CAPACITY = 1024;

/**
 * AST parser for parameter list nodes.
 *
 * Reads the flat buffer written by the parameter list preparser
 * and constructs a {@link ParameterList} node with optional source locations.
 */
export class ParameterListAstParser {
    /**
     * Builds a {@link ParameterList} node from a preparsed buffer.
     *
     * @param source Original source string.
     * @param buf Buffer written by the parameter list preparser.
     * @param isLocIncluded Whether to attach source locations to nodes.
     *
     * @returns ParameterList AST node.
     */
    public static parse(source: string, buf: Int32Array, isLocIncluded: boolean): ParameterList {
        const count = buf[PL_COUNT];
        const listStart = buf[PL_LIST_START];
        const listEnd = buf[PL_LIST_END];

        const result: ParameterList = {
            type: 'ParameterList',
            children: [],
        };

        if (isLocIncluded) {
            result.start = listStart;
            result.end = listEnd;
        }

        for (let i = 0; i < count; i += 1) {
            const pidx = PL_HEADER + i * PL_STRIDE;
            const start = buf[pidx + PL_PARAM_START];
            const end = buf[pidx + PL_PARAM_END];
            const flags = buf[pidx + PL_PARAM_FLAGS];

            if (start === -1) {
                result.children.push(null);
            } else {
                // Extract quote type from bits 0-1
                const quoteTypeCode = flags & 0x03;
                let quoteType: QuoteType;
                if (quoteTypeCode === 1) {
                    quoteType = QuoteType.Single;
                } else if (quoteTypeCode === 2) {
                    quoteType = QuoteType.Double;
                } else if (quoteTypeCode === 3) {
                    quoteType = QuoteType.Backtick;
                } else {
                    quoteType = QuoteType.None;
                }

                // Extract transform flag from bit 2
                const needsTransform = (flags & PL_FLAG_TRANSFORM) !== 0;

                // Get raw source text
                let value = source.slice(start, end);

                // Unquote and unescape
                if (quoteType !== QuoteType.None) {
                    // Strip bounding quotes and unescape the quote character
                    value = QuoteUtils.removeQuotesAndUnescape(value);
                }

                // Unescape separator characters if transform flag is set
                if (needsTransform) {
                    value = this.unescapeSeparator(value);
                }

                const node: Parameter = {
                    type: 'Parameter',
                    value,
                    quoteType,
                };

                if (isLocIncluded) {
                    // Location includes the quotes in the original source
                    node.start = start;
                    node.end = end;
                }

                result.children.push(node);
            }
        }

        return result;
    }

    /**
     * Unescapes separator characters in a parameter value.
     *
     * Handles arbitrary sequences of backslashes before a comma using parity:
     * - Odd number of consecutive backslashes before `,` → the last one is an escape;
     *   strip it and keep the literal `,` (e.g. `\,` → `,`, `\\\,` → `\\,`).
     * - Even number → all backslashes are literal pairs; the `,` is not escaped
     *   (this case should not appear in practice because a real separator would
     *   have been split off by the preparser, but the function handles it safely).
     *
     * This matches the behaviour of `ArglistParser.normalizeArg` from uBlock Origin.
     *
     * @param value Parameter value string (raw source text, may contain `\,` sequences).
     *
     * @returns Value with backslash-escaped commas unescaped.
     */
    private static unescapeSeparator(value: string): string {
        let result = '';

        for (let i = 0; i < value.length; i += 1) {
            const ch = value[i];

            if (ch !== ',') {
                result += ch;
            } else {
                // Count consecutive backslashes at the trailing end of the
                // accumulated result.  Odd count → the last backslash is the
                // escape character for this comma: strip it.
                let bsCount = 0;

                while (bsCount < result.length && result[result.length - 1 - bsCount] === '\\') {
                    bsCount += 1;
                }

                if (bsCount % 2 === 1) {
                    result = result.slice(0, -1);
                }

                result += ch;
            }
        }

        return result;
    }
}

/**
 * High-level parser for parameter list nodes.
 *
 * Owns its own tokenizer and preparser context so callers do not need to
 * provide an external {@link PreparserContext}. Use this when you have only
 * the parameter-group bounds in the original source (e.g. a `(…)` span
 * identified by a parent preparser) and want to get a {@link ParameterList}
 * AST node without manually managing token indices.
 *
 * Internally:
 * 1. Re-tokenises the source from `innerStart` (preserving absolute positions).
 * 2. Locates the closing `)` token by scanning for the first token whose end
 *    reaches `paramsEnd`.
 * 3. Delegates to {@link ParameterListPreparser} and {@link ParameterListAstParser}.
 *
 * All internal buffers are static and reused across calls; this class is not
 * safe to use concurrently (fine for synchronous parsers).
 */
export class ParameterListParser {
    /**
     * Reusable tokenizer instance.
     */
    private static readonly tokenizer: Tokenizer = new Tokenizer(DEFAULT_TOKEN_CAPACITY);

    /**
     * Reusable preparser context.
     */
    private static readonly ctx: PreparserContext = createPreparserContext();

    /**
     * Reusable parameter-list preparser output buffer.
     */
    private static readonly plBuf = new Int32Array(PL_BUFFER_SIZE);

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
    public static parse(
        source: string,
        paramsStart: number,
        paramsEnd: number,
        isLocIncluded: boolean,
    ): ParameterList {
        const innerStart = paramsStart + 1;
        const innerEnd = paramsEnd - 1;

        // Tokenize the source from `innerStart` — token ends are absolute positions.
        this.tokenizer.setSource(source, innerStart);
        initPreparserContext(this.ctx, source, this.tokenizer, innerStart);

        // Find the closing `)` token: first token whose end reaches `paramsEnd`.
        const { tokenCount } = this.tokenizer;
        let closeParenTi = 0;
        while (closeParenTi < tokenCount && this.tokenizer.ends[closeParenTi] < paramsEnd) {
            closeParenTi += 1;
        }

        ParameterListPreparser.preparse(
            this.ctx,
            0,
            closeParenTi,
            innerStart,
            innerEnd,
            this.plBuf,
        );

        return ParameterListAstParser.parse(source, this.plBuf, isLocIncluded);
    }
}
