/* eslint-disable no-bitwise, no-param-reassign */

/**
 * @file Shared cosmetic rule parser logic.
 *
 * Extracts common header-writing logic used by element-hiding, scriptlet,
 * and JS injection parsers. Zero heap allocations.
 */

import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { TokenType } from '../../tokenizer/token-types';
import { RuleClassifier } from '../classifier';
import type { ParserContext } from '../context';
import { skipWs, tokenStart } from '../context';
import { DomainListParser } from '../misc/domain-list';
import { ModifierListParser } from '../misc/modifier-list';

import {
    CR_BODY_END,
    CR_BODY_START,
    CR_BODY_START_TI,
    CR_FLAG_EXCEPTION,
    CR_FLAG_HAS_ADG_MODS,
    CR_FLAGS_OFFSET,
    CR_MODIFIER_RECORDS_OFFSET,
    CR_SEP_LEN_MASK,
    CR_SEP_LEN_SHIFT,
    CR_SEP_SOURCE_START,
} from './constants';

/**
 * Character code of `@`, used to detect the exception marker inside a cosmetic
 * rule separator (e.g. `#@#`, `#@$#`).
 */
const AT_SIGN = 0x40;

/**
 * Find the closing bracket token (]) that matches the opening [.
 * Tracks bracket depth to handle nested brackets (e.g. regex character classes).
 * Skips Escaped tokens to handle \].
 *
 * @param ctx Parser context.
 * @param startTi Token index to start scanning from (after the opening [).
 * @param endTi Token index boundary (exclusive).
 *
 * @returns Token index of the closing ], or -1 if not found.
 */
function findClosingBracket(
    ctx: ParserContext,
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
 * Preparse the common cosmetic rule header fields and write them to ctx.data.
 *
 * Handles:
 * 1. Unpacking separator kind/index from the classifier result.
 * 2. Detecting and parsing `[$…]` AdGuard modifier list prefix.
 * 3. Parsing the comma-separated domain list.
 * 4. Computing bodyStart (skip separator tokens + whitespace).
 * 5. Validating body is non-empty.
 * 6. Writing the header fields (flags, sepSourceStart, domainCount, bodyStart, bodyEnd, modCount, bodyStartTi).
 *
 * @param ctx Parser context.
 * @param classified Packed classifier result (separator kind + index).
 * @param ruleTypeName Human-readable rule type name for error messages.
 * @param startTi Inclusive token index where the rule starts. Defaults to 0.
 * @param endTi Exclusive token index where the rule ends. Defaults to `ctx.tokenCount`.
 *
 * @throws {Error} If body is empty or structure is invalid.
 */
export function parseCommonCosmeticHeader(
    ctx: ParserContext,
    classified: number,
    ruleTypeName: string,
    startTi = 0,
    endTi = ctx.tokenCount,
): void {
    const { types, source } = ctx;

    // Unpack separator token index and token count
    const sepTokenIndex = RuleClassifier.cosmeticSepIndex(classified);
    const sepTokens = RuleClassifier.cosmeticSepTokenCount(classified);

    // Compute separator source position and length
    const sepSourceStart = tokenStart(ctx, sepTokenIndex);
    const sepSourceEnd = ctx.ends[sepTokenIndex + sepTokens - 1];
    const sepLen = sepSourceEnd - sepSourceStart;

    // Detect AdGuard modifier list prefix: [$...]
    let domainStartTi = startTi;
    let hasAdgMods = false;

    if (types[startTi] === TokenType.OpenSquare && types[startTi + 1] === TokenType.DollarSign) {
        // Find closing ] with bracket depth tracking
        const closeBracketTi = findClosingBracket(ctx, startTi + 1, sepTokenIndex);

        if (closeBracketTi < 0) {
            throw new Error('Unclosed AdGuard modifier list: missing ]');
        }

        // Preparse modifier list (up to closeBracketTi, exclusive)
        if (closeBracketTi === startTi + 2) {
            throw new Error('AdGuard modifier list [$...] is empty');
        }

        const savedTokenCount = ctx.tokenCount;
        try {
            ctx.tokenCount = closeBracketTi;
            ModifierListParser.parse(ctx, startTi + 2, CR_MODIFIER_RECORDS_OFFSET, 0);
            if (ctx.status === 1) {
                throw new AdblockSyntaxError(
                    'Too many modifiers in AdGuard modifier list',
                    tokenStart(ctx, 1),
                    ctx.ends[closeBracketTi],
                );
            }
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
    DomainListParser.parse(
        ctx,
        domainStartTi,
        domainEndTi,
        TokenType.Comma,
    );

    // Body starts after separator (skip all separator tokens)
    const bodyCandidateTi = sepTokenIndex + sepTokens;
    const bodyStartTi = skipWs(ctx, bodyCandidateTi);

    // Validate body is non-empty
    if (bodyStartTi >= endTi) {
        throw new Error(`${ruleTypeName} has empty body`);
    }

    const bodyStart = tokenStart(ctx, bodyStartTi);

    // Find trimmed body end by tracking last non-whitespace token
    let trimmedEnd = bodyStart;
    for (let ti = bodyStartTi; ti < endTi; ti += 1) {
        if (types[ti] !== TokenType.Whitespace) {
            trimmedEnd = tokenStart(ctx, ti + 1);
        }
    }

    if (trimmedEnd <= bodyStart) {
        throw new Error(`${ruleTypeName} has empty body`);
    }

    // Pack flags — determine exception from the separator containing '@'.
    // Scan only the separator's own characters ([sepSourceStart, sepSourceEnd)).
    // Using `source.indexOf('@', sepSourceStart)` would scan to the end of the
    // entire filter list when no '@' is present, making conversion of N
    // exception-free cosmetic rules Θ(N²).
    let flags = 0;
    for (let i = sepSourceStart; i < sepSourceEnd; i += 1) {
        if (source.charCodeAt(i) === AT_SIGN) {
            flags |= CR_FLAG_EXCEPTION;
            break;
        }
    }
    flags |= (sepLen & CR_SEP_LEN_MASK) << CR_SEP_LEN_SHIFT;
    if (hasAdgMods) {
        flags |= CR_FLAG_HAS_ADG_MODS;
    }

    // Write header
    ctx.data[CR_FLAGS_OFFSET] = flags;
    ctx.data[CR_SEP_SOURCE_START] = sepSourceStart;
    // ctx.data[CR_DOMAIN_COUNT]: already written by DomainListParser.parse()
    ctx.data[CR_BODY_START] = bodyStart;
    // ctx.data[CR_MODIFIER_COUNT_OFFSET]: already written by ModifierListParser.parse() (or 0 from init)
    ctx.data[CR_BODY_END] = trimmedEnd;
    ctx.data[CR_BODY_START_TI] = bodyStartTi;
}
