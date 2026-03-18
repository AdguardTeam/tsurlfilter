/* eslint-disable no-bitwise, no-param-reassign */

/**
 * @file Element hiding cosmetic rule preparser.
 *
 * Handles ##, #@#, #?#, #@?# separators. Writes structural offsets to ctx.data
 * with zero heap allocations.
 */

import { TokenType } from '../../tokenizer/token-types';
import type { PreparserContext } from '../context';
import { tokenStart, skipWs } from '../context';
import { RuleClassifier } from '../classifier';
import { DomainListPreparser } from '../misc/domain-list';
import { ModifierListPreparser } from '../misc/modifier-list';
import { NR_MODIFIER_COUNT_OFFSET } from '../network/constants';
import {
    CR_FLAGS_OFFSET,
    CR_SEP_SOURCE_START,
    CR_DOMAIN_COUNT,
    CR_BODY_START,
    CR_FLAG_EXCEPTION,
    CR_FLAG_HAS_ADG_MODS,
    CR_SEP_KIND_SHIFT,
    CR_SEP_KIND_MASK,
    cosmeticSepLength,
    cosmeticSepTokenCount,
    cosmeticSepIsException,
} from './constants';

/**
 * Element hiding cosmetic rule preparser.
 */
export class ElementHidingPreparser {
    /**
     * Preparse an element hiding rule.
     *
     * @param ctx Preparser context.
     * @param classified Packed (sepKind, sepTokenIndex) from cosmetic separator finder.
     *
     * @throws {Error} If body is empty or structure is invalid.
     */
    public static preparse(ctx: PreparserContext, classified: number): void {
        const { types, source } = ctx;

        // Unpack separator kind and token index
        const sepKind = RuleClassifier.cosmeticSepKind(classified);
        const sepTokenIndex = RuleClassifier.cosmeticSepIndex(classified);

        // Compute separator source position
        const sepSourceStart = tokenStart(ctx, sepTokenIndex);

        // Detect AdGuard modifier list prefix: [$...]
        let domainStartTi = 0;
        let modCount = 0;
        let hasAdgMods = false;

        if (types[0] === TokenType.OpenSquare && types[1] === TokenType.DollarSign) {
            // Find closing ] with bracket depth tracking
            // Start at depth 1 (after the opening [)
            const closeBracketTi = ElementHidingPreparser.findClosingBracket(ctx, 1, sepTokenIndex);

            if (closeBracketTi < 0) {
                throw new Error('Unclosed AdGuard modifier list: missing ]');
            }

            // Parse modifier list between $ and ]
            // Temporarily scope tokenCount so ModifierListPreparser stops at ]
            const savedTokenCount = ctx.tokenCount;
            ctx.tokenCount = closeBracketTi;
            modCount = ModifierListPreparser.preparse(ctx, 2); // start after $
            ctx.tokenCount = savedTokenCount;

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
        const sepTokens = cosmeticSepTokenCount(sepKind);
        const bodyCandidateTi = sepTokenIndex + sepTokens;
        const bodyStartTi = skipWs(ctx, bodyCandidateTi);

        // Validate body is non-empty
        if (bodyStartTi >= ctx.tokenCount) {
            throw new Error('Element hiding rule has empty body');
        }

        const bodyStart = tokenStart(ctx, bodyStartTi);

        // Validate body has content (not just whitespace)
        const bodyEnd = source.length;
        let trimmedEnd = bodyEnd;
        while (trimmedEnd > bodyStart && /\s/.test(source[trimmedEnd - 1])) {
            trimmedEnd -= 1;
        }

        if (trimmedEnd <= bodyStart) {
            throw new Error('Element hiding rule has empty body');
        }

        // Pack flags
        let flags = 0;
        if (cosmeticSepIsException(sepKind)) {
            flags |= CR_FLAG_EXCEPTION;
        }
        flags |= (sepKind & CR_SEP_KIND_MASK) << CR_SEP_KIND_SHIFT;
        if (hasAdgMods) {
            flags |= CR_FLAG_HAS_ADG_MODS;
        }

        // Write header
        ctx.data[CR_FLAGS_OFFSET] = flags;
        ctx.data[CR_SEP_SOURCE_START] = sepSourceStart;
        ctx.data[CR_DOMAIN_COUNT] = domainCount;
        ctx.data[CR_BODY_START] = bodyStart;
        ctx.data[NR_MODIFIER_COUNT_OFFSET] = modCount;
    }

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
    private static findClosingBracket(
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
}
