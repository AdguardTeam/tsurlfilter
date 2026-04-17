/* eslint-disable no-param-reassign */

/**
 * @file Pseudo-class selector handler for the CSS selector list preparser.
 *
 * Handles pseudo-class selectors (`:hover`, `:nth-child(2n+1)`,
 * `:not(.class)`, etc.). For standard CSS pseudo-classes uses an integer
 * depth counter that skips CSS string tokens inside arguments. For extended
 * CSS pseudo-classes the scanning mode is token-level but mode-dependent —
 * see {@link ExtCssMode} for details.
 */

import { cssIdentSequenceLength, cssStringLength } from '../../../css/tokenizer/css-token-mapping';
import { isCssWhitespace } from '../../../css/tokenizer/css-token-utils';
import { AdblockSyntaxError } from '../../../errors/adblock-syntax-error';
import { TokenType } from '../../../tokenizer/token-types';
import type { PreparserContext } from '../../context';
import { regionEquals, tokenStart } from '../../context';

import {
    CHILD_FIELD_0,
    CHILD_FIELD_1,
    CHILD_FIELD_2,
    CHILD_FIELD_3,
    CHILD_FIELD_4,
    CHILD_FIELD_5,
    CHILD_FIELD_6,
    CHILD_FIELD_7,
    CHILD_FIELD_KIND,
    CHILD_FIELD_SOURCE_END,
    CHILD_FIELD_SOURCE_START,
    CHILD_STRIDE,
    ChildKind,
    COMPLEX_STRIDE,
    NO_VALUE,
    SL_HEADER_SIZE,
} from './constants';

// ---------------------------------------------------------------------------
// Extended CSS pseudo-class detection
// ---------------------------------------------------------------------------

/**
 * Scanning mode for pseudo-class functional arguments.
 *
 * - `None` — standard CSS scanning (use `cssStringLength` for quotes).
 * - `Generic` — simplified scanning: balance parens only, no string interpretation.
 * - `Xpath` — balance parens with `inString` tracking for `"` tokens.
 */
const enum ExtCssMode {
    None = 0,
    Generic = 1,
    Xpath = 2,
}

/**
 * Detect whether the pseudo-class name at `source[nameStart..nameEnd)` is a
 * known extended CSS pseudo-class, and if so, which scanning mode to use.
 *
 * Uses the name length (an integer derived from `ends[]`) as a fast pre-filter
 * so that non-extended pseudo-classes (`:not`, `:has`, `:nth-child`, etc.)
 * never touch the source string at all.
 *
 * @see {@link https://github.com/AdguardTeam/ExtendedCss}
 *
 * @param source Source string.
 * @param nameStart Name start offset in source.
 * @param nameEnd Name end offset in source.
 *
 * @returns The scanning mode for this pseudo-class.
 */
function detectExtCssMode(source: string, nameStart: number, nameEnd: number): ExtCssMode {
    switch (nameEnd - nameStart) {
        case 5:
            return regionEquals(source, nameStart, nameEnd, 'xpath')
                ? ExtCssMode.Xpath
                : ExtCssMode.None;
        case 8:
            return regionEquals(source, nameStart, nameEnd, 'contains')
                || regionEquals(source, nameStart, nameEnd, 'has-text')
                ? ExtCssMode.Generic
                : ExtCssMode.None;
        case 11:
            return regionEquals(source, nameStart, nameEnd, 'matches-css')
                ? ExtCssMode.Generic
                : ExtCssMode.None;
        case 12:
            return regionEquals(source, nameStart, nameEnd, 'matches-attr')
                ? ExtCssMode.Generic
                : ExtCssMode.None;
        case 13:
            return regionEquals(source, nameStart, nameEnd, '-abp-contains')
                ? ExtCssMode.Generic
                : ExtCssMode.None;
        case 16:
            return regionEquals(source, nameStart, nameEnd, 'matches-property')
                ? ExtCssMode.Generic
                : ExtCssMode.None;
        case 17:
            return regionEquals(source, nameStart, nameEnd, 'matches-css-after')
                ? ExtCssMode.Generic
                : ExtCssMode.None;
        case 18:
            return regionEquals(source, nameStart, nameEnd, 'matches-css-before')
                ? ExtCssMode.Generic
                : ExtCssMode.None;
        default:
            return ExtCssMode.None;
    }
}

/**
 * Handle a pseudo-class selector (`:hover`, `:nth-child(2n+1)`) starting at
 * token `ti`.
 *
 * Token `ti` must be a `Colon` token. Reads the colon, the pseudo-class name
 * (a CSS ident sequence), and — for functional pseudo-classes — the balanced
 * parenthetical argument. String tokens inside arguments are skipped during
 * balance counting. Argument offsets are trimmed of leading/trailing
 * whitespace tokens.
 *
 * Pseudo-element selectors (`::`) are not supported and throw immediately.
 *
 * @param ctx Preparser context.
 * @param ti Token index of the `:` token.
 * @param endTi Exclusive end token index for the current parsing region.
 * @param dataOffset Base offset within `ctx.data` for selector-list data.
 * @param maxComplex Maximum complex selector capacity (used to locate child array).
 * @param childIndex Index of the child record to write.
 *
 * @returns Token index of the first token after the consumed selector.
 */
export function handlePseudoClassSelector(
    ctx: PreparserContext,
    ti: number,
    endTi: number,
    dataOffset: number,
    maxComplex: number,
    childIndex: number,
): number {
    const {
        types,
        ends,
        source,
        sourceStart,
        data,
    } = ctx;

    const srcStart = tokenStart(ctx, ti);

    // Skip the ':' token
    let i = ti + 1;

    // Reject pseudo-elements ('::')
    if (i < endTi && types[i] === TokenType.Colon) {
        throw new AdblockSyntaxError(
            'Pseudo-element selectors (::) are not supported',
            srcStart,
            ends[i],
        );
    }

    // Parse pseudo-class name (must be a CSS ident)
    if (i >= endTi) {
        throw new AdblockSyntaxError(
            'Empty pseudo-class: expected name after :',
            srcStart,
            srcStart + 1,
        );
    }

    const nameStart = tokenStart(ctx, i);
    const nameLen = cssIdentSequenceLength(types, i, endTi, source, ends, sourceStart);
    if (nameLen === 0) {
        throw new AdblockSyntaxError(
            'Empty pseudo-class: expected identifier after :',
            nameStart,
            ends[i],
        );
    }
    i += nameLen;
    const nameEnd = ends[i - 1];

    let argStart = NO_VALUE;
    let argEnd = NO_VALUE;
    let srcEnd = nameEnd;

    // Check for functional pseudo-class: name followed by '('
    if (i < endTi && types[i] === TokenType.OpenParen) {
        const openParenTi = i;
        i += 1; // skip '('

        // Determine scanning mode for the argument content.
        //
        // Extended CSS pseudo-classes (contains, has-text, xpath, etc.) may
        // have arguments that are NOT valid CSS — regex patterns, raw text,
        // XPath expressions. In these cases, a Quote/Apostrophe token inside
        // the argument is NOT a CSS string delimiter, so cssStringLength must
        // NOT be used (it would over-consume to the end of the token range
        // for an unterminated "string" that isn't actually a string).
        //
        // However, if the first non-whitespace token after '(' IS a
        // Quote/Apostrophe, the argument is intentionally quoted and we should
        // use the standard CSS string-aware scanner.
        //
        // Detection uses a length-based switch so that non-extended
        // pseudo-classes never access the source string at all.
        let mode = detectExtCssMode(source, nameStart, nameEnd);

        if (mode !== ExtCssMode.None) {
            // Extended CSS detected — but if the argument starts with a
            // quote, fall back to standard CSS scanning (token-level
            // cssStringLength handles quoted args correctly).
            let peek = i;
            while (peek < endTi && isCssWhitespace(types[peek])) {
                peek += 1;
            }
            if (peek < endTi
                && (types[peek] === TokenType.Quote || types[peek] === TokenType.Apostrophe)) {
                mode = ExtCssMode.None;
            }
        }

        const argContentStartTi = i;
        let depth = 1;

        if (mode === ExtCssMode.Xpath) {
            // XPath mode: balance parens, but ignore parens inside string
            // literals toggled by Quote (")") or Apostrophe (') tokens.
            // Both quoting forms are valid in XPath, e.g.:
            //   //div[@class="foo(bar)"]   — double-quoted
            //   //div[@class='foo(bar)']   — single-quoted
            let inString: TokenType.Quote | TokenType.Apostrophe | 0 = 0;
            while (i < endTi && depth > 0) {
                const tt = types[i];
                if (inString === 0) {
                    if (tt === TokenType.Quote || tt === TokenType.Apostrophe) {
                        inString = tt;
                    } else if (tt === TokenType.OpenParen) {
                        depth += 1;
                    } else if (tt === TokenType.CloseParen) {
                        depth -= 1;
                        if (depth === 0) {
                            break;
                        }
                    }
                } else if (tt === inString) {
                    // Matching close-quote ends the string literal
                    inString = 0;
                }
                i += 1;
            }
        } else if (mode === ExtCssMode.Generic) {
            // Generic extended CSS mode: balance parens only.
            // Quotes are just regular tokens — no CSS string interpretation.
            // Escaped tokens (\( \)) are already NOT OpenParen/CloseParen,
            // so they naturally don't affect depth.
            while (i < endTi && depth > 0) {
                const tt = types[i];
                if (tt === TokenType.OpenParen) {
                    depth += 1;
                    i += 1;
                } else if (tt === TokenType.CloseParen) {
                    depth -= 1;
                    if (depth === 0) {
                        break;
                    }
                    i += 1;
                } else {
                    i += 1;
                }
            }
        } else {
            // Standard CSS mode: balance parens with CSS string skipping.
            // cssStringLength correctly handles quoted content so that ')'
            // inside a string doesn't close the pseudo-class.
            while (i < endTi && depth > 0) {
                const tt = types[i];

                if (tt === TokenType.Quote || tt === TokenType.Apostrophe) {
                    // Skip over quoted string
                    const strLen = cssStringLength(types, i, endTi);
                    i += strLen > 0 ? strLen : 1;
                } else if (tt === TokenType.OpenParen) {
                    depth += 1;
                    i += 1;
                } else if (tt === TokenType.CloseParen) {
                    depth -= 1;
                    if (depth === 0) {
                        break;
                    }
                    i += 1;
                } else {
                    i += 1;
                }
            }
        }

        if (depth !== 0) {
            throw new AdblockSyntaxError(
                'Missing ) in pseudo-class functional argument',
                tokenStart(ctx, openParenTi),
                ends[openParenTi],
            );
        }

        // i is now at the matching ')' token
        const argContentEndTi = i; // exclusive end of content (before ')')
        srcEnd = ends[i];
        i += 1; // consume ')'

        // Trim argument content of leading and trailing whitespace
        let trimStart = argContentStartTi;
        let trimEnd = argContentEndTi;

        while (trimStart < trimEnd && isCssWhitespace(types[trimStart])) {
            trimStart += 1;
        }
        while (trimEnd > trimStart && isCssWhitespace(types[trimEnd - 1])) {
            trimEnd -= 1;
        }

        if (trimStart < trimEnd) {
            argStart = tokenStart(ctx, trimStart);
            argEnd = ends[trimEnd - 1];
        } else {
            // Empty argument (all whitespace or empty parens)
            argStart = ends[openParenTi]; // position right after '('
            argEnd = argStart;
        }
    }

    const base = dataOffset + SL_HEADER_SIZE + maxComplex * COMPLEX_STRIDE + childIndex * CHILD_STRIDE;

    data[base + CHILD_FIELD_KIND] = ChildKind.PseudoClassSelector;
    data[base + CHILD_FIELD_SOURCE_START] = srcStart;
    data[base + CHILD_FIELD_SOURCE_END] = srcEnd;
    data[base + CHILD_FIELD_0] = nameStart; // pseudo-class name start
    data[base + CHILD_FIELD_1] = nameEnd; // pseudo-class name end
    data[base + CHILD_FIELD_2] = argStart; // argument start (or NO_VALUE)
    data[base + CHILD_FIELD_3] = argEnd; // argument end (or NO_VALUE)
    data[base + CHILD_FIELD_4] = NO_VALUE;
    data[base + CHILD_FIELD_5] = NO_VALUE;
    data[base + CHILD_FIELD_6] = NO_VALUE;
    data[base + CHILD_FIELD_7] = NO_VALUE;

    return i;
}
