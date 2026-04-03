/* eslint-disable no-bitwise, no-param-reassign */

/**
 * @file Scriptlet body preparser.
 *
 * Pre-computes parameter boundaries for ADG, UBO, and ABP scriptlet bodies.
 * All scanning uses charCode operations on the source string — zero heap
 * allocations. The output is written to ctx.data starting at a computed
 * offset after domain records.
 *
 * Data Layout (written at scriptletBodyDataOffset):
 *
 *   [+0]  snippetCallCount   (1 for ADG/UBO, N for ABP).
 *
 * Then for each call, written sequentially:
 *   [+0]  paramCount.
 *   [+1]  param0Start        (source offset, or -1 for null param).
 *   [+2]  param0End          (source offset, or -1 for null param).
 *   [+3]  param1Start.
 *   [+4]  param1End.
 */

import { sprintf } from 'sprintf-js';

import { AbpSnippetInjectionBodyCommon } from '../../common/abp-snippet-injection-body-common';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import {
    CHAR_BACKSLASH,
    CHAR_CLOSE_PAREN,
    CHAR_COMMA,
    CHAR_DOUBLE_QUOTE,
    CHAR_OPEN_PAREN,
    CHAR_SEMICOLON,
    CHAR_SINGLE_QUOTE,
    CHAR_SPACE,
} from '../../utils/char-codes';
import {
    ADG_SCRIPTLET_MASK,
    CLOSE_PARENTHESIS,
    OPEN_PARENTHESIS,
    UBO_SCRIPTLET_MASK,
    UBO_SCRIPTLET_MASK_LEGACY,
} from '../../utils/constants';
import type { PreparserContext } from '../context';
import { regionEquals, scriptletBodyDataOffset } from '../context';
import { NO_VALUE } from '../network/constants';
import {
    findUnescaped,
    findUnescapedBack,
    findUnescapedOutsideStrings,
    isQuote,
    skipWs,
    skipWsBack,
} from '../scan-utils';

import { SCRIPTLET_BODY_DATA_CAPACITY } from './constants';

// ---------------------------------------------------------------------------
// Error message constants (same as the AST parser used to emit)
// ---------------------------------------------------------------------------
const ADG_ERRORS = {
    NO_SCRIPTLET_MASK: `Invalid ADG scriptlet call, no scriptlet call mask '${ADG_SCRIPTLET_MASK}' found`,
    NO_OPENING_PARENTHESIS: `Invalid ADG scriptlet call, no opening parentheses '${OPEN_PARENTHESIS}' found`,
    NO_CLOSING_PARENTHESIS: `Invalid ADG scriptlet call, no closing parentheses '${CLOSE_PARENTHESIS}' found`,
    WHITESPACE_AFTER_MASK: 'Invalid ADG scriptlet call, whitespace is not allowed after the scriptlet call mask',
    NO_INCONSISTENT_QUOTES: 'Invalid ADG scriptlet call, inconsistent quotes',
    NO_UNCLOSED_PARAMETER: 'Invalid ADG scriptlet call, unclosed parameter',
    EXPECTED_QUOTE: "Invalid ADG scriptlet call, expected quote, got '%s'",
    EXPECTED_COMMA: "Invalid ADG scriptlet call, expected comma, got '%s'",
};

const UBO_ERRORS = {
    NO_SCRIPTLET_MASK: `Invalid uBO scriptlet call, no scriptlet call mask '${UBO_SCRIPTLET_MASK}' found`,
    NO_OPENING_PARENTHESIS: `Invalid uBO scriptlet call, no opening parentheses '${OPEN_PARENTHESIS}' found`,
    NO_CLOSING_PARENTHESIS: `Invalid uBO scriptlet call, no closing parentheses '${CLOSE_PARENTHESIS}' found`,
    NO_SCRIPTLET_NAME: 'Invalid uBO scriptlet call, no scriptlet name specified',
    WHITESPACE_AFTER_MASK: 'Invalid uBO scriptlet call, whitespace is not allowed after the scriptlet call mask',
};

// ---------------------------------------------------------------------------
// Scriptlet body preparser
// ---------------------------------------------------------------------------

/**
 * Scriptlet body preparser.
 *
 * Pre-computes parameter boundaries for ADG, UBO, and ABP scriptlet bodies
 * using charCode operations on the source string. Writes results to ctx.data
 * at the scriptlet body data offset (after domain records).
 */
export class ScriptletBodyPreparser {
    /**
     * Preparse an ADG scriptlet body: `//scriptlet('name', 'arg0', ...)`.
     *
     * @param ctx Preparser context (source + data).
     * @param bodyStartTi Token index where body starts.
     * @param bodyEndTi Token index where body ends (exclusive).
     * @param bodyStart Source offset where body starts.
     * @param bodyEnd Source offset where body ends.
     */
    public static preparseAdg(
        ctx: PreparserContext,
        bodyStartTi: number,
        bodyEndTi: number,
        bodyStart: number,
        bodyEnd: number,
    ): void {
        const { source, data } = ctx;
        const base = scriptletBodyDataOffset(ctx);
        const limit = base + SCRIPTLET_BODY_DATA_CAPACITY;
        let di = base; // data index (write cursor)

        let i = skipWs(source, bodyStart, bodyEnd);

        // Validate //scriptlet mask
        if (!regionEquals(source, i, i + ADG_SCRIPTLET_MASK.length, ADG_SCRIPTLET_MASK)) {
            throw new AdblockSyntaxError(ADG_ERRORS.NO_SCRIPTLET_MASK, i, bodyEnd);
        }
        i += ADG_SCRIPTLET_MASK.length;

        // No whitespace after mask
        if (source.charCodeAt(i) === CHAR_SPACE) {
            throw new AdblockSyntaxError(ADG_ERRORS.WHITESPACE_AFTER_MASK, i, bodyEnd);
        }

        // Opening paren
        if (source.charCodeAt(i) !== CHAR_OPEN_PAREN) {
            throw new AdblockSyntaxError(ADG_ERRORS.NO_OPENING_PARENTHESIS, i, bodyEnd);
        }
        const openParen = i;

        // Find closing paren (scan backward from body end)
        const closeParen = skipWsBack(source, bodyEnd - 1, openParen + 1);
        if (
            source.charCodeAt(closeParen) !== CHAR_CLOSE_PAREN
            || source.charCodeAt(closeParen - 1) === CHAR_BACKSLASH
        ) {
            throw new AdblockSyntaxError(ADG_ERRORS.NO_CLOSING_PARENTHESIS, openParen, bodyEnd);
        }

        // Write snippetCallCount = 1
        data[di] = 1;
        di += 1;

        // Check for empty call
        if (skipWs(source, openParen + 1, closeParen) === closeParen) {
            data[di] = 0; // paramCount = 0
            return;
        }

        // Reserve slot for paramCount, fill it later
        const paramCountSlot = di;
        di += 1;
        let paramCount = 0;
        let detectedQuote = 0; // char code of first detected quote, for consistency

        i = skipWs(source, openParen + 1, closeParen);

        while (i < closeParen) {
            i = skipWs(source, i, closeParen);

            // Expect comma before non-first param
            if (paramCount > 0) {
                if (source.charCodeAt(i) !== CHAR_COMMA) {
                    throw new AdblockSyntaxError(
                        sprintf(ADG_ERRORS.EXPECTED_COMMA, source[i]),
                        i,
                        bodyEnd,
                    );
                }
                i += 1; // eat comma
                i = skipWs(source, i, closeParen);
            }

            const cc = source.charCodeAt(i);
            if (cc === CHAR_SINGLE_QUOTE || cc === CHAR_DOUBLE_QUOTE) {
                // Enforce consistent quoting
                if (detectedQuote === 0) {
                    detectedQuote = cc;
                } else if (detectedQuote !== cc) {
                    throw new AdblockSyntaxError(ADG_ERRORS.NO_INCONSISTENT_QUOTES, i, bodyEnd);
                }

                // Find closing quote
                const closeQuote = findUnescaped(source, cc, i + 1, bodyEnd);
                if (closeQuote === -1) {
                    throw new AdblockSyntaxError(ADG_ERRORS.NO_UNCLOSED_PARAMETER, i, bodyEnd);
                }

                // Write param boundary (including quotes)
                if (di + 1 >= limit) {
                    throw new AdblockSyntaxError(
                        'Scriptlet body data buffer overflow: too many parameters',
                        i,
                        bodyEnd,
                    );
                }
                data[di] = i;
                data[di + 1] = closeQuote + 1;
                di += 2;
                paramCount += 1;

                i = skipWs(source, closeQuote + 1, closeParen);
            } else {
                throw new AdblockSyntaxError(
                    sprintf(ADG_ERRORS.EXPECTED_QUOTE, source[i]),
                    i,
                    bodyEnd,
                );
            }
        }

        data[paramCountSlot] = paramCount;
    }

    /**
     * Preparse a UBO scriptlet body: `+js(name, arg0, ...)` or
     * `script:inject(name, arg0, ...)`.
     *
     * @param ctx Preparser context.
     * @param bodyStartTi Token index where body starts.
     * @param bodyEndTi Token index where body ends (exclusive).
     * @param bodyStart Source offset where body starts.
     * @param bodyEnd Source offset where body ends.
     */
    public static preparseUbo(
        ctx: PreparserContext,
        bodyStartTi: number,
        bodyEndTi: number,
        bodyStart: number,
        bodyEnd: number,
    ): void {
        const { source, data } = ctx;
        const base = scriptletBodyDataOffset(ctx);
        const limit = base + SCRIPTLET_BODY_DATA_CAPACITY;
        let di = base;

        let i = skipWs(source, bodyStart, bodyEnd);

        // Detect mask (+js or script:inject)
        let maskLen = 0;
        if (regionEquals(source, i, i + UBO_SCRIPTLET_MASK.length, UBO_SCRIPTLET_MASK)) {
            maskLen = UBO_SCRIPTLET_MASK.length;
        } else if (regionEquals(
            source,
            i,
            i + UBO_SCRIPTLET_MASK_LEGACY.length,
            UBO_SCRIPTLET_MASK_LEGACY,
        )) {
            maskLen = UBO_SCRIPTLET_MASK_LEGACY.length;
        }
        if (maskLen === 0) {
            throw new AdblockSyntaxError(UBO_ERRORS.NO_SCRIPTLET_MASK, i, bodyEnd);
        }
        i += maskLen;

        // No whitespace after mask
        if (source.charCodeAt(i) === CHAR_SPACE) {
            throw new AdblockSyntaxError(UBO_ERRORS.WHITESPACE_AFTER_MASK, i, bodyEnd);
        }

        // Opening paren
        if (source.charCodeAt(i) !== CHAR_OPEN_PAREN) {
            throw new AdblockSyntaxError(UBO_ERRORS.NO_OPENING_PARENTHESIS, i, bodyEnd);
        }
        const openParen = i;

        // Find closing paren
        const closeParen = skipWsBack(source, bodyEnd - 1, openParen + 1);
        if (
            source.charCodeAt(closeParen) !== CHAR_CLOSE_PAREN
            || source.charCodeAt(closeParen - 1) === CHAR_BACKSLASH
        ) {
            throw new AdblockSyntaxError(UBO_ERRORS.NO_CLOSING_PARENTHESIS, openParen, bodyEnd);
        }

        // Write snippetCallCount = 1
        data[di] = 1;
        di += 1;

        // Empty call check
        if (skipWs(source, openParen + 1, closeParen) === closeParen) {
            data[di] = 0;
            return;
        }

        // Parse UBO parameter list inside (openParen+1 .. closeParen)
        const innerStart = openParen + 1;
        const innerEnd = closeParen;

        di = ScriptletBodyPreparser.preparseUboParamList(source, data, di, innerStart, innerEnd, limit);

        // Validate first param is not null (scriptlet name required)
        // paramCount is at base+1, first param start is at base+2
        const pc = data[base + 1];
        if (pc > 0 && data[base + 2] === NO_VALUE) {
            throw new AdblockSyntaxError(UBO_ERRORS.NO_SCRIPTLET_NAME, openParen, bodyEnd);
        }
    }

    /**
     * Preparse a UBO-style comma-separated parameter list.
     *
     * @param source Source string.
     * @param data Output data buffer.
     * @param di Current write offset in data.
     * @param start Inner content start (after open paren).
     * @param end Inner content end (before close paren).
     * @param limit Exclusive upper bound of the scriptlet data region in `data`.
     *
     * @returns Updated data write offset.
     */
    private static preparseUboParamList(
        source: string,
        data: Int32Array,
        di: number,
        start: number,
        end: number,
        limit: number,
    ): number {
        const paramCountSlot = di;
        di += 1;
        let paramCount = 0;
        let offset = start;
        let extraNull = false;

        while (offset < end) {
            offset = skipWs(source, offset, end);
            const paramStart = offset;
            let paramEnd = offset;

            const cc = source.charCodeAt(offset);

            if (isQuote(cc)) {
                // Find closing quote
                const closeQuote = findUnescaped(source, cc, offset + 1, end);

                if (closeQuote !== -1) {
                    // Check what follows the closing quote
                    const nextSep = skipWs(source, closeQuote + 1, end);

                    if (nextSep === end) {
                        // Param extends to trimmed end
                        paramEnd = skipWsBack(source, end - 1, paramStart) + 1;
                        offset = end;
                    } else if (source.charCodeAt(nextSep) === CHAR_COMMA) {
                        paramEnd = closeQuote + 1;
                        offset = nextSep + 1;
                    } else {
                        // Quote is not a proper delimiter — search for comma
                        const commaBeforeQuote = findUnescapedBack(
                            source,
                            CHAR_COMMA,
                            closeQuote,
                            paramStart + 1,
                        );
                        if (commaBeforeQuote !== -1) {
                            paramEnd = skipWsBack(source, commaBeforeQuote - 1, paramStart) + 1;
                            offset = commaBeforeQuote + 1;
                        } else {
                            const commaAfterQuote = findUnescaped(
                                source,
                                CHAR_COMMA,
                                closeQuote,
                                end,
                            );
                            if (commaAfterQuote !== -1) {
                                paramEnd = skipWsBack(source, commaAfterQuote - 1, paramStart) + 1;
                                offset = commaAfterQuote + 1;
                            } else {
                                paramEnd = skipWsBack(source, end - 1, paramStart) + 1;
                                offset = end;
                            }
                        }
                    }
                } else {
                    // No closing quote — param extends to end
                    paramEnd = skipWsBack(source, end - 1, paramStart) + 1;
                    offset = end;
                }
            } else {
                // Unquoted parameter — find next unescaped comma
                const nextComma = findUnescaped(source, CHAR_COMMA, offset, end);

                if (nextComma === -1) {
                    paramEnd = skipWsBack(source, end - 1, paramStart) + 1;
                    offset = end;
                } else {
                    paramEnd = skipWsBack(source, nextComma - 1, paramStart) + 1;
                    offset = nextComma + 1;

                    // Trailing comma → extra null
                    if (skipWs(source, end - 1, end) === nextComma) {
                        extraNull = true;
                    }
                }
            }

            if (di + 1 >= limit) {
                throw new RangeError('Scriptlet body data buffer overflow: too many parameters');
            }
            if (paramStart < paramEnd) {
                data[di] = paramStart;
                data[di + 1] = paramEnd;
            } else {
                data[di] = NO_VALUE;
                data[di + 1] = NO_VALUE;
            }
            di += 2;
            paramCount += 1;
        }

        if (extraNull) {
            if (di + 1 >= limit) {
                throw new RangeError('Scriptlet body data buffer overflow: too many parameters');
            }
            data[di] = NO_VALUE;
            data[di + 1] = NO_VALUE;
            di += 2;
            paramCount += 1;
        }

        data[paramCountSlot] = paramCount;
        return di;
    }

    /**
     * Preparse an ABP snippet body: `snippet0 arg0; snippet1 arg1`.
     *
     * @param ctx Preparser context.
     * @param bodyStartTi Token index where body starts.
     * @param bodyEndTi Token index where body ends (exclusive).
     * @param bodyStart Source offset where body starts.
     * @param bodyEnd Source offset where body ends.
     */
    public static preparseAbp(
        ctx: PreparserContext,
        bodyStartTi: number,
        bodyEndTi: number,
        bodyStart: number,
        bodyEnd: number,
    ): void {
        const { source, data } = ctx;
        const base = scriptletBodyDataOffset(ctx);
        const limit = base + SCRIPTLET_BODY_DATA_CAPACITY;

        // Reserve slot for snippetCallCount
        const callCountSlot = base;
        let di = base + 1;
        let callCount = 0;

        let offset = skipWs(source, bodyStart, bodyEnd);

        while (offset < bodyEnd) {
            offset = skipWs(source, offset, bodyEnd);
            const callStart = offset;

            // Find next unescaped semicolon outside strings/regexes
            let semiIdx = findUnescapedOutsideStrings(source, CHAR_SEMICOLON, offset, bodyEnd);
            if (semiIdx === -1) {
                semiIdx = bodyEnd;
            }

            const callEnd = Math.max(skipWsBack(source, semiIdx - 1, callStart) + 1, callStart);

            // Parse space-separated params for this call
            di = ScriptletBodyPreparser.preparseAbpParamList(source, data, di, callStart, callEnd, limit);
            callCount += 1;

            offset = semiIdx + 1;
        }

        if (callCount === 0) {
            throw new AdblockSyntaxError(
                AbpSnippetInjectionBodyCommon.ERROR_MESSAGES.EMPTY_SCRIPTLET_CALL,
                bodyStart,
                bodyEnd,
            );
        }

        data[callCountSlot] = callCount;
    }

    /**
     * Preparse an ABP-style space-separated parameter list (single snippet call).
     *
     * @param source Source string.
     * @param data Output data buffer.
     * @param di Current write offset in data.
     * @param start Call start offset.
     * @param end Call end offset.
     * @param limit Exclusive upper bound of the scriptlet data region in `data`.
     *
     * @returns Updated data write offset.
     */
    private static preparseAbpParamList(
        source: string,
        data: Int32Array,
        di: number,
        start: number,
        end: number,
        limit: number,
    ): number {
        const paramCountSlot = di;
        di += 1;
        let paramCount = 0;
        let offset = start;

        while (offset < end) {
            offset = skipWs(source, offset, end);

            if (source.charCodeAt(offset) === CHAR_SPACE || offset === end) {
                // Null parameter
                if (di + 1 >= limit) {
                    throw new RangeError('Scriptlet body data buffer overflow: too many parameters');
                }
                data[di] = NO_VALUE;
                data[di + 1] = NO_VALUE;
                di += 2;
                paramCount += 1;
                offset += 1;
            } else {
                const paramStart = offset;
                const nextSep = findUnescapedOutsideStrings(source, CHAR_SPACE, offset, end);

                let paramEnd: number;
                if (nextSep !== -1) {
                    paramEnd = skipWsBack(source, nextSep - 1, paramStart) + 1;
                    offset = nextSep + 1;
                } else {
                    paramEnd = skipWsBack(source, end - 1, paramStart) + 1;
                    offset = end;
                }

                if (di + 1 >= limit) {
                    throw new RangeError('Scriptlet body data buffer overflow: too many parameters');
                }
                data[di] = paramStart;
                data[di + 1] = paramEnd;
                di += 2;
                paramCount += 1;
            }
        }

        // Trailing space → extra null
        if (end > start && source.charCodeAt(end - 1) === CHAR_SPACE) {
            if (di + 1 >= limit) {
                throw new RangeError('Scriptlet body data buffer overflow: too many parameters');
            }
            data[di] = NO_VALUE;
            data[di + 1] = NO_VALUE;
            di += 2;
            paramCount += 1;
        }

        data[paramCountSlot] = paramCount;
        return di;
    }
}
