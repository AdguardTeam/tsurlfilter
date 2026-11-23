/* eslint-disable no-param-reassign */

/**
 * @file Parser context — shared state passed through the parser chain.
 *
 * All parsers (network-rule → modifier-list → modifier → value) operate
 * on the same context. This avoids parameter threading and keeps the
 * chaining ergonomic while staying allocation-free.
 */

import type { CapacityRegion, GrowableRegion } from '../errors/capacity-overflow-error';
import { REGION_DOMAINS, REGION_MODIFIERS, REGION_SCRIPTLET_BODY } from '../errors/capacity-overflow-error';
import { MAX_DOMAIN_CAPACITY, MAX_MODIFIER_CAPACITY, MAX_SCRIPTLET_BODY_CAPACITY } from '../limits';
import { TokenType } from '../tokenizer/token-types';
import type { Tokenizer } from '../tokenizer/tokenizer';

import {
    CR_MODIFIER_RECORDS_OFFSET,
    slDataOffset as crSlDataOffset,
    SCRIPTLET_BODY_DATA_CAPACITY,
    UBO_MODIFIER_RECORD_STRIDE,
} from './cosmetic/constants';
import { SL_MIN_DATA_SLOTS } from './css/selector-list/constants';
import { MODIFIER_RECORD_STRIDE, NR_MODIFIER_RECORDS_OFFSET } from './network/constants';

/**
 * Parse status: success — structural data in `data` is complete.
 */
export const CTX_STATUS_OK = 0;

/**
 * Parse status: recoverable overflow (`grow === false`). A structural parser
 * ran out of buffer capacity. The data already written remains usable but is
 * truncated.
 */
export const CTX_STATUS_OVERFLOW = 1;

/**
 * Parse status: hard-cap overflow. Growth required would exceed the module
 * hard cap. The pipeline parser will throw {@link CapacityOverflowError}
 * and clear this to {@link CTX_STATUS_OK}.
 */
export const CTX_STATUS_HARD_CAP = 2;

/**
 * Maximum modifier record stride across all rule types.
 * Network/ADG cosmetic modifiers use stride 5, uBO uses stride 7.
 * Domain records start after maxMods * MAX_MODIFIER_RECORD_STRIDE to
 * guarantee no overlap regardless of which modifier type is stored.
 */
export const MAX_MODIFIER_RECORD_STRIDE = Math.max(
    MODIFIER_RECORD_STRIDE,
    UBO_MODIFIER_RECORD_STRIDE,
) as 7;

/**
 * Offset where the shared domain-records region begins, relative to the rule
 * header.
 *
 * Domain records are only written for cosmetic rules, whose header is larger
 * than the network header ({@link CR_MODIFIER_RECORDS_OFFSET} = 7 slots vs
 * {@link NR_MODIFIER_RECORDS_OFFSET} = 5). Using the cosmetic size for both
 * layouts keeps network rules correct (their header simply ends earlier) and
 * prevents the last cosmetic modifier record from overlapping the first
 * domain record when a small capacity makes the regions adjacent.
 */
export const DATA_HEADER_SIZE = Math.max(NR_MODIFIER_RECORDS_OFFSET, CR_MODIFIER_RECORDS_OFFSET);

/**
 * Default maximum number of tokens per rule.
 * Shared default across network and comment rules.
 */
const DEFAULT_TOKEN_CAPACITY = 1024;

/**
 * Default maximum number of modifiers per network rule.
 * Most network rules have 1-5 modifiers; 64 provides headroom.
 */
const DEFAULT_MODIFIER_CAPACITY = 64;

/**
 * Default maximum number of domains per cosmetic rule.
 * Most cosmetic rules have 1-10 domains; 128 provides headroom.
 * This can grow dynamically if needed.
 */
const DEFAULT_DOMAIN_CAPACITY = 128;

/**
 * Domain record stride (3 slots: valueStart, valueEnd, flags).
 */
const DOMAIN_RECORD_STRIDE = 3;

// Minimum ctx.data slots needed to embed the LE node tree for !#if directives:
//   CM_PREP_LE_OFFSET(5) + LE_BUFFER_SIZE(LE_HEADER(2) + LE_MAX_NODES(32) * LE_STRIDE(5)) = 167
const CM_PREP_MIN_DATA_SLOTS = 167;

/**
 * Shared parser context.
 *
 * Holds references to tokenizer output buffers, the source string,
 * and the output Int32Array. All parsers read tokens and write
 * structural indices through this single object.
 */
export interface ParserContext {
    /**
     * Original source string.
     */
    source: string;

    /**
     * Source offset for the first token (usually 0).
     */
    sourceStart: number;

    /**
     * Token types buffer (from tokenizer).
     */
    types: Uint8Array;

    /**
     * Token end positions buffer (from tokenizer).
     */
    ends: Uint32Array;

    /**
     * Number of valid tokens in the buffer.
     */
    tokenCount: number;

    /**
     * Output data buffer (Int32Array with structural indices).
     */
    data: Int32Array;

    /**
     * Maximum number of modifiers the buffer can hold.
     */
    maxMods: number;

    /**
     * Maximum number of domains the buffer can hold.
     */
    maxDomains: number;

    /**
     * Maximum number of Int32 slots for the scriptlet body region.
     */
    maxScriptletBody: number;

    /**
     * Whether buffers may grow dynamically on overflow (up to the hard caps
     * defined in `src/limits.ts`). When `false` the parser preserves the
     * legacy behaviour: structural parsers set `status = 1` and bail.
     */
    grow: boolean;

    /**
     * The region that most recently triggered hard-cap overflow.
     * Set by structural parsers before writing `status = 2`. Cleared by the
     * pipeline parser after throwing {@link CapacityOverflowError}.
     */
    overflowRegion?: CapacityRegion;

    /**
     * Parse status code:
     *
     *   - `0` — Success. The structural data in `data` is complete.
     *   - `1` — Recoverable overflow (`grow === false`). A structural parser
     *           ran out of buffer capacity. The data already written remains
     *           usable but is truncated.
     *   - `2` — Hard-cap overflow. The growth required would exceed the module
     *           hard cap. The pipeline parser will throw
     *           {@link CapacityOverflowError} and clear this to `0`.
     *
     * Parsers MUST NOT throw for overflow; they MUST set this field and return
     * early. Lexical or semantic syntax errors are still reported via thrown
     * {@link AdblockSyntaxError}s.
     */
    status: 0 | 1 | 2;

    /**
     * Parse generation.
     *
     * Incremented every time the context starts or ends a parse
     * ({@link initParserContext}, {@link resetCtxData}). Data readers capture
     * the value they were created with and refuse to read afterwards, because
     * the next parse overwrites `data`, `types` and `source` in place — a
     * reader kept across a parse would silently return another rule's data
     * (F-042).
     */
    generation: number;
}

/**
 * Compute the total `ctx.data` length needed for given capacity triple.
 *
 * @param maxMods Maximum modifier records.
 * @param maxDomains Maximum domain records.
 * @param maxScriptletBody Maximum scriptlet body slots.
 *
 * @returns Required `Int32Array` length.
 */
function computeDataLength(maxMods: number, maxDomains: number, maxScriptletBody: number): number {
    // The selector-list region is stored after the header/modifier/domain/
    // scriptlet regions, so a long selector cannot overwrite domain records
    // and a `[$...]` modifier list cannot shift it out of the buffer.
    const baseLength = Math.max(
        DATA_HEADER_SIZE
            + maxMods * MAX_MODIFIER_RECORD_STRIDE
            + maxDomains * DOMAIN_RECORD_STRIDE
            + maxScriptletBody,
        CM_PREP_MIN_DATA_SLOTS,
    );

    return baseLength + SL_MIN_DATA_SLOTS;
}

/**
 * Creates a pre-allocated ParserContext.
 *
 * @param tokenCapacity Maximum number of tokens.
 * @param modifierCapacity Maximum number of modifiers.
 * @param domainCapacity Maximum number of domains.
 * @param scriptletBodyCapacity Maximum scriptlet body Int32 slots.
 * @param grow Whether buffers may grow dynamically on overflow.
 *
 * @returns A new ParserContext ready for use.
 */
export function createParserContext(
    tokenCapacity = DEFAULT_TOKEN_CAPACITY,
    modifierCapacity = DEFAULT_MODIFIER_CAPACITY,
    domainCapacity = DEFAULT_DOMAIN_CAPACITY,
    scriptletBodyCapacity = SCRIPTLET_BODY_DATA_CAPACITY,
    grow = true,
): ParserContext {
    return {
        source: '',
        sourceStart: 0,
        types: new Uint8Array(tokenCapacity),
        ends: new Uint32Array(tokenCapacity),
        tokenCount: 0,
        data: new Int32Array(computeDataLength(modifierCapacity, domainCapacity, scriptletBodyCapacity)),
        maxMods: modifierCapacity,
        maxDomains: domainCapacity,
        maxScriptletBody: scriptletBodyCapacity,
        grow,
        status: CTX_STATUS_OK,
        generation: 0,
    };
}

/**
 * Grow one of the three growable regions of `ctx.data` and update
 * `ctx.maxMods` / `ctx.maxDomains` / `ctx.maxScriptletBody` accordingly.
 *
 * The function reallocates `ctx.data` to a new `Int32Array`, copies the
 * already-written header + earlier regions into their correct positions in
 * the new layout, and updates the capacity fields on `ctx`.
 *
 * Regions are written sequentially:
 *  modifier records → domain records → scriptlet body.
 *
 * Growing a region that comes before another shifts the later regions to
 * higher offsets; the copy logic handles this correctly.
 *
 * @param ctx Parser context whose `data` buffer will be reallocated.
 * @param region Which region to grow ({@link REGION_MODIFIERS}, {@link REGION_DOMAINS},
 *   or {@link REGION_SCRIPTLET_BODY}).
 * @param newCapacity Desired new capacity (records for mod/domain; slots for scriptlet).
 * @param dataOffset Offset within `ctx.data` where the CR/NR header starts.
 *   Non-zero for `parseRange()` sub-parses; the header and every region are
 *   copied at the same offset in the new buffer.
 *
 * @returns `true` on success; `false` if `newCapacity` exceeds the hard cap
 *          (caller should then set `ctx.overflowRegion` and `ctx.status = 2`).
 */
export function growCtxRegion(
    ctx: ParserContext,
    region: GrowableRegion,
    newCapacity: number,
    dataOffset = 0,
): boolean {
    let hardCap: number;
    if (region === REGION_MODIFIERS) {
        hardCap = MAX_MODIFIER_CAPACITY;
    } else if (region === REGION_DOMAINS) {
        hardCap = MAX_DOMAIN_CAPACITY;
    } else {
        hardCap = MAX_SCRIPTLET_BODY_CAPACITY;
    }

    if (newCapacity > hardCap) {
        return false;
    }

    const oldMaxMods = ctx.maxMods;
    const oldMaxDomains = ctx.maxDomains;
    const oldMaxScriptlet = ctx.maxScriptletBody;

    const newMaxMods = region === REGION_MODIFIERS ? newCapacity : oldMaxMods;
    const newMaxDomains = region === REGION_DOMAINS ? newCapacity : oldMaxDomains;
    const newMaxScriptlet = region === REGION_SCRIPTLET_BODY ? newCapacity : oldMaxScriptlet;

    const oldData = ctx.data;
    const newData = new Int32Array(dataOffset + computeDataLength(newMaxMods, newMaxDomains, newMaxScriptlet));

    // Preserve anything before the caller's header (sub-parser composition).
    if (dataOffset > 0) {
        newData.set(oldData.subarray(0, dataOffset), 0);
    }

    // Copy header (at the caller's dataOffset).
    for (let i = 0; i < NR_MODIFIER_RECORDS_OFFSET; i += 1) {
        newData[dataOffset + i] = oldData[dataOffset + i];
    }

    // Copy modifier records (start offset is fixed relative to the header).
    const modSlots = oldMaxMods * MAX_MODIFIER_RECORD_STRIDE;
    newData.set(
        oldData.subarray(
            dataOffset + NR_MODIFIER_RECORDS_OFFSET,
            dataOffset + NR_MODIFIER_RECORDS_OFFSET + modSlots,
        ),
        dataOffset + NR_MODIFIER_RECORDS_OFFSET,
    );

    // Copy domain records — offset shifts when maxMods grew.
    const oldDomainStart = dataOffset + DATA_HEADER_SIZE + oldMaxMods * MAX_MODIFIER_RECORD_STRIDE;
    const newDomainStart = dataOffset + DATA_HEADER_SIZE + newMaxMods * MAX_MODIFIER_RECORD_STRIDE;
    const domSlots = oldMaxDomains * DOMAIN_RECORD_STRIDE;
    newData.set(oldData.subarray(oldDomainStart, oldDomainStart + domSlots), newDomainStart);

    // Copy scriptlet body region — offset shifts when maxMods or maxDomains grew.
    const oldScriptletStart = oldDomainStart + oldMaxDomains * DOMAIN_RECORD_STRIDE;
    const newScriptletStart = newDomainStart + newMaxDomains * DOMAIN_RECORD_STRIDE;
    newData.set(
        oldData.subarray(oldScriptletStart, oldScriptletStart + oldMaxScriptlet),
        newScriptletStart,
    );

    // Copy the selector-list region, which lives at the end of the buffer.
    const oldSelectorStart = oldData.length - SL_MIN_DATA_SLOTS;
    const newSelectorStart = newData.length - SL_MIN_DATA_SLOTS;
    newData.set(oldData.subarray(oldSelectorStart), newSelectorStart);

    ctx.data = newData;
    ctx.maxMods = newMaxMods;
    ctx.maxDomains = newMaxDomains;
    ctx.maxScriptletBody = newMaxScriptlet;
    return true;
}

/**
 * Shrink `ctx.data` back to the supplied default capacities and release what
 * the context holds on to from the last parse.
 *
 * Called by pipeline-parser `reset()` methods. The source string is dropped:
 * for a filter list it is the whole list, which would otherwise stay
 * reachable for as long as the parser lives. If the current capacities
 * already match the defaults, `ctx.data` is not reallocated.
 *
 * @param ctx Parser context to reset.
 * @param defaultMaxMods Default modifier capacity.
 * @param defaultMaxDomains Default domain capacity.
 * @param defaultMaxScriptlet Default scriptlet body capacity.
 * @param tokenizer Tokenizer that feeds the context, already reset. When
 * given, the context's token arrays are pointed at the tokenizer's current
 * ones, so a grown pair left over from the last parse is released too.
 */
export function resetCtxData(
    ctx: ParserContext,
    defaultMaxMods: number,
    defaultMaxDomains: number,
    defaultMaxScriptlet: number,
    tokenizer?: Tokenizer,
): void {
    if (
        ctx.maxMods !== defaultMaxMods
        || ctx.maxDomains !== defaultMaxDomains
        || ctx.maxScriptletBody !== defaultMaxScriptlet
    ) {
        ctx.data = new Int32Array(computeDataLength(defaultMaxMods, defaultMaxDomains, defaultMaxScriptlet));
        ctx.maxMods = defaultMaxMods;
        ctx.maxDomains = defaultMaxDomains;
        ctx.maxScriptletBody = defaultMaxScriptlet;
    }

    if (tokenizer) {
        ctx.types = tokenizer.types;
        ctx.ends = tokenizer.ends;
    }

    ctx.source = '';
    ctx.sourceStart = 0;
    ctx.overflowRegion = undefined;
    ctx.status = CTX_STATUS_OK;
    ctx.tokenCount = 0;
    ctx.generation += 1;
}

/**
 * Initialize the context from tokenizer output for a new parse.
 *
 * @param ctx Context to initialize.
 * @param source Source string.
 * @param tokens Tokenizer instance after calling tokenize().
 * @param sourceStart Source offset (default 0).
 */
export function initParserContext(
    ctx: ParserContext,
    source: string,
    tokens: Tokenizer,
    sourceStart = 0,
): void {
    ctx.source = source;
    ctx.sourceStart = sourceStart;
    ctx.types = tokens.types;
    ctx.ends = tokens.ends;
    ctx.tokenCount = tokens.tokenCount;
    ctx.status = CTX_STATUS_OK;
    ctx.generation += 1;
}

/**
 * Returns the source-string start index of a token.
 * Token `i` starts where token `i-1` ended. Token 0 starts at `sourceStart`.
 *
 * @param ctx Parser context.
 * @param ti Token index.
 *
 * @returns Source start index of the token.
 */
export function tokenStart(ctx: ParserContext, ti: number): number {
    return ti === 0 ? ctx.sourceStart : ctx.ends[ti - 1];
}

/**
 * Skip a single whitespace token if present.
 * The tokenizer groups consecutive whitespace into one token,
 * so skipping one Whitespace token is sufficient.
 *
 * @param ctx Parser context.
 * @param ti Current token index.
 * @param end Exclusive upper bound (defaults to `ctx.tokenCount`).
 *
 * @returns Token index after optional whitespace.
 */
export function skipWs(ctx: ParserContext, ti: number, end?: number): number {
    return ti < (end ?? ctx.tokenCount) && ctx.types[ti] === TokenType.Whitespace ? ti + 1 : ti;
}

/**
 * Skip a single trailing whitespace token when scanning backward.
 * The tokenizer groups consecutive whitespace into one token,
 * so skipping one Whitespace token is sufficient.
 *
 * @param ctx Parser context.
 * @param ti Current token index (scanning backward from here).
 * @param low Inclusive lower bound — will not skip below this index.
 *
 * @returns Token index after optional backward whitespace skip.
 */
export function skipWsBack(ctx: ParserContext, ti: number, low: number): number {
    return ti >= low && ctx.types[ti] === TokenType.Whitespace ? ti - 1 : ti;
}

/**
 * Returns the index of the last token in `[startTi, endTi)` that is not Whitespace.
 * Returns `-1` if there are no non-whitespace tokens in the range.
 *
 * @param ctx Parser context.
 * @param startTi Start of range (inclusive).
 * @param endTi End of range (exclusive).
 *
 * @returns Index of last non-whitespace token, or `-1`.
 */
export function lastNonWs(ctx: ParserContext, startTi: number, endTi: number): number {
    let ti = endTi - 1;
    while (ti >= startTi && ctx.types[ti] === TokenType.Whitespace) {
        ti -= 1;
    }
    return ti >= startTi ? ti : -1;
}

/**
 * Advance to the next occurrence of `tokenType`, or to `end`.
 *
 * @param ctx Parser context.
 * @param ti Current token index.
 * @param end Token count boundary.
 * @param tokenType Token type to stop at.
 *
 * @returns Token index at the found token or `end`.
 */
export function skipUntil(ctx: ParserContext, ti: number, end: number, tokenType: number): number {
    const { types } = ctx;
    while (ti < end && types[ti] !== tokenType) {
        ti += 1;
    }
    return ti;
}

/**
 * Computes the offset where domain records begin in ctx.data.
 *
 * @param ctx Parser context.
 *
 * @returns Domain records offset.
 */
export function domainRecordsOffset(ctx: ParserContext): number {
    return DATA_HEADER_SIZE + ctx.maxMods * MAX_MODIFIER_RECORD_STRIDE;
}

/**
 * Computes the absolute domain-records offset for a header at `dataOffset`.
 *
 * Shared by the cosmetic AST builders so the header size and the maximum
 * modifier stride cannot drift between files.
 *
 * @param dataOffset Offset within `ctx.data` where the CR header starts.
 * @param maxMods Maximum number of modifier records in the buffer.
 *
 * @returns Absolute offset of the first domain record.
 */
export function domainRecordsOffsetFor(dataOffset: number, maxMods: number): number {
    return dataOffset + DATA_HEADER_SIZE + maxMods * MAX_MODIFIER_RECORD_STRIDE;
}

/**
 * Computes the offset where scriptlet body data begins in ctx.data.
 * This is right after the domain records region.
 *
 * @param ctx Parser context.
 *
 * @returns Scriptlet body data offset.
 */
export function scriptletBodyDataOffset(ctx: ParserContext): number {
    return domainRecordsOffset(ctx) + ctx.maxDomains * DOMAIN_RECORD_STRIDE;
}

/**
 * Computes the offset where the cosmetic body's selector-list region
 * begins in `ctx.data`. This is the data offset passed to
 * {@link SelectorListParser.parse} when invoked from a cosmetic body
 * parser (e.g. ADG/uBO HTML filtering).
 *
 * When the rule carries an AdGuard `[$…]` modifier list, its records occupy
 * the modifier region starting at {@link CR_MODIFIER_RECORDS_OFFSET}, so the
 * selector-list region must begin *after* those records to avoid overwriting
 * them. Otherwise it coincides with the modifier-records region.
 *
 * @param ctx Parser context.
 *
 * @returns Selector list data offset within `ctx.data`.
 */
export function selectorListDataOffset(ctx: ParserContext): number {
    return crSlDataOffset(ctx.data);
}

/**
 * Returns `true` when the source substring `[start, end)` equals `target`,
 * without allocating a slice.
 *
 * @param source Source string.
 * @param start Start index (inclusive).
 * @param end End index (exclusive).
 * @param target String to compare against.
 *
 * @returns Whether the region exactly equals `target`.
 */
export function regionEquals(source: string, start: number, end: number, target: string): boolean {
    const len = end - start;

    if (len !== target.length) {
        return false;
    }

    for (let i = 0; i < len; i += 1) {
        if (source.charCodeAt(start + i) !== target.charCodeAt(i)) {
            return false;
        }
    }

    return true;
}

/**
 * Returns `true` when the source substring `[start, end)` equals `target`
 * under ASCII case-insensitive comparison, without allocating a slice.
 *
 * **Important**: `target` MUST be all-lowercase for correct results, because
 * the comparison folds only the source character to lowercase via `| 0x20`.
 *
 * @param source Source string.
 * @param start Start index (inclusive).
 * @param end End index (exclusive).
 * @param target Lowercase string to compare against.
 *
 * @returns Whether the region equals `target` (case-insensitive, ASCII only).
 */
export function regionEqualsCI(source: string, start: number, end: number, target: string): boolean {
    const len = end - start;

    if (len !== target.length) {
        return false;
    }

    for (let i = 0; i < len; i += 1) {
        // eslint-disable-next-line no-bitwise
        if ((source.charCodeAt(start + i) | 0x20) !== target.charCodeAt(i)) {
            return false;
        }
    }

    return true;
}
