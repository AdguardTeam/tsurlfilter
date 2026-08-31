/* eslint-disable no-param-reassign */

/**
 * @file CSS at-rule structural parser.
 *
 * `CssAtRuleParser.parse()` scans adblock tokens to find the structural
 * boundaries of a CSS at-rule: the `@` sign, the at-rule name, the
 * prelude (parameters), and the optional block `{ ... }`.
 *
 * All output is written to `ctx.data` (Int32Array) with zero heap allocations.
 *
 * Uses **forward scanning**: starts from `@`, reads the name, scans forward
 * through the prelude to find `{` or `;`, then (for block at-rules) scans
 * forward with brace depth tracking to find the matching `}`.
 *
 * CSS strings are skipped using `cssStringLength()` from
 * `css-token-mapping.ts`, which handles Quote/Apostrophe matching,
 * bad-string line breaks, and unterminated strings.
 */

import { cssStringLength } from '../../../css/tokenizer/css-token-mapping';
import { consumeCssIdentRun, isCssWhitespace } from '../../../css/tokenizer/css-token-utils';
import { AdblockSyntaxError } from '../../../errors/adblock-syntax-error';
import { TokenType } from '../../../tokenizer/token-types';
import type { ParserContext } from '../../context';
import { tokenStart } from '../../context';
import type { StructuralParser } from '../../types';

import {
    AT_BLOCK_END_TI,
    AT_BLOCK_START_TI,
    AT_CLOSE_BRACE_POS,
    AT_CLOSE_BRACE_TI,
    AT_MIN_DATA_SLOTS,
    AT_NAME_END_TI,
    AT_NAME_SOURCE_END,
    AT_NAME_SOURCE_START,
    AT_NAME_START_TI,
    AT_NO_VALUE,
    AT_OPEN_BRACE_POS,
    AT_OPEN_BRACE_TI,
    AT_PRELUDE_END_TI,
    AT_PRELUDE_SOURCE_END,
    AT_PRELUDE_SOURCE_START,
    AT_PRELUDE_START_TI,
    AT_SOURCE_START,
} from './constants';

/**
 * CSS at-rule structural parser.
 *
 * Identifies the at-sign, name, prelude, and block boundaries of a CSS
 * at-rule. Writes all output to `ctx.data` with zero heap allocations.
 */
export class CssAtRuleParser implements StructuralParser {
    /**
     * Minimum `ctx.data` capacity required for the default configuration.
     */
    public static readonly MIN_DATA_SLOTS = AT_MIN_DATA_SLOTS;

    /**
     * Parse a CSS at-rule token range.
     *
     * Reads tokens from `ctx.types`/`ctx.ends` in the range
     * `[startTi, endTi)` and writes a 15-slot header at `dataOffset`
     * containing structural boundaries for the at-rule.
     *
     * @param ctx Parser context.
     * @param startTi Inclusive start token index.
     * @param endTi Exclusive end token index.
     * @param dataOffset Offset within `ctx.data` to start writing.
     *
     * @throws {AdblockSyntaxError} On missing name, unclosed block, etc.
     */
    public static parse(
        ctx: ParserContext,
        startTi: number,
        endTi: number,
        dataOffset: number,
    ): void {
        const {
            types,
            ends,
            data,
        } = ctx;

        // Phase 1: Find `@` — skip leading whitespace
        let ti = startTi;
        while (ti < endTi && isCssWhitespace(types[ti])) {
            ti += 1;
        }

        if (ti >= endTi || types[ti] !== TokenType.AtSign) {
            let errEnd: number;
            if (ti < endTi) {
                errEnd = ends[ti];
            } else if (endTi > 0) {
                errEnd = ends[endTi - 1];
            } else {
                errEnd = 0;
            }
            throw new AdblockSyntaxError(
                'Expected "@" at the start of CSS at-rule',
                tokenStart(ctx, startTi),
                errEnd,
            );
        }

        const atSourceStart = tokenStart(ctx, ti);
        ti += 1; // skip past '@'

        // Phase 2: Read at-rule name
        // The name consists of ident-run tokens (Letter, Hyphen, Digit,
        // Underscore, NonAscii, Escaped) immediately after `@`.
        const nameStartTi = ti;
        ti = consumeCssIdentRun(types, ti, endTi);
        const nameEndTi = ti;

        if (nameStartTi >= nameEndTi) {
            let errEnd: number;
            if (ti < endTi) {
                errEnd = ends[ti];
            } else if (endTi > 0) {
                errEnd = ends[endTi - 1];
            } else {
                errEnd = atSourceStart + 1;
            }
            throw new AdblockSyntaxError(
                'Expected at-rule name after "@"',
                atSourceStart,
                errEnd,
            );
        }

        const nameSourceStart = tokenStart(ctx, nameStartTi);
        const nameSourceEnd = ends[nameEndTi - 1];

        // Phase 3: Find prelude and block/semicolon
        // Scan forward from after the name. The prelude is everything between
        // the name and `{` (block at-rule) or `;` (statement at-rule).
        // Track parenthesis depth to avoid matching `{` inside `()`.
        const preludeSearchTi = ti;

        // Scan forward for `{` or `;`, tracking paren depth and skipping strings
        let openBraceTi = AT_NO_VALUE;
        let semicolonTi = AT_NO_VALUE;

        let scanTi = preludeSearchTi;
        let parenDepth = 0;

        while (scanTi < endTi) {
            const type = types[scanTi];

            // Skip CSS strings (Quote/Apostrophe token pairs)
            const strLen = cssStringLength(types, scanTi, endTi);
            if (strLen > 0) {
                scanTi += strLen;
                // eslint-disable-next-line no-continue
                continue;
            }

            if (type === TokenType.OpenParen) {
                parenDepth += 1;
            } else if (type === TokenType.CloseParen) {
                if (parenDepth > 0) {
                    parenDepth -= 1;
                }
            } else if (parenDepth === 0) {
                if (type === TokenType.OpenBrace) {
                    openBraceTi = scanTi;
                    break;
                }
                if (type === TokenType.Semicolon) {
                    semicolonTi = scanTi;
                    break;
                }
            }

            scanTi += 1;
        }

        // Phase 4: Determine prelude boundaries
        // Prelude = tokens between name end and `{`/`;`, trimmed of whitespace.
        let preludeLimit: number;
        if (openBraceTi !== AT_NO_VALUE) {
            preludeLimit = openBraceTi;
        } else if (semicolonTi !== AT_NO_VALUE) {
            preludeLimit = semicolonTi;
        } else {
            preludeLimit = endTi;
        }

        let preludeStartTi = preludeSearchTi;
        while (preludeStartTi < preludeLimit && isCssWhitespace(types[preludeStartTi])) {
            preludeStartTi += 1;
        }

        let preludeEndTi = preludeLimit;
        while (preludeEndTi > preludeStartTi && isCssWhitespace(types[preludeEndTi - 1])) {
            preludeEndTi -= 1;
        }

        const hasPrelude = preludeStartTi < preludeEndTi;
        const preludeSourceStart = hasPrelude ? tokenStart(ctx, preludeStartTi) : AT_NO_VALUE;
        const preludeSourceEnd = hasPrelude ? ends[preludeEndTi - 1] : AT_NO_VALUE;

        // Phase 5: Handle block at-rule
        if (openBraceTi !== AT_NO_VALUE) {
            // Find matching closing brace with depth tracking
            let closeBraceTi = AT_NO_VALUE;
            let braceDepth = 1;
            let blockScanTi = openBraceTi + 1;

            while (blockScanTi < endTi && braceDepth > 0) {
                const type = types[blockScanTi];

                // Skip CSS strings (Quote/Apostrophe token pairs)
                const strLen = cssStringLength(types, blockScanTi, endTi);
                if (strLen > 0) {
                    blockScanTi += strLen;
                    // eslint-disable-next-line no-continue
                    continue;
                }

                if (type === TokenType.OpenBrace) {
                    braceDepth += 1;
                } else if (type === TokenType.CloseBrace) {
                    braceDepth -= 1;
                    if (braceDepth === 0) {
                        closeBraceTi = blockScanTi;
                        break;
                    }
                }

                blockScanTi += 1;
            }

            if (closeBraceTi === AT_NO_VALUE) {
                throw new AdblockSyntaxError(
                    'Unclosed block in CSS at-rule — expected "}"',
                    tokenStart(ctx, openBraceTi),
                    endTi > 0 ? ends[endTi - 1] : 0,
                );
            }

            // Block content = tokens between `{` and `}`, trimmed of whitespace
            let blockStartTi = openBraceTi + 1;
            while (blockStartTi < closeBraceTi && isCssWhitespace(types[blockStartTi])) {
                blockStartTi += 1;
            }

            let blockEndTi = closeBraceTi;
            while (blockEndTi > blockStartTi && isCssWhitespace(types[blockEndTi - 1])) {
                blockEndTi -= 1;
            }

            // Write block slots
            data[dataOffset + AT_OPEN_BRACE_POS] = tokenStart(ctx, openBraceTi);
            data[dataOffset + AT_OPEN_BRACE_TI] = openBraceTi;
            data[dataOffset + AT_CLOSE_BRACE_POS] = tokenStart(ctx, closeBraceTi);
            data[dataOffset + AT_CLOSE_BRACE_TI] = closeBraceTi;
            data[dataOffset + AT_BLOCK_START_TI] = blockStartTi;
            data[dataOffset + AT_BLOCK_END_TI] = blockEndTi;
        } else {
            // Statement at-rule or no block — set all block slots to -1
            data[dataOffset + AT_OPEN_BRACE_POS] = AT_NO_VALUE;
            data[dataOffset + AT_OPEN_BRACE_TI] = AT_NO_VALUE;
            data[dataOffset + AT_CLOSE_BRACE_POS] = AT_NO_VALUE;
            data[dataOffset + AT_CLOSE_BRACE_TI] = AT_NO_VALUE;
            data[dataOffset + AT_BLOCK_START_TI] = AT_NO_VALUE;
            data[dataOffset + AT_BLOCK_END_TI] = AT_NO_VALUE;
        }

        // Phase 6: Write common header slots
        data[dataOffset + AT_SOURCE_START] = atSourceStart;
        data[dataOffset + AT_NAME_SOURCE_START] = nameSourceStart;
        data[dataOffset + AT_NAME_SOURCE_END] = nameSourceEnd;
        data[dataOffset + AT_NAME_START_TI] = nameStartTi;
        data[dataOffset + AT_NAME_END_TI] = nameEndTi;
        data[dataOffset + AT_PRELUDE_SOURCE_START] = preludeSourceStart;
        data[dataOffset + AT_PRELUDE_SOURCE_END] = preludeSourceEnd;
        data[dataOffset + AT_PRELUDE_START_TI] = hasPrelude ? preludeStartTi : AT_NO_VALUE;
        data[dataOffset + AT_PRELUDE_END_TI] = hasPrelude ? preludeEndTi : AT_NO_VALUE;
    }

    /**
     * Source offset of the `@` sign.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for at-rule data.
     *
     * @returns Source offset.
     */
    public static sourceStart(data: Int32Array, dataOffset: number): number {
        return data[dataOffset + AT_SOURCE_START];
    }

    /**
     * Source start offset of the at-rule name.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for at-rule data.
     *
     * @returns Source offset.
     */
    public static nameSourceStart(data: Int32Array, dataOffset: number): number {
        return data[dataOffset + AT_NAME_SOURCE_START];
    }

    /**
     * Source end offset of the at-rule name.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for at-rule data.
     *
     * @returns Source offset.
     */
    public static nameSourceEnd(data: Int32Array, dataOffset: number): number {
        return data[dataOffset + AT_NAME_SOURCE_END];
    }

    /**
     * Token index of the first at-rule name token.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for at-rule data.
     *
     * @returns Token index (inclusive).
     */
    public static nameStartTi(data: Int32Array, dataOffset: number): number {
        return data[dataOffset + AT_NAME_START_TI];
    }

    /**
     * Exclusive end token index of the at-rule name.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for at-rule data.
     *
     * @returns Token index (exclusive).
     */
    public static nameEndTi(data: Int32Array, dataOffset: number): number {
        return data[dataOffset + AT_NAME_END_TI];
    }

    /**
     * Source start offset of the prelude, or -1 if absent.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for at-rule data.
     *
     * @returns Source offset or -1.
     */
    public static preludeSourceStart(data: Int32Array, dataOffset: number): number {
        return data[dataOffset + AT_PRELUDE_SOURCE_START];
    }

    /**
     * Source end offset of the prelude, or -1 if absent.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for at-rule data.
     *
     * @returns Source offset or -1.
     */
    public static preludeSourceEnd(data: Int32Array, dataOffset: number): number {
        return data[dataOffset + AT_PRELUDE_SOURCE_END];
    }

    /**
     * Token index of the first prelude token, or -1 if absent.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for at-rule data.
     *
     * @returns Token index (inclusive) or -1.
     */
    public static preludeStartTi(data: Int32Array, dataOffset: number): number {
        return data[dataOffset + AT_PRELUDE_START_TI];
    }

    /**
     * Exclusive end token index of the prelude, or -1 if absent.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for at-rule data.
     *
     * @returns Token index (exclusive) or -1.
     */
    public static preludeEndTi(data: Int32Array, dataOffset: number): number {
        return data[dataOffset + AT_PRELUDE_END_TI];
    }

    /**
     * Source offset of the opening `{`, or -1 if no block.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for at-rule data.
     *
     * @returns Source offset or -1.
     */
    public static openBracePos(data: Int32Array, dataOffset: number): number {
        return data[dataOffset + AT_OPEN_BRACE_POS];
    }

    /**
     * Token index of the opening `{`, or -1 if no block.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for at-rule data.
     *
     * @returns Token index or -1.
     */
    public static openBraceTi(data: Int32Array, dataOffset: number): number {
        return data[dataOffset + AT_OPEN_BRACE_TI];
    }

    /**
     * Source offset of the closing `}`, or -1 if no block.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for at-rule data.
     *
     * @returns Source offset or -1.
     */
    public static closeBracePos(data: Int32Array, dataOffset: number): number {
        return data[dataOffset + AT_CLOSE_BRACE_POS];
    }

    /**
     * Token index of the closing `}`, or -1 if no block.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for at-rule data.
     *
     * @returns Token index or -1.
     */
    public static closeBraceTi(data: Int32Array, dataOffset: number): number {
        return data[dataOffset + AT_CLOSE_BRACE_TI];
    }

    /**
     * Token index of the first block content token (after `{`), or -1 if no block.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for at-rule data.
     *
     * @returns Token index (inclusive) or -1.
     */
    public static blockStartTi(data: Int32Array, dataOffset: number): number {
        return data[dataOffset + AT_BLOCK_START_TI];
    }

    /**
     * Exclusive end token index of block content (before `}`), or -1 if no block.
     *
     * @param data Output buffer.
     * @param dataOffset Base offset for at-rule data.
     *
     * @returns Token index (exclusive) or -1.
     */
    public static blockEndTi(data: Int32Array, dataOffset: number): number {
        return data[dataOffset + AT_BLOCK_END_TI];
    }
}
