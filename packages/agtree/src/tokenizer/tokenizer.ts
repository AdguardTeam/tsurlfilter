/**
 * @file Chunk tokenizer for AdGuard filter-list source text.
 *
 * {@link Tokenizer} scans a string and writes a flat token stream into two
 * parallel typed arrays ({@link Tokenizer.types} and {@link Tokenizer.ends}).
 * It is designed for performance-critical parsing pipelines:
 *
 * - **Allocation-free after construction** — typed arrays are pre-allocated
 *   once using the caller-supplied `capacity`.
 * - **Reusable** — call {@link Tokenizer.setSource} (or assign `source` /
 *   `offset` directly) and invoke {@link Tokenizer.tokenize} again without
 *   allocating new objects.
 * - **Chunk-aware** — unlike a line-based tokenizer the scanner never stops
 *   at newlines; it emits {@link TokenType.LineBreak} tokens and continues,
 *   which lets callers process whole multi-line sources or arbitrary streaming
 *   chunks in one pass.
 *
 * ### Token encoding
 *
 * After a successful {@link Tokenizer.tokenize} call:
 * - `types[i]` — {@link TokenType} of the i-th token.
 * - `ends[i]` — exclusive end offset of the i-th token in `source`.
 * - The inclusive start of token `i` is `ends[i - 1]` (or `initialOffset`
 *   for the first token).
 * - `tokenCount` — number of valid entries in the arrays.
 * - `offset` — position in `source` at which scanning stopped; equals
 *   `source.length` unless the capacity was exhausted first.
 *
 * ### Dispatch table
 *
 * A single 256-entry `DISPATCH` array (built lazily once per class, stored as
 * a static property) maps every byte value to either an *action code* (0–4)
 * or a *direct {@link TokenType}* (≥ 5):
 *
 * | Value       | Meaning                                       |
 * |-------------|-----------------------------------------------|
 * | 0 (default) | `ACT_SYMBOL` — unrecognised single-char byte  |
 * | 1           | `ACT_WHITESPACE` — run of spaces/tabs         |
 * | 2           | `ACT_NEWLINE` — LF / CR / CRLF                |
 * | 3           | `ACT_BACKSLASH` — escape sequence             |
 * | 4           | `ACT_LETTER` — letter run                     |
 * | 5           | `ACT_DIGIT` — digit run                       |
 * | 6           | `ACT_HYPHEN` — single hyphen (`-`)            |
 * | 7           | `ACT_UNDERSCORE` — single underscore (`_`)    |
 * | 8           | `ACT_NONASCII` — single non-ASCII byte        |
 * | ≥ 10        | Direct {@link TokenType} (single char)        |
 *
 * A separate `IS_IDENT_CHAR` byte map accelerates the inner loop that extends
 * identifier runs.
 */
import {
    CHAR_AND_SIGN,
    CHAR_APOSTROPHE,
    CHAR_ASTERISK,
    CHAR_AT_SIGN,
    CHAR_BACKSLASH,
    CHAR_CARET,
    CHAR_CARRIAGE_RETURN,
    CHAR_CLOSE_BRACE,
    CHAR_CLOSE_PAREN,
    CHAR_CLOSE_SQUARE,
    CHAR_COLON,
    CHAR_COMMA,
    CHAR_DOLLAR_SIGN,
    CHAR_DOT,
    CHAR_EQUALS_SIGN,
    CHAR_EXCLAMATION_MARK,
    CHAR_FORM_FEED,
    CHAR_HASHMARK,
    CHAR_LINE_FEED,
    CHAR_OPEN_BRACE,
    CHAR_OPEN_PAREN,
    CHAR_OPEN_SQUARE,
    CHAR_PERCENT,
    CHAR_PIPE,
    CHAR_PLUS_SIGN,
    CHAR_QUESTION_MARK,
    CHAR_QUOTE,
    CHAR_SEMICOLON,
    CHAR_SLASH,
    CHAR_SPACE,
    CHAR_TAB,
    CHAR_TILDE,
} from './char-codes';
import { TokenType } from './token-types';

// Unified dispatch table: one lookup decides the action for any byte 0–255.
// Values 0–4 are action categories (matching TokenType values by design),
// values ≥ 5 are direct TokenType values for single-char tokens.
// const ACT_SYMBOL = 0;
const ACT_WHITESPACE = 1;
const ACT_NEWLINE = 2;
const ACT_BACKSLASH = 3;
const ACT_LETTER = 4; // [A-Za-z] run → TokenType.Letter (0)
const ACT_DIGIT = 5; // [0-9] run → TokenType.Digit (2)
const ACT_HYPHEN = 6; // single '-' → TokenType.Hyphen (1)
const ACT_UNDERSCORE = 7; // single '_' → TokenType.Underscore (3)
const ACT_NONASCII = 8; // 0x80–0xFF → TokenType.NonAscii (4)
// Direct-emit threshold: action >= 10 → stored value IS the TokenType

/**
 * Chunk tokenizer for AdGuard filter-list source text.
 *
 * @example
 * ```typescript
 * const t = new Tokenizer(1024);
 * t.setSource(source);
 * for (let i = 0; i < t.tokenCount; i++) {
 *     console.log(t.types[i], source.slice(i ? t.ends[i - 1] : 0, t.ends[i]));
 * }
 * ```
 */
export class Tokenizer {
    /**
     * Lazily-initialised dispatch table shared across all instances.
     * Maps byte values 0–255 to action codes (0–4) or direct TokenType values (≥ 5).
     */
    private static DISPATCH?: Uint8Array;

    /**
     * Lazily-initialised letter-character lookup shared across all instances.
     * A non-zero entry means the byte can appear inside a {@link TokenType.Letter} run.
     */
    private static IS_LETTER_CHAR?: Uint8Array;

    /**
     * Source string currently being (or last) tokenized.
     * Assign directly (without calling {@link setSource}) only when you need
     * to set the source without immediately tokenizing, e.g. for a
     * chunked-tokenization loop driven by {@link eof}.
     */
    public source: string;

    /**
     * Current scan position within {@link source}.
     *
     * Before calling {@link tokenize}, set this to the desired start position
     * (0 for the beginning of the string). After {@link tokenize} returns it
     * points to the character immediately after the last consumed token, which
     * is either `source.length` or the position where capacity was exhausted.
     */
    public offset: number;

    /**
     * Maximum number of tokens that {@link types} and {@link ends} can hold.
     * Scanning stops when `tokenCount` reaches this value.
     */
    private capacity: number;

    /**
     * Number of valid token entries written into {@link types} and {@link ends}
     * by the most recent {@link tokenize} call.
     */
    public tokenCount: number;

    /**
     * Parallel array of token type codes.
     * Entry `i` is the {@link TokenType} of the i-th token.
     * Only indices `0 … tokenCount - 1` are valid after {@link tokenize}.
     */
    public types: Uint8Array;

    /**
     * Parallel array of token end offsets (exclusive).
     * Entry `i` is the index in {@link source} just past the last character
     * of the i-th token. The start of token `i` is `ends[i - 1]` (or
     * the initial `offset` for `i === 0`).
     * Only indices `0 … tokenCount - 1` are valid after {@link tokenize}.
     */
    public ends: Uint32Array;

    /**
     * Creates a new tokenizer instance with pre-allocated token buffers.
     *
     * The static dispatch tables are initialised on the first instantiation
     * and reused by all subsequent instances.
     *
     * @param capacity Maximum number of tokens to store per {@link tokenize}
     *   call.  Choose a value large enough for the longest input you expect
     *   to process in a single pass.
     */
    constructor(capacity: number) {
        this.source = '';
        this.offset = 0;
        this.capacity = capacity;

        this.tokenCount = 0;
        this.types = new Uint8Array(capacity);
        this.ends = new Uint32Array(capacity);

        if (!Tokenizer.DISPATCH) {
            const DISPATCH = new Uint8Array(256);

            // Whitespace
            DISPATCH[CHAR_SPACE] = ACT_WHITESPACE;
            DISPATCH[CHAR_TAB] = ACT_WHITESPACE;

            // Newlines
            DISPATCH[CHAR_LINE_FEED] = ACT_NEWLINE;
            DISPATCH[CHAR_CARRIAGE_RETURN] = ACT_NEWLINE;
            DISPATCH[CHAR_FORM_FEED] = ACT_NEWLINE;

            // Backslash
            DISPATCH[CHAR_BACKSLASH] = ACT_BACKSLASH;

            // Letters: [A-Za-z] → ACT_LETTER run
            for (let i = 65; i <= 90; i += 1) {
                DISPATCH[i] = ACT_LETTER;
            }
            for (let i = 97; i <= 122; i += 1) {
                DISPATCH[i] = ACT_LETTER;
            }

            // Digits: [0-9] → ACT_DIGIT run
            for (let i = 48; i <= 57; i += 1) {
                DISPATCH[i] = ACT_DIGIT;
            }

            // Non-ASCII bytes 0x80–0xFF → ACT_NONASCII (handled in switch)
            for (let i = 0x80; i <= 0xFF; i += 1) {
                DISPATCH[i] = ACT_NONASCII;
            }

            // Single-char tokens (all have TokenType ≥ 6)
            DISPATCH[CHAR_SLASH] = TokenType.Slash;
            DISPATCH[CHAR_EQUALS_SIGN] = TokenType.EqualsSign;
            DISPATCH[CHAR_COMMA] = TokenType.Comma;
            DISPATCH[CHAR_OPEN_PAREN] = TokenType.OpenParen;
            DISPATCH[CHAR_CLOSE_PAREN] = TokenType.CloseParen;
            DISPATCH[CHAR_OPEN_BRACE] = TokenType.OpenBrace;
            DISPATCH[CHAR_CLOSE_BRACE] = TokenType.CloseBrace;
            DISPATCH[CHAR_OPEN_SQUARE] = TokenType.OpenSquare;
            DISPATCH[CHAR_CLOSE_SQUARE] = TokenType.CloseSquare;
            DISPATCH[CHAR_PIPE] = TokenType.Pipe;
            DISPATCH[CHAR_AT_SIGN] = TokenType.AtSign;
            DISPATCH[CHAR_ASTERISK] = TokenType.Asterisk;
            DISPATCH[CHAR_QUOTE] = TokenType.Quote;
            DISPATCH[CHAR_APOSTROPHE] = TokenType.Apostrophe;
            DISPATCH[CHAR_EXCLAMATION_MARK] = TokenType.ExclamationMark;
            DISPATCH[CHAR_PLUS_SIGN] = TokenType.PlusSign;
            DISPATCH[CHAR_AND_SIGN] = TokenType.AndSign;
            DISPATCH[CHAR_TILDE] = TokenType.Tilde;
            DISPATCH[CHAR_CARET] = TokenType.Caret;
            DISPATCH[CHAR_DOT] = TokenType.Dot;
            DISPATCH[CHAR_SEMICOLON] = TokenType.Semicolon;
            DISPATCH[CHAR_COLON] = TokenType.Colon;
            DISPATCH[CHAR_HASHMARK] = TokenType.HashMark;
            DISPATCH[CHAR_DOLLAR_SIGN] = TokenType.DollarSign;
            DISPATCH[CHAR_QUESTION_MARK] = TokenType.QuestionMark;
            DISPATCH[CHAR_PERCENT] = TokenType.Percent;
            DISPATCH[45] = ACT_HYPHEN; // `-`
            DISPATCH[95] = ACT_UNDERSCORE; // `_`

            // Letter inner-loop lookup (kept separate — only used inside letter runs)
            const IS_LETTER_CHAR = new Uint8Array(256);
            for (let i = 65; i <= 90; i += 1) {
                IS_LETTER_CHAR[i] = 1;
            }
            for (let i = 97; i <= 122; i += 1) {
                IS_LETTER_CHAR[i] = 1;
            }

            Tokenizer.DISPATCH = DISPATCH;
            Tokenizer.IS_LETTER_CHAR = IS_LETTER_CHAR;
        }
    }

    /**
     * Tokenize {@link source} starting at {@link offset} and write results
     * into {@link types} and {@link ends}.
     *
     * Scanning continues until either the end of the string is reached or
     * {@link tokenCount} would exceed the buffer capacity.  On return:
     * - {@link tokenCount} contains the number of tokens produced.
     * - {@link offset} points to the next un-scanned character (equals
     *   `source.length` when the whole string was consumed).
     *
     * The method intentionally **does not reset** `offset` before running,
     * allowing callers to control the start position and supporting incremental /
     * offset-based tokenization.  `tokenCount` is always reset to 0.  Use
     * {@link setSource} for the common case of tokenizing a new string from
     * the beginning.
     */
    public tokenize(): void {
        let { offset } = this;
        let tokenCount = 0;

        const s = this.source;
        const len = s.length;
        const cap = this.capacity;
        const t = this.types;
        const e = this.ends;
        const dispatch = Tokenizer.DISPATCH!;
        const letter = Tokenizer.IS_LETTER_CHAR!;

        while (offset < len && tokenCount < cap) {
            const c = s.charCodeAt(offset);

            if (c >= 256) {
                t[tokenCount] = TokenType.NonAscii;
                e[tokenCount] = offset + 1;
                tokenCount += 1;
                offset += 1;
                continue;
            }

            const action = dispatch[c];

            // Most frequent: single-char mapped tokens (action ≥ 10)
            if (action >= 10) {
                t[tokenCount] = action;
                e[tokenCount] = offset + 1;
                tokenCount += 1;
                offset += 1;
                continue;
            }

            switch (action) {
                case ACT_LETTER: {
                    offset += 1;
                    while (offset < len) {
                        const cc = s.charCodeAt(offset);
                        if (cc >= 256 || !letter[cc]) {
                            break;
                        }
                        offset += 1;
                    }
                    t[tokenCount] = TokenType.Letter;
                    e[tokenCount] = offset;
                    tokenCount += 1;
                    continue;
                }
                case ACT_DIGIT: {
                    offset += 1;
                    while (offset < len) {
                        const cc = s.charCodeAt(offset);
                        if (cc < 48 || cc > 57) {
                            break;
                        }
                        offset += 1;
                    }
                    t[tokenCount] = TokenType.Digit;
                    e[tokenCount] = offset;
                    tokenCount += 1;
                    continue;
                }
                case ACT_NEWLINE: {
                    const advance = (c === CHAR_CARRIAGE_RETURN
                        && offset + 1 < len
                        && s.charCodeAt(offset + 1) === CHAR_LINE_FEED)
                        ? 2
                        : 1;
                    offset += advance;
                    t[tokenCount] = TokenType.LineBreak;
                    e[tokenCount] = offset;
                    tokenCount += 1;
                    continue;
                }
                case ACT_WHITESPACE: {
                    offset += 1;
                    while (offset < len) {
                        const cc = s.charCodeAt(offset);
                        if (cc !== CHAR_SPACE && cc !== CHAR_TAB) {
                            break;
                        }
                        offset += 1;
                    }
                    t[tokenCount] = TokenType.Whitespace;
                    e[tokenCount] = offset;
                    tokenCount += 1;
                    continue;
                }
                case ACT_HYPHEN: {
                    t[tokenCount] = TokenType.Hyphen;
                    e[tokenCount] = offset + 1;
                    tokenCount += 1;
                    offset += 1;
                    continue;
                }
                case ACT_UNDERSCORE: {
                    t[tokenCount] = TokenType.Underscore;
                    e[tokenCount] = offset + 1;
                    tokenCount += 1;
                    offset += 1;
                    continue;
                }
                case ACT_NONASCII: {
                    t[tokenCount] = TokenType.NonAscii;
                    e[tokenCount] = offset + 1;
                    tokenCount += 1;
                    offset += 1;
                    continue;
                }
                case ACT_BACKSLASH: {
                    if (offset + 1 < len) {
                        t[tokenCount] = TokenType.Escaped;
                        e[tokenCount] = offset + 2;
                        tokenCount += 1;
                        offset += 2;
                    } else {
                        t[tokenCount] = TokenType.Symbol;
                        e[tokenCount] = offset + 1;
                        tokenCount += 1;
                        offset += 1;
                    }
                    continue;
                }
                default: {
                    t[tokenCount] = TokenType.Symbol;
                    e[tokenCount] = offset + 1;
                    tokenCount += 1;
                    offset += 1;
                    continue;
                }
            }
        }

        this.offset = offset;
        this.tokenCount = tokenCount;
    }

    /**
     * Convenience method: assign a new source string, set the scan position
     * to the given offset, and immediately tokenize from that position.
     *
     * Equivalent to:
     * ```typescript
     * tokenizer.source = source;
     * tokenizer.offset = offset;
     * tokenizer.tokenize();
     * ```.
     *
     * @param source The new source string to tokenize.
     * @param offset Character offset to start tokenizing from (default `0`).
     */
    public setSource(source: string, offset = 0): void {
        this.source = source;
        this.offset = offset;
        this.tokenize();
    }

    /**
     * Returns `true` when {@link offset} has reached the end of {@link source},
     * meaning all characters have been consumed by previous {@link tokenize}
     * calls (or the offset was set manually to the string length).
     *
     * Useful for driving a chunked tokenization loop:
     * ```typescript
     * const t = new Tokenizer(CHUNK_CAPACITY);
     * t.source = source;
     * while (!t.eof()) {
     *     t.tokenize();
     *     processTokens(t);
     * }
     * ```.
     *
     * @returns Whether scanning has reached the end of the source string.
     */
    public eof(): boolean {
        return this.offset >= this.source.length;
    }
}
