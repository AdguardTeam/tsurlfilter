/* eslint-disable no-bitwise, no-param-reassign */

/**
 * @file Shared cosmetic rule preparser logic.
 *
 * Extracts common header-writing logic used by element-hiding, scriptlet,
 * and JS injection preparsers. Zero heap allocations.
 */

import { TokenType } from '../../tokenizer/token-types';
import { RuleClassifier } from '../classifier';
import type { PreparserContext } from '../context';
import { skipWs, tokenStart } from '../context';
import { DomainListPreparser } from '../misc/domain-list';
import { ModifierListPreparser } from '../misc/modifier-list';

import {
    CR_BODY_END,
    CR_BODY_START,
    CR_DOMAIN_COUNT,
    CR_FLAG_EXCEPTION,
    CR_FLAG_HAS_ADG_MODS,
    CR_FLAGS_OFFSET,
    CR_MODIFIER_COUNT_OFFSET,
    CR_MODIFIER_RECORDS_OFFSET,
    CR_SEP_LEN_MASK,
    CR_SEP_LEN_SHIFT,
    CR_SEP_SOURCE_START,
} from './constants';

/**
 * Find the closing bracket token (]) that matches the opening [.
 * Tracks bracket depth to handle nested brackets (e.g. regex character classes).
 * Skips Escaped tokens to handle \].
 *
 * @param ctx Preparser context.
 * @param startTi Token index to start scanning from (after the opening [).
 * @param endTi Token index boundary (exclusive).
 *
 * @returns Token index of the closing ], or -1 if not found.
 */
function findClosingBracket(
    ctx: PreparserContext,
    startTi: number,
    endTi: number,
): number {
    const { types } = ctx;
    let depth = 1;

    for (let ti = startTi; ti < endTi; ti += 1) {
        const t = types[ti];

        if (t === TokenType.Escaped) {
            continue;
        }

        if (t === TokenType.OpenSquare) {
            depth += 1;
        } else if (t === TokenType.CloseSquare) {
            depth -= 1;
            if (depth === 0) {
                return ti;
            }
        }
    }

    return -1;
}

/**
 * Result of preparseCommonCosmeticHeader.
 *
 * Returned so callers (e.g. element-hiding) can continue with
 * additional work like uBO modifier scanning.
 */
export interface CosmeticHeaderResult {
    /**
     * Packed flags value written to ctx.data[CR_FLAGS_OFFSET].
     */
    flags: number;

    /**
     * Whether the rule has an AdGuard modifier list ([$...]).
     */
    hasAdgMods: boolean;

    /**
     * Number of AdGuard modifiers found (0 if none).
     */
    modCount: number;

    /**
     * Token index where body starts (after separator + whitespace skip).
     */
    bodyStartTi: number;

    /**
     * Source index where body starts.
     */
    bodyStart: number;

    /**
     * Source index where body ends (trimmed of trailing whitespace).
     */
    bodyEnd: number;
}

/**
 * Preparse the common cosmetic rule header fields and write them to ctx.data.
 *
 * Handles:
 * 1. Unpacking separator kind/index from the classifier result.
 * 2. Detecting and parsing `[$…]` AdGuard modifier list prefix.
 * 3. Parsing the comma-separated domain list.
 * 4. Computing bodyStart (skip separator tokens + whitespace).
 * 5. Validating body is non-empty.
 * 6. Writing the header fields (flags, sepSourceStart, domainCount, bodyStart, bodyEnd, modCount).
 *
 * @param ctx Preparser context.
 * @param classified Packed classifier result (separator kind + index).
 * @param ruleTypeName Human-readable rule type name for error messages.
 *
 * @returns Header result so callers can do additional work (e.g. uBO modifier scan).
 *
 * @throws {Error} If body is empty or structure is invalid.
 */
export function preparseCommonCosmeticHeader(
    ctx: PreparserContext,
    classified: number,
    ruleTypeName: string,
): CosmeticHeaderResult {
    const { types, source } = ctx;

    // Unpack separator token index and token count
    const sepTokenIndex = RuleClassifier.cosmeticSepIndex(classified);
    const sepTokens = RuleClassifier.cosmeticSepTokenCount(classified);

    // Compute separator source position and length
    const sepSourceStart = tokenStart(ctx, sepTokenIndex);
    const sepSourceEnd = ctx.ends[sepTokenIndex + sepTokens - 1];
    const sepLen = sepSourceEnd - sepSourceStart;

    // Detect AdGuard modifier list prefix: [$...]
    let domainStartTi = 0;
    let modCount = 0;
    let hasAdgMods = false;

    if (types[0] === TokenType.OpenSquare && types[1] === TokenType.DollarSign) {
        // Find closing ] with bracket depth tracking
        const closeBracketTi = findClosingBracket(ctx, 1, sepTokenIndex);

        if (closeBracketTi < 0) {
            throw new Error('Unclosed AdGuard modifier list: missing ]');
        }

        // Preparse modifier list (up to closeBracketTi, exclusive)
        if (closeBracketTi === 2) {
            throw new Error('AdGuard modifier list [$...] is empty');
        }

        const savedTokenCount = ctx.tokenCount;
        try {
            ctx.tokenCount = closeBracketTi;
            modCount = ModifierListPreparser.preparse(ctx, 2, CR_MODIFIER_RECORDS_OFFSET);
            ctx.tokenCount = savedTokenCount;
        } catch (e) {
            ctx.tokenCount = savedTokenCount;
            throw e;
        }

        hasAdgMods = true;
        domainStartTi = skipWs(ctx, closeBracketTi + 1);
    }

    const domainEndTi = sepTokenIndex;

    // Parse domain list (comma-separated)
    const domainCount = DomainListPreparser.preparse(
        ctx,
        domainStartTi,
        domainEndTi,
        TokenType.Comma,
    );

    // Body starts after separator (skip all separator tokens)
    const bodyCandidateTi = sepTokenIndex + sepTokens;
    const bodyStartTi = skipWs(ctx, bodyCandidateTi);

    // Validate body is non-empty
    if (bodyStartTi >= ctx.tokenCount) {
        throw new Error(`${ruleTypeName} has empty body`);
    }

    const bodyStart = tokenStart(ctx, bodyStartTi);

    // Find trimmed body end by tracking last non-whitespace token
    let trimmedEnd = bodyStart;
    for (let ti = bodyStartTi; ti < ctx.tokenCount; ti += 1) {
        if (types[ti] !== TokenType.Whitespace) {
            trimmedEnd = tokenStart(ctx, ti + 1);
        }
    }

    if (trimmedEnd <= bodyStart) {
        throw new Error(`${ruleTypeName} has empty body`);
    }

    // Pack flags — determine exception from raw separator containing '@'
    let flags = 0;
    if (source.indexOf('@', sepSourceStart) >= 0
        && source.indexOf('@', sepSourceStart) < sepSourceEnd) {
        flags |= CR_FLAG_EXCEPTION;
    }
    flags |= (sepLen & CR_SEP_LEN_MASK) << CR_SEP_LEN_SHIFT;
    if (hasAdgMods) {
        flags |= CR_FLAG_HAS_ADG_MODS;
    }

    // Write header
    ctx.data[CR_FLAGS_OFFSET] = flags;
    ctx.data[CR_SEP_SOURCE_START] = sepSourceStart;
    ctx.data[CR_DOMAIN_COUNT] = domainCount;
    ctx.data[CR_BODY_START] = bodyStart;
    ctx.data[CR_MODIFIER_COUNT_OFFSET] = modCount;
    ctx.data[CR_BODY_END] = trimmedEnd;

    return {
        flags,
        hasAdgMods,
        modCount,
        bodyStartTi,
        bodyStart,
        bodyEnd: trimmedEnd,
    };
}
