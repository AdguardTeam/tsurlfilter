/* eslint-disable no-bitwise */

/**
 * @file Cosmetic separator detection for the preparser.
 *
 * Scans a raw token-type array for the first cosmetic separator and returns a
 * packed (tokenCount, token-index) value — no string allocations.
 *
 * The caller derives the separator string from the source via start/end
 * positions; no enum or lookup table is needed.
 */

import { TokenType } from '../tokenizer/token-types';

/**
 * Bit layout of the packed separator value (32-bit):.
 *
 * ```
 * [31..24]  separator token count  (8 bits, values 2–5)
 * [23.. 0]  start token index      (24 bits, max 16 M tokens)
 * ```
 */
const SEP_COUNT_SHIFT = 24;
const SEP_IDX_MASK = 0x00ff_ffff;

/**
 * Unpacks the separator token count from a packed separator value.
 *
 * @param packed Packed value returned by `findCosmeticSeparator`.
 *
 * @returns Number of tokens the separator spans (2–5).
 */
export function cosmeticSepTokenCount(packed: number): number {
    return packed >>> SEP_COUNT_SHIFT;
}

/**
 * Unpacks the start token index from a packed separator value.
 *
 * @param packed Packed value returned by `findCosmeticSeparator`.
 *
 * @returns The token index of the first token of the cosmetic separator.
 */
export function cosmeticSepStartIndex(packed: number): number {
    return packed & SEP_IDX_MASK;
}

/**
 * Scans the token stream for the first cosmetic separator.
 *
 * Returns a packed value — use `cosmeticSepTokenCount` and
 * `cosmeticSepStartIndex` to read the fields — or `-1` if no separator is
 * found.
 *
 * @param types Token type array from the tokenizer.
 * @param tokenCount Number of valid tokens in `types`.
 *
 * @returns Packed `(sepTokenCount << 24 | startTokenIndex)`, or `-1`.
 */
export function findCosmeticSeparator(types: Uint8Array, tokenCount: number): number {
    const HM = TokenType.HashMark;
    const DS = TokenType.DollarSign;
    const AT = TokenType.AtSign;
    const QM = TokenType.QuestionMark;
    const PC = TokenType.Percent;

    const SH = SEP_COUNT_SHIFT;

    // Main loop: safe to read up to i + 4 (requires tokenCount >= 5)
    let i = 0;
    const mainEnd = tokenCount - 5;

    for (; i <= mainEnd; i += 1) {
        const t0 = types[i];

        if (t0 === DS) {
            const t1 = types[i + 1];
            if (t1 === DS) {
                return (2 << SH) | i; // $$
            }
            if (t1 === AT && types[i + 2] === DS) {
                return (3 << SH) | i; // $@$
            }
            continue;
        }

        if (t0 !== HM) {
            continue;
        }

        const t1 = types[i + 1];

        if (t1 === HM) {
            return (2 << SH) | i; // ##
        }
        if (t1 === QM && types[i + 2] === HM) {
            return (3 << SH) | i; // #?#
        }
        if (t1 === PC && types[i + 2] === HM) {
            return (3 << SH) | i; // #%#
        }

        if (t1 === DS) {
            const t2 = types[i + 2];
            if (t2 === HM) {
                return (3 << SH) | i; // #$#
            }
            if (t2 === QM && types[i + 3] === HM) {
                return (4 << SH) | i; // #$?#
            }
            continue;
        }

        if (t1 === AT) {
            const t2 = types[i + 2];
            if (t2 === HM) {
                return (3 << SH) | i; // #@#
            }
            if (t2 === QM && types[i + 3] === HM) {
                return (4 << SH) | i; // #@?#
            }
            if (t2 === PC && types[i + 3] === HM) {
                return (4 << SH) | i; // #@%#
            }
            if (t2 === DS) {
                const t3 = types[i + 3];
                if (t3 === HM) {
                    return (4 << SH) | i; // #@$#
                }
                if (t3 === QM && types[i + 4] === HM) {
                    return (5 << SH) | i; // #@$?#
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
                return (2 << SH) | i;
            }
            if (t1 === AT && i + 2 < tokenCount && types[i + 2] === DS) {
                return (3 << SH) | i;
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
            return (2 << SH) | i;
        }
        if (t1 === QM && i + 2 < tokenCount && types[i + 2] === HM) {
            return (3 << SH) | i;
        }
        if (t1 === PC && i + 2 < tokenCount && types[i + 2] === HM) {
            return (3 << SH) | i;
        }

        if (t1 === DS) {
            if (i + 2 >= tokenCount) {
                continue;
            }
            const t2 = types[i + 2];
            if (t2 === HM) {
                return (3 << SH) | i;
            }
            if (t2 === QM && i + 3 < tokenCount && types[i + 3] === HM) {
                return (4 << SH) | i;
            }
            continue;
        }

        if (t1 === AT) {
            if (i + 2 >= tokenCount) {
                continue;
            }
            const t2 = types[i + 2];
            if (t2 === HM) {
                return (3 << SH) | i;
            }
            if (t2 === QM && i + 3 < tokenCount && types[i + 3] === HM) {
                return (4 << SH) | i;
            }
            if (t2 === PC && i + 3 < tokenCount && types[i + 3] === HM) {
                return (4 << SH) | i;
            }
            if (t2 === DS) {
                if (i + 3 >= tokenCount) {
                    continue;
                }
                const t3 = types[i + 3];
                if (t3 === HM) {
                    return (4 << SH) | i;
                }
                if (t3 === QM && i + 4 < tokenCount && types[i + 4] === HM) {
                    return (5 << SH) | i;
                }
            }
        }
    }

    return -1;
}
