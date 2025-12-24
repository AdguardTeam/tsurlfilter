import { type TokenBuffer } from './token-buffer';
import { TokenType } from './token-types';

/**
 * Type for cursor state snapshot.
 * Used with pushState/popState for temporary state management.
 */
export type CursorState = {
    /**
     * Current token index
     */
    pos: number;

    /**
     * View start bound (inclusive)
     */
    lo: number;

    /**
     * View end bound (exclusive)
     */
    hi: number;
};

/**
 * Cursor for navigating through a token buffer.
 * Supports windowing (view bounds) and efficient token iteration without string allocation.
 */
export class TokenCursor {
    /**
     * Threshold for character-by-character comparison vs slice comparison.
     * For strings longer than this, slice comparison is more efficient.
     * Empirically determined optimal point for string comparison performance.
     */
    private static readonly CHAR_COMPARE_THRESHOLD = 16;

    /**
     * Maximum depth for state stack.
     */
    private static readonly MAX_STATE_DEPTH = 32;

    /**
     * The input string being tokenized.
     * Mutable to support cursor reuse via reinit().
     */
    input: string;

    /**
     * The token buffer containing all tokens.
     */
    readonly buf: TokenBuffer;

    /**
     * Current cursor position (token index).
     */
    pos: number = 0;

    /**
     * View start bound (inclusive token index).
     */
    lo: number = 0;

    /**
     * View end bound (exclusive token index).
     */
    hi: number;

    /**
     * State stack storage. Each state occupies 3 consecutive slots: [pos, lo, hi].
     */
    private stateStack: Uint32Array;

    /**
     * Current index in state stack (points to next available slot).
     */
    private stackIndex: number = 0;

    constructor(input: string, buf: TokenBuffer) {
        this.input = input;
        this.buf = buf;
        this.hi = buf.count;
        this.stateStack = new Uint32Array(TokenCursor.MAX_STATE_DEPTH * 3);
    }

    /**
     * Check if a token index is within the current view bounds.
     *
     * @param index Token index to check
     * @returns True if index is within [lo, hi), false otherwise
     */
    private isInBounds(index: number): boolean {
        return index >= this.lo && index < this.hi;
    }

    /**
     * True if cursor position has reached or exceeded the end of the view.
     *
     * @returns True when at or past view end, false otherwise
     */
    get atEnd(): boolean {
        return this.pos >= this.hi;
    }

    /**
     * Get the number of tokens remaining from current position to end of view.
     *
     * @returns Number of tokens from current position to view end
     */
    remaining(): number {
        return Math.max(0, this.hi - this.pos);
    }

    /**
     * Get the total number of tokens in the current view.
     *
     * @returns Total token count in view [lo, hi)
     */
    count(): number {
        return Math.max(0, this.hi - this.lo);
    }

    /**
     * Check if the current view is empty.
     *
     * @returns True if view contains no tokens, false otherwise
     */
    isEmpty(): boolean {
        return this.lo >= this.hi;
    }

    /**
     * Reset cursor position to the start of the view.
     */
    reset(): void {
        this.pos = this.lo;
    }

    /**
     * Reinitialize cursor with new input string.
     * Useful for reusing a cursor instance instead of allocating a new one.
     * Resets position to 0 and sets view bounds to the full buffer.
     *
     * @param input New input string to parse
     *
     * @example
     * ```ts
     * const cursor = new TokenCursor('', buffer);
     * for (const line of lines) {
     *     buffer.reset();
     *     tokenize(line, callback);
     *     cursor.reinit(line);
     *     parseRule(cursor);
     * }
     * ```
     */
    reInit(input: string): void {
        this.input = input;
        this.pos = 0;
        this.lo = 0;
        this.hi = this.buf.count;
        this.stackIndex = 0; // Clear state stack
    }

    /**
     * Create an independent copy of this cursor.
     * The clone shares the same input string and token buffer but has independent position and view bounds.
     *
     * @returns New TokenCursor with same input/buffer but independent state
     */
    clone(): TokenCursor {
        const cloned = new TokenCursor(this.input, this.buf);

        cloned.pos = this.pos;
        cloned.lo = this.lo;
        cloned.hi = this.hi;

        return cloned;
    }

    /**
     * Get token type at current position plus offset.
     *
     * @param offset Relative offset from current position (default: 0)
     * @returns Token type, or TokenType.Eof if out of view bounds
     */
    tokenType(offset = 0): TokenType {
        const i = this.pos + offset;

        if (!this.isInBounds(i)) {
            return TokenType.Eof;
        }

        return this.buf.typeAt(i);
    }

    /**
     * Get start character position of token at current position plus offset.
     *
     * @param offset Relative offset from current position (default: 0)
     * @returns Character position in input string, or input.length if out of bounds
     */
    start(offset = 0): number {
        const i = this.pos + offset;

        if (!this.isInBounds(i)) {
            return this.input.length;
        }

        return this.buf.startAt(i);
    }

    /**
     * Get end character position of token at current position plus offset.
     *
     * @param offset Relative offset from current position (default: 0)
     * @returns Character position in input string, or input.length if out of bounds
     */
    end(offset = 0): number {
        const i = this.pos + offset;

        if (!this.isInBounds(i)) {
            return this.input.length;
        }

        return this.buf.endAt(i);
    }

    /**
     * Get length of token at current position plus offset.
     *
     * @param offset Relative offset from current position (default: 0)
     * @returns Length in characters
     */
    length(offset = 0): number {
        return this.end(offset) - this.start(offset);
    }

    /**
     * Get text content of token at current position plus offset.
     * Allocates a new string - use sparingly.
     *
     * @param offset Relative offset from current position (default: 0)
     * @returns Token text as string
     */
    text(offset = 0): string {
        return this.input.slice(this.start(offset), this.end(offset));
    }

    /**
     * Get start character position of token at arbitrary index.
     * Convenience method for accessing buf.startAt() without going through buf.
     *
     * @param tokenIndex Token index to get start position for
     * @returns Start character position
     */
    startAtToken(tokenIndex: number): number {
        return this.buf.startAt(tokenIndex);
    }

    /**
     * Get end character position of token at arbitrary index.
     * Convenience method for accessing buf.endAt() without going through buf.
     *
     * @param tokenIndex Token index to get end position for
     * @returns End character position
     */
    endAtToken(tokenIndex: number): number {
        return this.buf.endAt(tokenIndex);
    }

    /**
     * Get location (start and end positions) for a token range.
     * Returns character positions spanning from start of startTokenIndex to end of endTokenIndex.
     *
     * @param startTokenIndex Starting token index (inclusive)
     * @param endTokenIndex Ending token index (inclusive)
     * @returns Object with start and end character positions
     */
    getLocation(startTokenIndex: number, endTokenIndex: number): { start: number; end: number } {
        return {
            start: this.buf.startAt(startTokenIndex),
            end: this.buf.endAt(endTokenIndex),
        };
    }

    /**
     * Slice text content from start token index to end token index.
     * Uses character positions of tokens, not token positions themselves.
     *
     * @param startTokenIndex Starting token index (inclusive)
     * @param endTokenIndex Ending token index (exclusive), defaults to current view end
     * @returns Sliced text from start of startTokenIndex to start of endTokenIndex
     */
    sliceTokens(startTokenIndex: number, endTokenIndex: number = this.hi): string {
        const startCharPos = this.buf.startAt(startTokenIndex);
        const endCharPos = this.buf.startAt(endTokenIndex);
        return this.input.slice(startCharPos, endCharPos);
    }

    /**
     * Get current token type.
     * Equivalent to tokenType(0).
     *
     * @returns Current token type
     */
    current(): TokenType {
        return this.tokenType(0);
    }

    /**
     * Peek at token type ahead of current position.
     * Equivalent to tokenType(offset).
     *
     * @param offset Number of tokens to look ahead (default: 1)
     * @returns Token type at offset position
     */
    peek(offset = 1): TokenType {
        return this.tokenType(offset);
    }

    /**
     * Peek ahead to the next non-whitespace token.
     * Does not modify cursor position.
     *
     * @param offset Starting offset from current position (default: 1)
     * @param includeLineBreak If true, also skip line breaks (default: false)
     * @returns The first non-whitespace token type found, or Eof if none found
     */
    peekNonWhitespace(offset = 1, includeLineBreak = false): TokenType {
        let i = this.pos + offset;

        while (i < this.hi) {
            const t = this.buf.typeAt(i);
            if (t !== TokenType.Whitespace && (!includeLineBreak || t !== TokenType.LineBreak)) {
                return t;
            }

            i += 1;
        }
        return TokenType.Eof;
    }

    /**
     * Move cursor by n tokens (positive=forward, negative=backward).
     * Position is clamped to view bounds [lo, hi].
     *
     * @param n Number of tokens to move (default: 1)
     */
    advance(n = 1): void {
        this.pos = Math.max(this.lo, Math.min(this.hi, this.pos + n));
    }

    /**
     * Get current token type and advance cursor by 1.
     *
     * @returns Current token type before advancing
     */
    next(): TokenType {
        const t = this.current();
        this.advance(1);
        return t;
    }

    /**
     * Move cursor backward by 1 token.
     * Does not move past view start (lo).
     */
    prev(): void {
        if (this.pos > this.lo) {
            this.pos -= 1;
        }
    }

    /**
     * Set cursor to specific token index.
     * Position is clamped to view bounds [lo, hi].
     * Note: Allows positioning at hi to represent EOF.
     *
     * @param index Target token index
     */
    seek(index: number): void {
        if (index < this.lo) {
            this.pos = this.lo;
        } else if (index > this.hi) {
            this.pos = this.hi;
        } else {
            this.pos = index;
        }
    }

    /**
     * Jump to the end of the current view.
     */
    seekToEnd(): void {
        this.pos = this.hi;
    }

    /**
     * Get text content of entire current view.
     * Useful for getting full line or section text after setting a view.
     *
     * @returns Text from view start to view end, or empty string if view is empty
     */
    viewText(): string {
        if (this.lo >= this.hi) {
            return '';
        }

        const startPos = this.buf.startAt(this.lo);
        const endPos = this.buf.endAt(this.hi - 1);

        return this.input.slice(startPos, endPos);
    }

    /**
     * Check if the view contains a specific token type.
     * Does not modify cursor position.
     *
     * @param tokenType Token type to search for
     * @returns True if token type exists in view, false otherwise
     */
    has(tokenType: TokenType): boolean {
        for (let i = this.lo; i < this.hi; i += 1) {
            if (this.buf.typeAt(i) === tokenType) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if the view contains any of the specified token types.
     * Does not modify cursor position.
     *
     * @param tokenTypes Set of token types to search for
     * @returns True if any of the token types exist in view, false otherwise
     */
    hasAny(tokenTypes: Set<TokenType>): boolean {
        for (let i = this.lo; i < this.hi; i += 1) {
            if (tokenTypes.has(this.buf.typeAt(i))) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if current token matches expected type and advance if so.
     *
     * @param type Expected token type
     * @param throwOnFail If true, throws error when token doesn't match (default: true)
     * @returns True if token matched, false otherwise
     * @throws Error if token doesn't match and throwOnFail is true
     */
    expect(type: TokenType, throwOnFail = true): boolean {
        if (this.current() === type) {
            this.advance(1);
            return true;
        }

        if (throwOnFail) {
            const charPos = this.start();
            const tokenText = this.text();
            throw new Error(
                `Expected token ${type}, got ${this.current()} at tokenIndex=${this.pos} `
                + `(char position ${charPos}, text: "${tokenText}")`,
            );
        }

        return false;
    }

    /**
     * Skip consecutive tokens of the specified type.
     *
     * @param type Token type to skip
     */
    skip(type: TokenType): void {
        while (!this.atEnd && this.current() === type) {
            this.advance(1);
        }
    }

    /**
     * Skip whitespace tokens (and optionally line breaks).
     *
     * @param includeLineBreak If true, also skips line break tokens (default: false)
     */
    skipWhitespace(includeLineBreak = false): void {
        while (!this.atEnd) {
            const t = this.current();
            if (t !== TokenType.Whitespace && (!includeLineBreak || t !== TokenType.LineBreak)) {
                return;
            }
            this.advance(1);
        }
    }

    /**
     * Skip tokens until specified type is found or predicate returns true.
     * Stops at the matching token (does not skip it).
     *
     * @param typeOrPred Token type to find, or predicate function
     */
    skipUntil(typeOrPred: TokenType | ((t: TokenType) => boolean)): void {
        if (typeof typeOrPred === 'number') {
            const target = typeOrPred;
            while (!this.atEnd && this.current() !== target) {
                this.advance(1);
            }
        } else {
            const pred = typeOrPred;
            while (!this.atEnd && !pred(this.current())) {
                this.advance(1);
            }
        }
    }

    /**
     * Skip tokens backward until specified type is found or predicate returns true.
     * Stops at the matching token (does not skip it) or at view start (lo).
     *
     * @param typeOrPred Token type to find, or predicate function
     */
    skipUntilBackwards(typeOrPred: TokenType | ((t: TokenType) => boolean)): void {
        if (typeof typeOrPred === 'number') {
            const target = typeOrPred;
            while (this.pos > this.lo && this.current() !== target) {
                this.prev();
            }
        } else {
            const pred = typeOrPred;
            while (this.pos > this.lo && !pred(this.current())) {
                this.prev();
            }
        }
    }

    /**
     * Check if token text equals a literal string without allocating.
     * More efficient than text(offset) === lit.
     *
     * @param lit Literal string to compare against
     * @param offset Relative offset from current position (default: 0)
     * @returns True if token text matches literal, false otherwise
     */
    textEquals(lit: string, offset = 0): boolean {
        const s = this.start(offset);
        const e = this.end(offset);
        const len = e - s;

        if (len !== lit.length) {
            return false;
        }

        if (len > TokenCursor.CHAR_COMPARE_THRESHOLD) {
            return this.input.slice(s, e) === lit;
        }

        for (let i = 0; i < len; i += 1) {
            if (this.input.charCodeAt(s + i) !== lit.charCodeAt(i)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Set view bounds (window) to restrict cursor operations to a token range.
     * Position is clamped to new bounds if outside.
     *
     * @param lo Start token index (inclusive)
     * @param hi End token index (exclusive)
     * @throws Error if lo > hi after clamping to valid bounds
     */
    setView(lo: number, hi: number): void {
        this.lo = lo < 0 ? 0 : lo;
        this.hi = hi > this.buf.count ? this.buf.count : hi;

        if (this.lo > this.hi) {
            throw new Error(`Invalid view: lo (${this.lo}) > hi (${this.hi})`);
        }

        if (this.pos < this.lo) {
            this.pos = this.lo;
        } else if (this.pos > this.hi) {
            this.pos = this.hi;
        }
    }

    /**
     * Set view to current line from cursor position to next line break or EOF.
     *
     * @param includeLineBreakToken If true, includes the line break token in view (default: false)
     */
    setViewToLineFromHere(includeLineBreakToken = false): void {
        const start = this.pos;
        let i = start;

        while (i < this.hi) {
            const t = this.buf.typeAt(i);
            if (t === TokenType.LineBreak || t === TokenType.Eof) {
                break;
            }
            i += 1;
        }

        const shouldInclude = includeLineBreakToken && i < this.hi && this.buf.typeAt(i) === TokenType.LineBreak;
        const end = shouldInclude ? i + 1 : i;

        this.setView(start, end);
        this.seek(start);
    }

    /**
     * Save current cursor state (position and view bounds) to reusable object.
     * GC-friendly alternative to creating new cursor objects.
     *
     * @param out Object to save state into
     */
    saveState(out: CursorState): void {
        // eslint-disable-next-line no-param-reassign
        out.pos = this.pos;
        // eslint-disable-next-line no-param-reassign
        out.lo = this.lo;
        // eslint-disable-next-line no-param-reassign
        out.hi = this.hi;
    }

    /**
     * Restore cursor state from previously saved state.
     *
     * @param state Saved cursor state to restore
     */
    restoreState(state: CursorState): void {
        this.pos = state.pos;
        this.lo = state.lo;
        this.hi = state.hi;
    }

    /**
     * Push current cursor state onto the internal stack.
     * More efficient than saveState for temporary state management.
     *
     * @throws Error if stack overflow (exceeds MAX_STATE_DEPTH)
     */
    pushState(): void {
        if (this.stackIndex >= TokenCursor.MAX_STATE_DEPTH * 3) {
            throw new Error(`State stack overflow: exceeded maximum depth of ${TokenCursor.MAX_STATE_DEPTH}`);
        }

        this.stateStack[this.stackIndex] = this.pos;
        this.stateStack[this.stackIndex + 1] = this.lo;
        this.stateStack[this.stackIndex + 2] = this.hi;
        this.stackIndex += 3;
    }

    /**
     * Pop and restore cursor state from the internal stack.
     *
     * @returns True if state was restored, false if stack was empty
     */
    popState(): boolean {
        if (this.stackIndex === 0) {
            return false;
        }

        this.stackIndex -= 3;
        this.pos = this.stateStack[this.stackIndex];
        this.lo = this.stateStack[this.stackIndex + 1];
        this.hi = this.stateStack[this.stackIndex + 2];
        return true;
    }

    /**
     * Get current depth of the state stack.
     *
     * @returns Number of saved states on the stack
     */
    stackDepth(): number {
        return this.stackIndex / 3;
    }
}
