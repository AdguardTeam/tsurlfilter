/* eslint-disable no-param-reassign */

/**
 * @file Domain list preparser - shared infrastructure for parsing domain lists.
 *
 * Handles both comma-separated (cosmetic rules) and pipe-separated (network
 * modifier values) domain lists. Supports regex domains with embedded separators.
 *
 * Zero allocations: only writes integer offsets into ctx.data.
 */

import { TokenType } from '../../tokenizer/token-types';
import type { PreparserContext } from '../context';
import {
    domainRecordsOffset,
    growDomainCapacity,
    skipWs,
    tokenStart,
} from '../context';
import {
    DOMAIN_FIELD_FLAGS,
    DOMAIN_FIELD_VALUE_END,
    DOMAIN_FIELD_VALUE_START,
    DOMAIN_FLAG_EXCEPTION,
    DOMAIN_RECORD_STRIDE,
} from '../cosmetic/constants';

/**
 * Preparsing for domain lists (comma or pipe separated).
 *
 * Scans token stream for separator tokens, handles regex domains with embedded
 * separators inside [], {}, (), and writes domain records to ctx.data.
 */
export class DomainListPreparser {
    /**
     * Preparse a domain list from the token stream.
     *
     * @param ctx Preparser context.
     * @param startTi Start token index (inclusive).
     * @param endTi End token index (exclusive).
     * @param separatorType TokenType.Comma or TokenType.Pipe.
     *
     * @returns Number of domain items parsed.
     *
     * @throws {Error} If domain list has empty items or invalid structure.
     */
    public static preparse(
        ctx: PreparserContext,
        startTi: number,
        endTi: number,
        separatorType: TokenType.Comma | TokenType.Pipe,
    ): number {
        const { types } = ctx;
        let domainCount = 0;
        let itemStartTi = skipWs(ctx, startTi);

        // Empty domain list is valid (no domains)
        if (itemStartTi >= endTi) {
            return 0;
        }

        const recordsOffset = domainRecordsOffset(ctx);

        while (itemStartTi < endTi) {
            // Find the end of this item (next separator or endTi)
            let itemEndTi = itemStartTi;
            let bracketDepth = 0;
            let parenDepth = 0;
            let braceDepth = 0;
            let inRegex = false;

            // Check if this item starts with a slash (regex domain)
            if (types[itemStartTi] === TokenType.Slash) {
                inRegex = true;
                itemEndTi += 1;
            }

            // Scan forward to find item boundary
            while (itemEndTi < endTi) {
                const t = types[itemEndTi];

                // Skip escaped characters
                if (t === TokenType.Escaped) {
                    itemEndTi += 1;
                    continue;
                }

                if (inRegex) {
                    // Track depth for brackets, parens, braces
                    if (t === TokenType.OpenSquare) {
                        bracketDepth += 1;
                    } else if (t === TokenType.CloseSquare) {
                        bracketDepth -= 1;
                    } else if (t === TokenType.OpenParen) {
                        parenDepth += 1;
                    } else if (t === TokenType.CloseParen) {
                        parenDepth -= 1;
                    } else if (t === TokenType.OpenBrace) {
                        braceDepth += 1;
                    } else if (t === TokenType.CloseBrace) {
                        braceDepth -= 1;
                    } else if (t === TokenType.Slash && bracketDepth === 0 && parenDepth === 0 && braceDepth === 0) {
                        // Closing slash at depth 0 - end of regex
                        itemEndTi += 1;
                        inRegex = false;
                        continue;
                    }

                    // Inside regex at depth > 0, skip separator tokens
                    itemEndTi += 1;
                    continue;
                }

                // Not in regex - check for separator
                if (t === separatorType) {
                    // Found separator
                    break;
                }

                itemEndTi += 1;
            }

            // Trim trailing whitespace from item
            let lastNonWsTi = itemEndTi - 1;
            while (lastNonWsTi >= itemStartTi && types[lastNonWsTi] === TokenType.Whitespace) {
                lastNonWsTi -= 1;
            }

            if (lastNonWsTi < itemStartTi) {
                throw new Error('Domain list contains empty item');
            }

            // Check for exception flag (~)
            let isException = false;
            let valueStartTi = itemStartTi;
            if (types[itemStartTi] === TokenType.Tilde) {
                isException = true;
                valueStartTi = skipWs(ctx, itemStartTi + 1);
                if (valueStartTi > lastNonWsTi) {
                    throw new Error('Domain list contains empty item after ~');
                }
            }

            // Compute source positions
            const valueStart = tokenStart(ctx, valueStartTi);
            const valueEnd = ctx.ends[lastNonWsTi];

            if (valueEnd <= valueStart) {
                throw new Error('Domain list contains empty item');
            }

            // Check capacity and grow if needed
            if (domainCount >= ctx.maxDomains) {
                growDomainCapacity(ctx);
            }

            // Write domain record
            const recordBase = recordsOffset + domainCount * DOMAIN_RECORD_STRIDE;
            ctx.data[recordBase + DOMAIN_FIELD_VALUE_START] = valueStart;
            ctx.data[recordBase + DOMAIN_FIELD_VALUE_END] = valueEnd;
            ctx.data[recordBase + DOMAIN_FIELD_FLAGS] = isException ? DOMAIN_FLAG_EXCEPTION : 0;

            domainCount += 1;

            // Move to next item (skip separator if present)
            if (itemEndTi < endTi && types[itemEndTi] === separatorType) {
                itemStartTi = skipWs(ctx, itemEndTi + 1);
                // Check for trailing separator
                if (itemStartTi >= endTi) {
                    throw new Error('Domain list has trailing separator');
                }
            } else {
                itemStartTi = itemEndTi;
            }
        }

        // Check for leading separator (caught by empty first item)
        return domainCount;
    }
}
