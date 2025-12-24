/* eslint-disable no-bitwise */
import type { TokenType } from './token-types';

/**
 * Efficient token storage buffer using typed arrays.
 * Stores token types and end positions; start positions are derived from previous token's end.
 */
export class TokenBuffer {
    /**
     * Default initial capacity for the token buffer (in tokens).
     */
    private static readonly DEFAULT_CAPACITY = 1024;

    /**
     * Threshold for switching from doubling to 1.5x growth strategy (in tokens).
     * Below this threshold: capacity doubles (2x growth) for fast initial expansion.
     * Above this threshold: capacity grows by 50% (1.5x growth) to avoid excessive memory allocation.
     * This balances performance for small buffers with memory efficiency for large buffers.
     */
    private static readonly GROWTH_THRESHOLD = 65536;

    /**
     * Bit mask for extracting 8-bit token type values.
     */
    private static readonly TYPE_MASK = 0xFF;

    /**
     * Typed array storing token types (8-bit unsigned integers).
     */
    private types: Uint8Array;

    /**
     * Typed array storing token end positions (32-bit unsigned integers).
     */
    private ends: Uint32Array;

    /**
     * Current number of tokens stored in the buffer.
     */
    private tokenCount = 0;

    /**
     * Creates a new token buffer with the specified initial capacity.
     *
     * @param initialCapacity Initial capacity for token storage (default: 1024)
     */
    constructor(initialCapacity = TokenBuffer.DEFAULT_CAPACITY) {
        this.types = new Uint8Array(initialCapacity);
        this.ends = new Uint32Array(initialCapacity);
    }

    /**
     * Get the total number of tokens currently stored in the buffer.
     *
     * @returns Number of tokens in the buffer
     */
    get count(): number {
        return this.tokenCount;
    }

    /**
     * Reset the buffer to empty state without deallocating memory.
     * The capacity remains unchanged for reuse.
     */
    reset(): void {
        this.tokenCount = 0;
    }

    /**
     * Ensure the buffer has capacity for at least the specified number of tokens.
     * Automatically grows the buffer if needed using an efficient growth strategy:
     * - Doubles capacity up to 65536 tokens
     * - Grows by 50% beyond 65536 tokens
     *
     * @param need Minimum required capacity
     */
    private ensureCapacity(need: number): void {
        const cap = this.types.length;
        if (need <= cap) {
            return;
        }

        let newCap = cap === 0 ? 1 : cap;
        while (newCap < need) {
            newCap = newCap < TokenBuffer.GROWTH_THRESHOLD
                ? (newCap << 1)
                : (newCap + (newCap >> 1));
        }

        const newTypes = new Uint8Array(newCap);
        newTypes.set(this.types);

        const newEnds = new Uint32Array(newCap);
        newEnds.set(this.ends);

        this.types = newTypes;
        this.ends = newEnds;
    }

    /**
     * Push a new token to the buffer.
     * Automatically grows the buffer if capacity is exceeded.
     *
     * @param type Token type (will be masked to 8 bits)
     * @param end Token end position (exclusive character index, will be converted to unsigned 32-bit)
     */
    push(type: number, end: number): void {
        const i = this.tokenCount;

        this.ensureCapacity(i + 1);

        this.types[i] = type & TokenBuffer.TYPE_MASK;
        this.ends[i] = end >>> 0;
        this.tokenCount = i + 1;
    }

    /**
     * Get the token type at the specified index.
     *
     * @param i Token index (0-based)
     * @returns Token type value
     */
    typeAt(i: number): TokenType {
        return this.types[i] as TokenType;
    }

    /**
     * Get the end position of the token at the specified index.
     *
     * @param i Token index (0-based)
     * @returns Exclusive end character position in the input string
     */
    endAt(i: number): number {
        return this.ends[i];
    }

    /**
     * Get the start position of the token at the specified index.
     * Start positions are derived: token 0 starts at 0, others start where the previous token ended.
     *
     * @param i Token index (0-based)
     * @returns Inclusive start character position in the input string
     */
    startAt(i: number): number {
        if (i === 0) {
            return 0;
        }

        return this.ends[i - 1];
    }

    /**
     * Get the length of the token at the specified index.
     *
     * @param i Token index (0-based)
     * @returns Token length in characters
     */
    lengthAt(i: number): number {
        return this.endAt(i) - this.startAt(i);
    }
}
