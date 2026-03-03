/* eslint-disable no-bitwise */

/**
 * @file Cosmetic separator detection for the preparser.
 *
 * Scans a raw token-type array for the first cosmetic separator and returns a
 * packed (kind, token-index) value — no string allocations.
 *
 * Ported from `src/parser3/cosmetic/separator-finder.ts` and adapted to the
 * preparser token-stream conventions.
 */

import { TokenType } from '../tokenizer/token-types';

export const enum CosmeticSepKind {
    None = 0,

    ElementHiding = 1, // ##
    ElementHidingException = 2, // #@#
    ExtendedElementHiding = 3, // #?#
    ExtendedElementHidingException = 4, // #@?#

    AbpSnippet = 5, // #$#
    AbpSnippetException = 6, // #@$#

    AdgExtendedCssInjection = 7, // #$?#
    AdgExtendedCssInjectionException = 8, // #@$?#

    AdgJsInjection = 9, // #%#
    AdgJsInjectionException = 10, // #@%#

    AdgHtmlFiltering = 11, // $$
    AdgHtmlFilteringException = 12, // $@$
}

/**
 * Bit layout of the packed separator value (32-bit):
 *
 * ```
 * [31..24]  CosmeticSepKind  (8 bits, values 0–12)
 * [23.. 0]  token index      (24 bits, max 16 M tokens)
 * ```
 */
const SEP_KIND_SHIFT = 24;
const SEP_IDX_MASK = 0x00ff_ffff;

/**
 * Unpacks the {@link CosmeticSepKind} from a packed separator value.
 *
 * @param packed Packed value returned by `findCosmeticSeparator`.
 * @returns The cosmetic separator kind.
 */
export function cosmeticSepKind(packed: number): CosmeticSepKind {
    return (packed >>> SEP_KIND_SHIFT) as CosmeticSepKind;
}

/**
 * Unpacks the token index from a packed separator value.
 *
 * @param packed Packed value returned by `findCosmeticSeparator`.
 * @returns The token index of the first token of the cosmetic separator.
 */
export function cosmeticSepIndex(packed: number): number {
    return packed & SEP_IDX_MASK;
}

/**
 * Scans the token stream for the first cosmetic separator.
 *
 * Returns a packed value — use `cosmeticSepKind` and `cosmeticSepIndex` to
 * read the fields — or `-1` if no separator is found.
 *
 * @param types Token type array from the tokenizer.
 * @param tokenCount Number of valid tokens in `types`.
 * @returns Packed `(kind << 24 | tokenIndex)`, or `-1` if not found.
 */
export function findCosmeticSeparator(types: Uint8Array, tokenCount: number): number {
    const HM = TokenType.HashMark;
    const DS = TokenType.DollarSign;
    const AT = TokenType.AtSign;
    const QM = TokenType.QuestionMark;
    const PC = TokenType.Percent;

    const SH = SEP_KIND_SHIFT;

    // Main loop: safe to read up to i + 4 (requires tokenCount >= 5)
    let i = 0;
    const mainEnd = tokenCount - 5;

    for (; i <= mainEnd; i += 1) {
        const t0 = types[i];

        if (t0 === DS) {
            const t1 = types[i + 1];
            if (t1 === DS) {
                return (CosmeticSepKind.AdgHtmlFiltering << SH) | i; // $$
            }
            if (t1 === AT && types[i + 2] === DS) {
                return (CosmeticSepKind.AdgHtmlFilteringException << SH) | i; // $@$
            }
            continue;
        }

        if (t0 !== HM) {
            continue;
        }

        const t1 = types[i + 1];

        if (t1 === HM) {
            return (CosmeticSepKind.ElementHiding << SH) | i; // ##
        }
        if (t1 === QM && types[i + 2] === HM) {
            return (CosmeticSepKind.ExtendedElementHiding << SH) | i; // #?#
        }
        if (t1 === PC && types[i + 2] === HM) {
            return (CosmeticSepKind.AdgJsInjection << SH) | i; // #%#
        }

        if (t1 === DS) {
            const t2 = types[i + 2];
            if (t2 === HM) {
                return (CosmeticSepKind.AbpSnippet << SH) | i; // #$#
            }
            if (t2 === QM && types[i + 3] === HM) {
                return (CosmeticSepKind.AdgExtendedCssInjection << SH) | i; // #$?#
            }
            continue;
        }

        if (t1 === AT) {
            const t2 = types[i + 2];
            if (t2 === HM) {
                return (CosmeticSepKind.ElementHidingException << SH) | i; // #@#
            }
            if (t2 === QM && types[i + 3] === HM) {
                return (CosmeticSepKind.ExtendedElementHidingException << SH) | i; // #@?#
            }
            if (t2 === PC && types[i + 3] === HM) {
                return (CosmeticSepKind.AdgJsInjectionException << SH) | i; // #@%#
            }
            if (t2 === DS) {
                const t3 = types[i + 3];
                if (t3 === HM) {
                    return (CosmeticSepKind.AbpSnippetException << SH) | i; // #@$#
                }
                if (t3 === QM && types[i + 4] === HM) {
                    return (CosmeticSepKind.AdgExtendedCssInjectionException << SH) | i; // #@$?#
                }
            }
        }
    }

    // Tail loop: last 0–4 tokens, requires bounds checks
    for (; i < tokenCount; i += 1) {
        const t0 = types[i];

        if (t0 === DS) {
            if (i + 1 >= tokenCount) {
                continue;
            }
            const t1 = types[i + 1];
            if (t1 === DS) {
                return (CosmeticSepKind.AdgHtmlFiltering << SH) | i;
            }
            if (t1 === AT && i + 2 < tokenCount && types[i + 2] === DS) {
                return (CosmeticSepKind.AdgHtmlFilteringException << SH) | i;
            }
            continue;
        }

        if (t0 !== HM) {
            continue;
        }
        if (i + 1 >= tokenCount) {
            continue;
        }

        const t1 = types[i + 1];
        if (t1 === HM) {
            return (CosmeticSepKind.ElementHiding << SH) | i;
        }
        if (t1 === QM && i + 2 < tokenCount && types[i + 2] === HM) {
            return (CosmeticSepKind.ExtendedElementHiding << SH) | i;
        }
        if (t1 === PC && i + 2 < tokenCount && types[i + 2] === HM) {
            return (CosmeticSepKind.AdgJsInjection << SH) | i;
        }

        if (t1 === DS) {
            if (i + 2 >= tokenCount) {
                continue;
            }
            const t2 = types[i + 2];
            if (t2 === HM) {
                return (CosmeticSepKind.AbpSnippet << SH) | i;
            }
            if (t2 === QM && i + 3 < tokenCount && types[i + 3] === HM) {
                return (CosmeticSepKind.AdgExtendedCssInjection << SH) | i;
            }
            continue;
        }

        if (t1 === AT) {
            if (i + 2 >= tokenCount) {
                continue;
            }
            const t2 = types[i + 2];
            if (t2 === HM) {
                return (CosmeticSepKind.ElementHidingException << SH) | i;
            }
            if (t2 === QM && i + 3 < tokenCount && types[i + 3] === HM) {
                return (CosmeticSepKind.ExtendedElementHidingException << SH) | i;
            }
            if (t2 === PC && i + 3 < tokenCount && types[i + 3] === HM) {
                return (CosmeticSepKind.AdgJsInjectionException << SH) | i;
            }
            if (t2 === DS) {
                if (i + 3 >= tokenCount) {
                    continue;
                }
                const t3 = types[i + 3];
                if (t3 === HM) {
                    return (CosmeticSepKind.AbpSnippetException << SH) | i;
                }
                if (t3 === QM && i + 4 < tokenCount && types[i + 4] === HM) {
                    return (CosmeticSepKind.AdgExtendedCssInjectionException << SH) | i;
                }
            }
        }
    }

    return -1;
}
