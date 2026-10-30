/**
 * @file Encapsulated typed reader over the network-rule structural data.
 *
 * Keeps ctx.data layout internal — consumers use semantic getters only.
 */

import type { ParserContext } from '../context';

import {
    MODIFIER_FIELD_FLAGS,
    MODIFIER_FIELD_NAME_END,
    MODIFIER_FIELD_NAME_START,
    MODIFIER_FIELD_VALUE_END,
    MODIFIER_FIELD_VALUE_START,
    MODIFIER_FLAG_NEGATED,
    MODIFIER_RECORD_STRIDE,
    NO_VALUE,
    NR_FLAG_EXCEPTION,
    NR_FLAGS_OFFSET,
    NR_MODIFIER_COUNT_OFFSET,
    NR_MODIFIER_RECORDS_OFFSET,
    NR_PATTERN_END_OFFSET,
    NR_PATTERN_START_OFFSET,
} from './constants';

/**
 * Read-only view over the structural data of a single network rule.
 *
 * **Borrowed-buffer lifetime**: a reader retains the original rule source
 * string and aliases the pipeline's mutable `ctx.data` buffer. It is valid
 * only until the pipeline that produced it parses another rule or its context
 * is otherwise invalidated (`reset`, a subsequent `parse`/`parseStructural`).
 * After that point, getters may return slices unrelated to the original rule.
 * Consumers must read all fields and discard the reader before reusing the
 * pipeline.
 */
export class NetworkRuleDataReader {
    /**
     * Original rule source string.
     */
    private readonly source: string;

    /**
     * Structural data buffer.
     */
    private readonly data: Int32Array;

    /**
     * Offset within `data` where this rule's record starts.
     */
    private readonly base: number;

    /**
     * Creates a network-rule reader bound to a populated parser context.
     *
     * @param ctx Parser context whose structural data is populated.
     * @param dataOffset Offset within `ctx.data` where this rule's record starts.
     */
    constructor(ctx: ParserContext, dataOffset = 0) {
        this.source = ctx.source;
        this.data = ctx.data;
        this.base = dataOffset;
    }

    /**
     * Whether the rule is an exception (`@@`) rule.
     *
     * @returns True for exception (`@@`) rules.
     */
    public get exception(): boolean {
        return (this.data[this.base + NR_FLAGS_OFFSET] & NR_FLAG_EXCEPTION) !== 0;
    }

    /**
     * Reads the rule pattern from the source slice.
     *
     * @returns The rule pattern (may be empty).
     */
    public getPattern(): string {
        const start = this.data[this.base + NR_PATTERN_START_OFFSET];
        const end = this.data[this.base + NR_PATTERN_END_OFFSET];
        return start < 0 || end < 0 ? '' : this.source.slice(start, end);
    }

    /**
     * Number of modifiers carried by the rule.
     *
     * @returns Number of modifiers.
     */
    public get modifierCount(): number {
        return this.data[this.base + NR_MODIFIER_COUNT_OFFSET];
    }

    /**
     * Computes the record base offset for the given modifier index.
     *
     * @param i Modifier index.
     *
     * @returns Record base offset for the given modifier.
     */
    private recordBase(i: number): number {
        return this.base + NR_MODIFIER_RECORDS_OFFSET + i * MODIFIER_RECORD_STRIDE;
    }

    /**
     * Reads the name of the modifier at the given index.
     *
     * @param i Modifier index.
     *
     * @returns Modifier name.
     */
    public getModifierName(i: number): string {
        const rb = this.recordBase(i);
        return this.source.slice(
            this.data[rb + MODIFIER_FIELD_NAME_START],
            this.data[rb + MODIFIER_FIELD_NAME_END],
        );
    }

    /**
     * Reads the value of the modifier at the given index.
     *
     * @param i Modifier index.
     *
     * @returns Modifier value or null when absent.
     */
    public getModifierValue(i: number): string | null {
        const rb = this.recordBase(i);
        const start = this.data[rb + MODIFIER_FIELD_VALUE_START];
        const end = this.data[rb + MODIFIER_FIELD_VALUE_END];
        if (start === NO_VALUE || end === NO_VALUE) {
            return null;
        }
        return this.source.slice(start, end);
    }

    /**
     * Whether the modifier at the given index is negated.
     *
     * @param i Modifier index.
     *
     * @returns True when the modifier is negated (`~`).
     */
    public isModifierNegated(i: number): boolean {
        const rb = this.recordBase(i);
        return (this.data[rb + MODIFIER_FIELD_FLAGS] & MODIFIER_FLAG_NEGATED) !== 0;
    }
}
