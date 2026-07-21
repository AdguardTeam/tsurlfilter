/**
 * @file FilterListScanner — chunked structural scanning of filter lists.
 *
 * Tokenizes the source in chunks, finds rule boundaries via
 * `TokenType.LineBreak` tokens, and runs the structural parser for each
 * complete rule. Invokes a callback with the populated `ParserContext`.
 *
 * Zero heap allocation during scanning — only the callback may allocate.
 */

/* eslint-disable no-bitwise */

import type { ParserCapacity } from '../ast-builder/capacity';
import { CapacityOverflowError, REGION_TOKENS } from '../errors/capacity-overflow-error';
import type { CapacityRegion } from '../errors/capacity-overflow-error';
import {
    MAX_DOMAIN_CAPACITY,
    MAX_MODIFIER_CAPACITY,
    MAX_SCRIPTLET_BODY_CAPACITY,
    MAX_TOKEN_CAPACITY,
} from '../limits';
import {
    createParserContext,
    CTX_STATUS_HARD_CAP,
    CTX_STATUS_OK,
    CTX_STATUS_OVERFLOW,
    initParserContext,
    resetCtxData,
} from '../parser/context';
import type { ParserContext } from '../parser/context';
import type { RuleParserOptions } from '../parser/options';
import type { RuleKind } from '../parser/rule';
import { RuleParser } from '../parser/rule';
import { TokenType } from '../tokenizer/token-types';
import { Tokenizer } from '../tokenizer/tokenizer';

/**
 * Error message used when the data buffer (modifiers / domains / scriptlet
 * body) overflows at current capacity and `grow` is `false`.
 */
const ERR_DATA_BUFFER_OVERFLOW = 'Parser data buffer overflow: rule too large for current capacity';

/**
 * Most rules are 5–50 tokens; 2048 fits ~40–100 complete rules per chunk.
 */
const DEFAULT_TOKEN_CAPACITY = 2048;

/**
 * Hard upper limit on token buffer growth.
 * A single rule using more tokens than this is considered malformed and is
 * reported as an error without emitting a partial-rule callback.
 */
const HARD_TOKEN_CAP = 262_144;

/**
 * Default modifier capacity per rule.
 */
const DEFAULT_ITEM_CAPACITY = 64;

/**
 * Default domain capacity per rule.
 */
const DEFAULT_DOMAIN_CAPACITY = 128;

/**
 * Callback type for the scanner.
 *
 * @param kind Structural classification of the rule.
 * @param ruleStart Source offset where rule text starts (inclusive).
 * @param ruleEnd Source offset where rule text ends (exclusive of newline).
 * @param ctx Parser context with `ctx.data` populated for this rule.
 *   Only valid during the callback — will be overwritten on the next rule.
 */
export type ScanCallback = (
    kind: RuleKind,
    ruleStart: number,
    ruleEnd: number,
    ctx: ParserContext,
) => void;

/**
 * Callback type for empty lines.
 *
 * @param ruleStart Source offset where the empty line starts.
 * @param ruleEnd Source offset where the empty line ends.
 */
export type EmptyLineCallback = (ruleStart: number, ruleEnd: number) => void;

/**
 * Callback type for rule-level structural parse errors.
 *
 * Called when `RuleParser.parse()` throws for a rule. The rule's source range
 * is passed so the caller can construct an `InvalidRule` node.
 *
 * @param error The thrown error.
 * @param ruleStart Source offset where the rule starts.
 * @param ruleEnd Source offset where the rule ends (exclusive of newline).
 */
export type ScanErrorCallback = (
    error: unknown,
    ruleStart: number,
    ruleEnd: number,
) => void;

/**
 * Scan forward from `offset` in `source` to find the next line-break.
 *
 * @param source Source string.
 * @param offset Position to start searching from.
 *
 * @returns Tuple `[ruleEnd, nextStart]`:
 *   - `ruleEnd` — source offset of the newline character (`source.length` if none).
 *   - `nextStart` — source offset immediately after the newline (`source.length` if none).
 */
function findNextNewline(
    source: string,
    offset: number,
): [ruleEnd: number, nextStart: number] {
    const len = source.length;
    for (let i = offset; i < len; i += 1) {
        const c = source.charCodeAt(i);
        if (c === 0x0A) {
            return [i, i + 1];
        }
        if (c === 0x0D) {
            if (i + 1 < len && source.charCodeAt(i + 1) === 0x0A) {
                return [i, i + 2];
            }
            return [i, i + 1];
        }
    }
    return [len, len];
}

/**
 * FilterListScanner — scans a filter list source structurally without
 * building AST nodes.
 *
 * Owns a `Tokenizer` and `ParserContext`, processes the source in chunks,
 * and invokes a callback for each rule with `ctx.data` populated.
 *
 * @example
 * ```typescript
 * const scanner = new FilterListScanner();
 * scanner.scan(source, (info, ctx) => {
 *     console.log(info.kind, info.ruleStart, info.ruleEnd);
 * }, () => {});
 * ```
 */
export class FilterListScanner {
    /**
     * Tokenizer instance (small-capacity chunk buffer).
     */
    private tokenizer: Tokenizer;

    /**
     * Parser context (standard single-rule capacity, reused per rule).
     */
    private ctx: ParserContext;

    /**
     * Whether buffers may grow dynamically.
     */
    private grow: boolean;

    /**
     * Default token capacity for reset().
     */
    private defaultTokenCap: number;

    /**
     * Default item (modifier) capacity for reset().
     */
    private defaultItemCap: number;

    /**
     * Default domain capacity for reset().
     */
    private defaultDomainCap: number;

    /**
     * Default scriptlet body capacity for reset().
     */
    private defaultScriptletCap: number;

    /**
     * Creates a new filter list scanner.
     *
     * @param capacity Optional capacity configuration.
     */
    constructor(capacity?: ParserCapacity) {
        const tokenCap = capacity?.tokenCapacity ?? DEFAULT_TOKEN_CAPACITY;
        const itemCap = capacity?.itemCapacity ?? DEFAULT_ITEM_CAPACITY;
        const domainCap = capacity?.secondaryCapacity ?? DEFAULT_DOMAIN_CAPACITY;
        this.grow = capacity?.grow ?? true;
        this.defaultTokenCap = tokenCap;
        this.defaultItemCap = itemCap;
        this.defaultDomainCap = domainCap;
        this.tokenizer = new Tokenizer(tokenCap);
        this.ctx = createParserContext(tokenCap, itemCap, domainCap, undefined, this.grow);
        this.defaultScriptletCap = this.ctx.maxScriptletBody;
    }

    /**
     * Check if a token range contains only whitespace tokens (or is empty).
     *
     * @param startTi Start token index (inclusive).
     * @param endTi End token index (exclusive).
     *
     * @returns `true` if the range is empty or all tokens are whitespace.
     */
    private isEmptyRange(startTi: number, endTi: number): boolean {
        const { types } = this.tokenizer;
        for (let i = startTi; i < endTi; i += 1) {
            if (types[i] !== TokenType.Whitespace) {
                return false;
            }
        }
        return true;
    }

    /**
     * Scan all rules in a filter list source string.
     *
     * For each rule:
     * 1. Tokenizes a chunk (reuses buffer)
     * 2. Runs the structural parser (populates `ctx.data`)
     * 3. Invokes `onRule(info, ctx)` — caller reads `ctx.data` NOW.
     * 4. `ctx.data` is overwritten on the next rule.
     *
     * Empty lines invoke `onEmptyLine` instead of `onRule`.
     * Structural parse errors invoke `onRuleError` when provided; otherwise
     * they propagate as exceptions.
     *
     * @param source Full filter list source string.
     * @param onRule Callback for each non-empty rule.
     * @param onEmptyLine Callback for each empty line.
     * @param onRuleError Optional callback for structural parse errors per rule.
     * @param options Structural parser options forwarded per-rule.
     */
    public scan(
        source: string,
        onRule: ScanCallback,
        onEmptyLine: EmptyLineCallback,
        onRuleError?: ScanErrorCallback,
        options?: RuleParserOptions,
    ): void {
        const t = this.tokenizer;
        const { ctx } = this;

        t.source = source;

        // Source offset of the start of the first rule in each chunk.
        let pendingRuleSourceStart = 0;

        for (;;) {
            // Tokenize a chunk starting from pendingRuleSourceStart.
            t.offset = pendingRuleSourceStart;
            t.tokenize();

            // Bind tokenizer output to ctx.
            initParserContext(ctx, source, t, pendingRuleSourceStart);

            // Index of the first token of the current (pending) rule within
            // this chunk's token array.
            let ruleStartTi = 0;

            // Token index of the last LineBreak seen in this chunk (-1 = none).
            let lastLineBreakTi = -1;

            // Compute the source offset of a token's start.
            // Token 0 starts at pendingRuleSourceStart; others start at ends[i-1].
            // eslint-disable-next-line @typescript-eslint/no-loop-func
            const tokenSourceStart = (ti: number): number => (
                ti === 0 ? pendingRuleSourceStart : t.ends[ti - 1]
            );

            // Process all complete rules in this chunk.
            for (let i = 0; i < t.tokenCount; i += 1) {
                if (t.types[i] !== TokenType.LineBreak) {
                    continue;
                }

                // Found a LineBreak at token index i.
                // Rule tokens are [ruleStartTi, i).

                const nlStart = tokenSourceStart(i);

                const ruleSourceStart = tokenSourceStart(ruleStartTi);
                // Rule text ends just before the newline.
                const ruleSourceEnd = nlStart;

                if (ruleStartTi >= i || this.isEmptyRange(ruleStartTi, i)) {
                    onEmptyLine(ruleSourceStart, ruleSourceEnd);
                } else {
                    try {
                        ctx.status = CTX_STATUS_OK;
                        const kind = RuleParser.parse(ctx, ruleStartTi, i, 0, options);
                        const overflowErr = FilterListScanner.checkCtxStatus(ctx);
                        if (overflowErr !== null) {
                            if (onRuleError) {
                                onRuleError(overflowErr, ruleSourceStart, ruleSourceEnd);
                            } else {
                                throw overflowErr;
                            }
                        } else {
                            onRule(kind, ruleSourceStart, ruleSourceEnd, ctx);
                        }
                    } catch (e: unknown) {
                        if (onRuleError) {
                            onRuleError(e, ruleSourceStart, ruleSourceEnd);
                        } else {
                            throw e;
                        }
                    }
                }

                ruleStartTi = i + 1;
                lastLineBreakTi = i;
            }

            // After processing all LineBreaks in the chunk, check if we've
            // consumed the entire source.
            if (t.offset >= source.length) {
                // Handle the last rule (no trailing newline).
                if (ruleStartTi < t.tokenCount) {
                    const ruleSourceStart = tokenSourceStart(ruleStartTi);
                    const ruleSourceEnd = t.ends[t.tokenCount - 1];

                    if (this.isEmptyRange(ruleStartTi, t.tokenCount)) {
                        onEmptyLine(ruleSourceStart, ruleSourceEnd);
                    } else {
                        try {
                            ctx.status = CTX_STATUS_OK;
                            const kind = RuleParser.parse(ctx, ruleStartTi, t.tokenCount, 0, options);
                            const overflowErr = FilterListScanner.checkCtxStatus(ctx);
                            if (overflowErr !== null) {
                                if (onRuleError) {
                                    onRuleError(overflowErr, ruleSourceStart, ruleSourceEnd);
                                } else {
                                    throw overflowErr;
                                }
                            } else {
                                onRule(kind, ruleSourceStart, ruleSourceEnd, ctx);
                            }
                        } catch (e: unknown) {
                            if (onRuleError) {
                                onRuleError(e, ruleSourceStart, ruleSourceEnd);
                            } else {
                                throw e;
                            }
                        }
                    }
                } else if (lastLineBreakTi >= 0 && lastLineBreakTi === t.tokenCount - 1) {
                    // Source ends with a newline — emit trailing empty line.
                    const emptyStart = t.ends[lastLineBreakTi];
                    onEmptyLine(emptyStart, emptyStart);
                }
                break;
            }

            // Buffer exhausted mid-source. Advance to the next chunk.
            if (lastLineBreakTi >= 0) {
                // At least one complete rule was found. The next chunk starts
                // right after the last LineBreak token.
                pendingRuleSourceStart = t.ends[lastLineBreakTi];
            } else if (this.grow) {
                // No LineBreak found in this entire chunk — we have a single
                // rule that is larger than the token buffer. Buffer may grow.
                const newCap = Math.min(t.types.length * 2, HARD_TOKEN_CAP);
                if (newCap > t.types.length) {
                    // Grow and retry from the same position.
                    t.growCapacity(newCap);
                    // pendingRuleSourceStart stays the same; loop continues.
                } else {
                    // Hard cap reached — skip forward to the next newline and
                    // report the entire span as one error. Never emit a partial
                    // rule callback, which would violate the one-callback-per-
                    // physical-line contract.
                    const [ruleEnd, nextStart] = findNextNewline(source, t.offset);
                    // eslint-disable-next-line max-len
                    const e = new Error(`Rule at offset ${pendingRuleSourceStart} exceeds the maximum token capacity of ${HARD_TOKEN_CAP} tokens`);
                    if (onRuleError) {
                        onRuleError(e, pendingRuleSourceStart, ruleEnd);
                    } else {
                        throw e;
                    }
                    pendingRuleSourceStart = nextStart;
                }
            } else {
                // No LineBreak found and growth disabled — skip forward to the
                // next newline and report the entire span as one error. Never
                // emit a partial rule callback.
                const [ruleEnd, nextStart] = findNextNewline(source, t.offset);
                const e = new Error(
                    `Rule at offset ${pendingRuleSourceStart} exceeds the token capacity of ${t.types.length} tokens`,
                );
                if (onRuleError) {
                    onRuleError(e, pendingRuleSourceStart, ruleEnd);
                } else {
                    throw e;
                }
                pendingRuleSourceStart = nextStart;
            }
        }
    }

    /**
     * Return the hard cap for a given capacity region.
     *
     * @param region The capacity region.
     *
     * @returns The hard cap for the region.
     */
    private static hardCapForRegion(region: CapacityRegion): number {
        switch (region) {
            case 'tokens': return MAX_TOKEN_CAPACITY;
            case 'modifiers': return MAX_MODIFIER_CAPACITY;
            case 'domains': return MAX_DOMAIN_CAPACITY;
            case 'scriptletBody': return MAX_SCRIPTLET_BODY_CAPACITY;
            default: return MAX_TOKEN_CAPACITY;
        }
    }

    /**
     * Check `ctx.status` after a `RuleParser.parse()` call and convert any
     * overflow condition into an `Error` (or `CapacityOverflowError`).
     *
     * Resets `ctx.status` and `ctx.overflowRegion` before returning so the
     * context is safe to reuse for the next rule.
     *
     * @param ctx The parser context to inspect.
     *
     * @returns `null` when the parse was clean; an `Error` instance when an
     *   overflow was detected.
     */
    private static checkCtxStatus(ctx: ParserContext): Error | null {
        if (ctx.status === CTX_STATUS_HARD_CAP) {
            const { overflowRegion } = ctx;
            // eslint-disable-next-line no-param-reassign
            ctx.status = CTX_STATUS_OK;
            // eslint-disable-next-line no-param-reassign
            ctx.overflowRegion = undefined;
            const region: CapacityRegion = overflowRegion ?? REGION_TOKENS;
            const hardCap = FilterListScanner.hardCapForRegion(region);
            return new CapacityOverflowError(region, hardCap + 1, hardCap);
        }
        if (ctx.status === CTX_STATUS_OVERFLOW) {
            // eslint-disable-next-line no-param-reassign
            ctx.status = CTX_STATUS_OK;
            return new Error(ERR_DATA_BUFFER_OVERFLOW);
        }
        return null;
    }

    /**
     * Release any extra memory grown during previous scans.
     * Shrinks all buffers back to constructor-time defaults.
     */
    public reset(): void {
        this.tokenizer.reset();
        if (this.tokenizer.types.length < this.defaultTokenCap) {
            this.tokenizer.growCapacity(this.defaultTokenCap);
        }
        resetCtxData(
            this.ctx,
            this.defaultItemCap,
            this.defaultDomainCap,
            this.defaultScriptletCap,
        );
    }
}
