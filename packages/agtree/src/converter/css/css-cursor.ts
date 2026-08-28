/**
 * @file Zero-allocation CSS-level cursor for selector conversion.
 *
 * Wraps the internal {@link Tokenizer} and uses span-length functions from
 * `css-token-mapping.ts` to classify sub-token sequences as CSS Syntax Level 3
 * tokens. Designed for the converter pipeline:
 *
 * - No per-token object allocation.
 * - Nesting-depth tracking (parens, brackets, braces).
 * - Source-slice extraction for the current CSS token.
 * - Reusable across multiple inputs via {@link CssCursor.reset}.
 */

import {
    cssAtKeywordLength,
    cssCdcLength,
    cssCdoLength,
    cssCommentLength,
    cssDimensionLength,
    cssFunctionLength,
    cssHashLength,
    cssIdentSequenceLength,
    cssNumberLength,
    cssPercentageLength,
    cssStringLength,
    cssWhitespaceLength,
} from '../../css/tokenizer/css-token-mapping';
import { CapacityOverflowError, REGION_TOKENS } from '../../errors/capacity-overflow-error';
import { MAX_TOKEN_CAPACITY } from '../../limits';
import { TokenType } from '../../tokenizer/token-types';
import { Tokenizer } from '../../tokenizer/tokenizer';

import { CssTokenKind } from './css-token-kind';

/**
 * Default initial sub-token buffer capacity. Covers typical CSS selectors
 * without requiring a resize of the underlying typed arrays.
 */
const DEFAULT_CURSOR_CAPACITY = 512;

/**
 * A zero-allocation CSS-level cursor over adblock sub-tokens.
 *
 * Call {@link CssCursor.reset} with a source string to start iteration, then
 * use {@link CssCursor.kind}, {@link CssCursor.start}, {@link CssCursor.end}
 * to inspect the current CSS token, and {@link CssCursor.advance} to move to
 * the next.
 */
export class CssCursor {
    /**
     * Internal tokenizer instance (reused across reset calls).
     */
    private readonly tokenizer: Tokenizer;

    /**
     * Sub-token index pointing to the START of the current CSS token.
     */
    private pos = 0;

    /**
     * CSS token kind at current position.
     */
    private currentKind: CssTokenKind = CssTokenKind.Eof;

    /**
     * Source offset of the first character of the current CSS token.
     */
    private currentStart = 0;

    /**
     * Source offset one past the last character of the current CSS token.
     */
    private currentEnd = 0;

    /**
     * Number of sub-tokens consumed by the current CSS token.
     */
    private span = 0;

    /**
     * Current nesting depth for parentheses.
     */
    private parenDepth = 0;

    /**
     * Current nesting depth for square brackets.
     */
    private bracketDepth = 0;

    /**
     * Current nesting depth for curly braces.
     */
    private braceDepth = 0;

    /**
     * The initial offset passed to reset (used for tokenStart calculation).
     */
    private initialOffset = 0;

    /**
     * Creates a new CssCursor.
     *
     * @param capacity Initial sub-token buffer capacity. 512 covers typical
     * selectors without resizing.
     */
    constructor(capacity = DEFAULT_CURSOR_CAPACITY) {
        this.tokenizer = new Tokenizer(capacity);
    }

    /**
     * CSS token kind at the current position.
     *
     * @returns The current CSS token kind.
     */
    public get kind(): CssTokenKind {
        return this.currentKind;
    }

    /**
     * Source start offset (inclusive) of the current CSS token.
     *
     * @returns The start offset.
     */
    public get start(): number {
        return this.currentStart;
    }

    /**
     * Source end offset (exclusive) of the current CSS token.
     *
     * @returns The end offset.
     */
    public get end(): number {
        return this.currentEnd;
    }

    /**
     * Current parenthesis nesting depth.
     *
     * @returns The parenthesis depth.
     */
    public get depth(): number {
        return this.parenDepth;
    }

    /**
     * Current square bracket nesting depth.
     *
     * @returns The bracket depth.
     */
    public get bracketNesting(): number {
        return this.bracketDepth;
    }

    /**
     * Returns the source string being iterated.
     *
     * @returns The source string.
     */
    public get source(): string {
        return this.tokenizer.source;
    }

    /**
     * Extract the source slice for the current CSS token.
     *
     * @returns The source text of the current token.
     */
    public get value(): string {
        return this.tokenizer.source.slice(
            this.currentStart - this.initialOffset,
            this.currentEnd - this.initialOffset,
        );
    }

    /**
     * Whether we have reached end-of-input.
     *
     * @returns `true` if the cursor is at EOF.
     */
    public isEof(): boolean {
        return this.currentKind === CssTokenKind.Eof;
    }

    /**
     * Reset the cursor with a new source string. Tokenizes immediately.
     *
     * If the internal token buffer is exhausted before the whole source is
     * consumed, it is grown and the source re-tokenized from scratch until the
     * entire input fits or the hard cap is reached. This prevents long
     * selectors from being silently truncated when they exceed the initial
     * buffer capacity.
     *
     * @param source CSS selector string to iterate.
     * @param offset Base offset within a larger source (for error reporting).
     *
     * @throws A `CapacityOverflowError` if the source needs more tokens than
     * the hard cap allows.
     */
    public reset(source: string, offset = 0): void {
        this.initialOffset = offset;

        this.tokenizer.source = source;
        this.tokenizer.offset = 0;
        this.tokenizer.tokenize();

        // If the tokenizer didn't reach the end of the source, its token buffer
        // was exhausted. Grow and retokenize from scratch (offset = 0) until the
        // full source is consumed or we hit the hard cap.
        while (this.tokenizer.offset < source.length) {
            const requested = Math.min(this.tokenizer.types.length * 2, MAX_TOKEN_CAPACITY);
            if (requested <= this.tokenizer.types.length) {
                throw new CapacityOverflowError(REGION_TOKENS, requested, MAX_TOKEN_CAPACITY);
            }
            this.tokenizer.growCapacity(requested);
            this.tokenizer.offset = 0;
            this.tokenizer.tokenize();
        }

        this.pos = 0;
        this.parenDepth = 0;
        this.bracketDepth = 0;
        this.braceDepth = 0;
        this.classify();
    }

    /**
     * Advance to the next CSS token.
     */
    public advance(): void {
        if (this.currentKind === CssTokenKind.Eof) {
            return;
        }

        // Update nesting depth based on current token before advancing
        switch (this.currentKind) {
            case CssTokenKind.OpenParenthesis:
            case CssTokenKind.Function:
                this.parenDepth += 1;
                break;
            case CssTokenKind.CloseParenthesis:
                this.parenDepth -= 1;
                break;
            case CssTokenKind.OpenSquareBracket:
                this.bracketDepth += 1;
                break;
            case CssTokenKind.CloseSquareBracket:
                this.bracketDepth -= 1;
                break;
            case CssTokenKind.OpenCurlyBracket:
                this.braceDepth += 1;
                break;
            case CssTokenKind.CloseCurlyBracket:
                this.braceDepth -= 1;
                break;
            default:
                break;
        }

        this.pos += this.span;
        this.classify();
    }

    /**
     * Skip consecutive whitespace tokens. After this call, the cursor points
     * to the first non-whitespace token (or Eof).
     */
    public skipWhitespace(): void {
        while (this.currentKind === CssTokenKind.Whitespace) {
            this.advance();
        }
    }

    /**
     * Classify the CSS token at the current sub-token position.
     * Sets kind, start, end, and span.
     */
    private classify(): void {
        const {
            types, ends, tokenCount, source,
        } = this.tokenizer;

        if (this.pos >= tokenCount) {
            this.currentKind = CssTokenKind.Eof;
            this.currentStart = source.length + this.initialOffset;
            this.currentEnd = this.currentStart;
            this.span = 0;
            return;
        }

        const startOffset = this.pos > 0 ? ends[this.pos - 1] : 0;
        let len: number;

        // Try classifiers in priority order for CSS selectors.
        // Order matters: Function before Ident, Dimension before Percentage
        // before Number, etc.

        // 1. Function (ident + open-paren) — must check before bare ident
        len = cssFunctionLength(types, this.pos, tokenCount, source, ends, 0);
        if (len > 0) {
            this.currentKind = CssTokenKind.Function;
            this.currentStart = startOffset + this.initialOffset;
            this.currentEnd = ends[this.pos + len - 1] + this.initialOffset;
            this.span = len;
            return;
        }

        // 2. Ident
        len = cssIdentSequenceLength(types, this.pos, tokenCount, source, ends, 0);
        if (len > 0) {
            this.currentKind = CssTokenKind.Ident;
            this.currentStart = startOffset + this.initialOffset;
            this.currentEnd = ends[this.pos + len - 1] + this.initialOffset;
            this.span = len;
            return;
        }

        // 3. String (includes bad-string detection)
        len = cssStringLength(types, this.pos, tokenCount);
        if (len > 0) {
            // Detect bad-string: if the last token in the span is a LineBreak
            const lastType = types[this.pos + len - 1];
            if (lastType === TokenType.LineBreak) {
                this.currentKind = CssTokenKind.BadString;
            } else {
                this.currentKind = CssTokenKind.String;
            }
            this.currentStart = startOffset + this.initialOffset;
            this.currentEnd = ends[this.pos + len - 1] + this.initialOffset;
            this.span = len;
            return;
        }

        // 4. Whitespace
        len = cssWhitespaceLength(types, this.pos, tokenCount);
        if (len > 0) {
            this.currentKind = CssTokenKind.Whitespace;
            this.currentStart = startOffset + this.initialOffset;
            this.currentEnd = ends[this.pos + len - 1] + this.initialOffset;
            this.span = len;
            return;
        }

        // 5. Hash (#ident)
        len = cssHashLength(types, this.pos, tokenCount, source, ends, 0);
        if (len > 0) {
            this.currentKind = CssTokenKind.Hash;
            this.currentStart = startOffset + this.initialOffset;
            this.currentEnd = ends[this.pos + len - 1] + this.initialOffset;
            this.span = len;
            return;
        }

        // 6. At-keyword (@ident)
        len = cssAtKeywordLength(types, this.pos, tokenCount, source, ends, 0);
        if (len > 0) {
            this.currentKind = CssTokenKind.AtKeyword;
            this.currentStart = startOffset + this.initialOffset;
            this.currentEnd = ends[this.pos + len - 1] + this.initialOffset;
            this.span = len;
            return;
        }

        // 7. Dimension (number + ident) — must check before percentage/number
        len = cssDimensionLength(types, this.pos, tokenCount, source, ends, 0);
        if (len > 0) {
            this.currentKind = CssTokenKind.Dimension;
            this.currentStart = startOffset + this.initialOffset;
            this.currentEnd = ends[this.pos + len - 1] + this.initialOffset;
            this.span = len;
            return;
        }

        // 8. Percentage (number + %)
        len = cssPercentageLength(types, this.pos, tokenCount, source, ends, 0);
        if (len > 0) {
            this.currentKind = CssTokenKind.Percentage;
            this.currentStart = startOffset + this.initialOffset;
            this.currentEnd = ends[this.pos + len - 1] + this.initialOffset;
            this.span = len;
            return;
        }

        // 9. Number
        len = cssNumberLength(types, this.pos, tokenCount, source, ends, 0);
        if (len > 0) {
            this.currentKind = CssTokenKind.Number;
            this.currentStart = startOffset + this.initialOffset;
            this.currentEnd = ends[this.pos + len - 1] + this.initialOffset;
            this.span = len;
            return;
        }

        // 10. CDO (<!--)
        len = cssCdoLength(types, this.pos, tokenCount);
        if (len > 0) {
            this.currentKind = CssTokenKind.Cdo;
            this.currentStart = startOffset + this.initialOffset;
            this.currentEnd = ends[this.pos + len - 1] + this.initialOffset;
            this.span = len;
            return;
        }

        // 11. CDC (-->)
        len = cssCdcLength(types, this.pos, tokenCount);
        if (len > 0) {
            this.currentKind = CssTokenKind.Cdc;
            this.currentStart = startOffset + this.initialOffset;
            this.currentEnd = ends[this.pos + len - 1] + this.initialOffset;
            this.span = len;
            return;
        }

        // 12. Comment (/* ... */)
        len = cssCommentLength(types, this.pos, tokenCount);
        if (len > 0) {
            this.currentKind = CssTokenKind.Comment;
            this.currentStart = startOffset + this.initialOffset;
            this.currentEnd = ends[this.pos + len - 1] + this.initialOffset;
            this.span = len;
            return;
        }

        // 13. Trivial single-char tokens (colon, semicolon, comma, parens,
        //     brackets, braces)
        const t = types[this.pos];
        this.currentStart = startOffset + this.initialOffset;
        this.currentEnd = ends[this.pos] + this.initialOffset;
        this.span = 1;

        switch (t) {
            case TokenType.Colon:
                this.currentKind = CssTokenKind.Colon;
                break;
            case TokenType.Semicolon:
                this.currentKind = CssTokenKind.Semicolon;
                break;
            case TokenType.Comma:
                this.currentKind = CssTokenKind.Comma;
                break;
            case TokenType.OpenParen:
                this.currentKind = CssTokenKind.OpenParenthesis;
                break;
            case TokenType.CloseParen:
                this.currentKind = CssTokenKind.CloseParenthesis;
                break;
            case TokenType.OpenSquare:
                this.currentKind = CssTokenKind.OpenSquareBracket;
                break;
            case TokenType.CloseSquare:
                this.currentKind = CssTokenKind.CloseSquareBracket;
                break;
            case TokenType.OpenBrace:
                this.currentKind = CssTokenKind.OpenCurlyBracket;
                break;
            case TokenType.CloseBrace:
                this.currentKind = CssTokenKind.CloseCurlyBracket;
                break;
            default:
                // Everything else is a Delim (single code point not consumed
                // as another token type per CSS Syntax §4.3.1)
                this.currentKind = CssTokenKind.Delim;
                break;
        }
    }
}
