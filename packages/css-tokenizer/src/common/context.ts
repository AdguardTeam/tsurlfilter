/**
 * @file Tokenizer context
 */

import { isBOM, isWhitespace } from '../algorithms/definitions';
import { getCodePointsArrayHash } from '../utils/djb2';
import { CodePoint, ImaginaryCodePoint } from './enums/code-points';
import { type TokenType } from './enums/token-types';
import { type OnTokenCallback, type OnErrorCallback, type TokenizerContextFunction } from './types/function-prototypes';

/**
 * Context of the tokenizer which is shared between all the functions
 */
export class TokenizerContext {
    /**
     * Cached source length
     */
    public readonly length: number;

    /**
     * Reference to the `onToken` callback function
     */
    public readonly onToken: OnTokenCallback;

    /**
     * Reference to the `onError` callback function
     */
    public readonly onError: OnErrorCallback;

    /**
     * Unicode code points of the source string
     *
     * @note The last code point is always EOF ("imaginary" code point)
     * @note Using `!` is safe here because the `preprocess` function always sets the codes in the constructor
     * @note We need a signed 32-bit integer array, because the code points are 21-bit integers + imaginary code points
     * are negative numbers
     */
    private codes!: Int32Array;

    /**
     * Actual position in the source string
     */
    private cursor: number;

    /**
     * Custom function handlers to handle special functions, like Extended CSS's pseudo selectors
     */
    private customFunctionHandlers?: Map<number, TokenizerContextFunction>;

    /**
     * Constructs a new tokenizer context instance
     *
     * @param source Source string
     * @param onToken Callback function to call when a token is found
     * @param onError Callback function to call when a parsing error occurs
     * @param functionHandlers Custom function handlers to handle special functions, like Extended CSS's pseudo
     * selectors
     */
    constructor(
        source: string,
        onToken: OnTokenCallback,
        onError: OnErrorCallback,
        functionHandlers?: Map<number, TokenizerContextFunction>,
    ) {
        // Set the source and offset
        // this.source = source;
        this.length = source.length;

        this.preprocess(source);

        // Ignore BOM character if present
        this.cursor = isBOM(this.codes[0]) ? 1 : 0;

        // Set the callback functions
        this.onToken = onToken;
        this.onError = onError;

        // Register custom function handlers, if any
        if (functionHandlers) {
            this.customFunctionHandlers = new Map();

            for (const [hash, handler] of functionHandlers) {
                this.customFunctionHandlers.set(hash, handler);
            }
        }
    }

    /**
     * § 3.3. Preprocessing the input stream
     *
     * @param source Source string to preprocess
     * @see {@link https://www.w3.org/TR/css-syntax-3/#input-preprocessing}
     */
    private preprocess(source: string): void {
        const len = source.length;
        this.codes = new Int32Array(len + 1); // add +1 slot for the EOF "code point"

        // TODO: Uncomment when needed - actually, we don't convert the CRLF to LF to keep the original source positions
        // // The input stream consists of the filtered code points pushed into it as the input byte stream is decoded.
        // for (let i = 0; i < len; i += 1) {
        //     const code = source.charCodeAt(i);

        //     // To filter code points from a stream of (unfiltered) code points input:
        //     switch (code) {
        //         // Replace any U+000D CARRIAGE RETURN (CR) code points, U+000C FORM FEED (FF) code points, or pairs
        //         // of U+000D CARRIAGE RETURN (CR) followed by U+000A LINE FEED (LF) in input by a single
        //         // U+000A LINE FEED (LF) code point.
        //         case CodePoint.CarriageReturn:
        //             if (source.charCodeAt(i + 1) === CodePoint.LineFeed) {
        //                 this.codes[i] = CodePoint.LineFeed;

        //                 // Skip the next code point
        //                 i += 1;
        //                 break;
        //             }

        //             this.codes[i] = CodePoint.LineFeed;
        //             break;

        //         case CodePoint.FormFeed:
        //             this.codes[i] = CodePoint.LineFeed;
        //             break;

        //         // Replace any U+0000 NULL or surrogate code points in input with U+FFFD REPLACEMENT CHARACTER (�).
        //         case CodePoint.Null:
        //             this.codes[i] = CodePoint.ReplacementCharacter;
        //             break;

        //         default:
        //             this.codes[i] = code;
        //             break;
        //     }
        // }

        // Everything what we need here is to transform the ASCII source to Unicode code points as fast as possible
        for (let i = 0; i < len; i += 1) {
            this.codes[i] = source.charCodeAt(i);
        }

        // Set last code point to EOF (this way we can use it in switch-case statements, which are faster than if-else
        // or classic lookup tables)
        // See https://stackoverflow.com/a/37955539
        this.codes[len] = ImaginaryCodePoint.Eof;
    }

    /**
     * Gets the corresponding custom function handler for the given function name hash
     *
     * @param hash Function name hash
     * @returns Corresponding custom function handler or `undefined` if not found
     */
    public getFunctionHandler(hash: number): TokenizerContextFunction | undefined {
        return this.customFunctionHandlers?.get(hash);
    }

    /**
     * Checks if the custom function handler is registered for the given function name hash
     *
     * @param hash Custom function name hash
     * @returns `true` if the custom function handler is registered, `false` otherwise
     */
    public hasFunctionHandler(hash: number): boolean {
        return this.customFunctionHandlers?.has(hash) ?? false;
    }

    /**
     * Returns the current offset
     *
     * @returns Current offset
     */
    get offset(): number {
        return this.cursor;
    }

    /**
     * Returns the code point at the current offset
     *
     * @returns Code point at the current offset
     */
    get code(): number | undefined {
        return this.codes[this.offset];
    }

    /**
     * Returns the code point at the previous offset
     *
     * @returns Code point at the previous offset or `undefined` if the offset is out of bounds
     */
    get prevCode(): number | undefined {
        return this.codes[this.offset - 1];
    }

    /**
     * Returns the code point at the next offset
     *
     * @returns Code point at the next offset or `undefined` if the offset is out of bounds
     */
    get nextCode(): number | undefined {
        return this.codes[this.offset + 1];
    }

    /**
     * Returns the code point at the given relative offset
     *
     * @param relativeOffset Relative offset
     * @returns Code point at the relative offset or `undefined` if the offset is out of bounds
     * @note Relative offset compared to the current offset. 1 means the next code point, -1 means the previous code
     * point, 2 means the code point after the next code point, etc.
     */
    public getRelativeCode(relativeOffset: number): number | undefined {
        return this.codes[this.offset + relativeOffset];
    }

    /**
     * Check if the current offset is at the end of the source (or past it)
     *
     * @returns `true` if the current offset is at the end of the source, `false` otherwise
     */
    public isEof(): boolean {
        return this.offset >= this.length;
    }

    /**
     * Check if the next code point is EOF
     *
     * @returns `true` if the next code point is EOF, `false` otherwise
     */
    public isNextEof(): boolean {
        return this.cursor + 1 === this.length;
    }

    /**
     * Check if the current offset is less than or equal to the end of the source
     *
     * @returns `true` if the current offset is less than or equal to the end of the source, `false` otherwise
     */
    public isLessThanEqualToEof(): boolean {
        return this.offset <= this.length;
    }

    /**
     * Consumes the given number of code points
     *
     * @param n Number of code points to consume (default: 1)
     * @note Negative numbers are allowed (they will move the cursor backwards)
     * @note No protection against out of bounds for performance reasons
     */
    public consumeCodePoint(n = 1): void {
        this.cursor += n;
    }

    /**
     * Finds the next non-whitespace code point and returns it
     *
     * @returns Next non-whitespace code point or EOF imaginary code point if the rest of the source is whitespace
     */
    public getNextNonWsCode(): number {
        let i = this.cursor;

        while (i < this.length && isWhitespace(this.codes[i])) {
            i += 1;
        }

        return this.codes[i];
    }

    /**
     * Consumes the whitespace code points
     */
    public consumeWhitespace(): void {
        while (this.code && isWhitespace(this.code)) {
            this.consumeCodePoint();
        }
    }

    /**
     * Consumes a single whitespace code point, if the current code point is a whitespace
     */
    public consumeSingleWhitespace(): void {
        if (isWhitespace(this.code)) {
            // special case: consume CRLF as a single whitespace
            this.cursor += this.code === CodePoint.CarriageReturn && this.nextCode === CodePoint.LineFeed ? 2 : 1;
        }
    }

    /**
     * Consumes everything until the end of the comment (or the end of the source)
     */
    public consumeUntilCommentEnd(): void {
        // search for the end of the comment or reach the end of the source
        while (this.cursor < this.length) {
            // check if the current code point is a *
            if (this.code === CodePoint.Asterisk && this.nextCode === CodePoint.Solidus) {
                // consume '*/' and exit the loop
                this.cursor += 2;
                break;
            }

            // consume the current code point, it seems it's a part of the comment
            this.cursor += 1;
        }
    }

    /**
     * Consumes a single-character token (trivial token) and reports it via the `onToken` callback
     *
     * @param tokenType Token type to report
     */
    public consumeTrivialToken(tokenType: TokenType): void {
        // eslint-disable-next-line no-plusplus
        this.onToken(tokenType, this.cursor, ++this.cursor);
    }

    /**
     * Calculates the hash of the fragment from the given start offset to the current offset. This is useful to
     * fast-check function names.
     *
     * @param start Start offset
     * @returns Calculated hash
     */
    public getHashFrom(start: number): number {
        return getCodePointsArrayHash(this.codes, start, this.cursor);
    }
}
