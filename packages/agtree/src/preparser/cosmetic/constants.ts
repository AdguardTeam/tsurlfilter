/* eslint-disable no-bitwise, jsdoc/require-description-complete-sentence */

/**
 * @file Cosmetic rule preparser data layout constants.
 *
 * ## Cosmetic Rule Data Layout (Int32Array)
 *
 * Header fields (CR_HEADER_SIZE = 4):
 *   [0] flags           - Bit flags (exception, sepKind, hasAdgMods, hasUboMods)
 *   [1] SepSourceStart  - Source index where cosmetic separator starts.
 *   [2] domainCount     - Number of domain items
 *   [3] bodyStart       - Source index where body starts (after separator, trimmed)
 *   [4] modifierCount   - Number of modifiers (reuses NR_MODIFIER_COUNT_OFFSET).
 *
 * ADG modifier records (starting at offset 5, stride 5 each):
 *   Reuses the network rule modifier record layout.
 *
 * UBO modifier records (starting at offset 5, stride 7 each — mutually exclusive with ADG).
 *   [+0] nameStart      - Source index where modifier name begins
 *   [+1] nameEnd        - Source index where modifier name ends (exclusive)
 *   [+2] flags          - Modifier flags (MODIFIER_FLAG_NEGATED for :not() wrapping)
 *   [+3] valueStart     - Source index where value begins, or NO_VALUE (-1)
 *   [+4] valueEnd       - Source index where value ends (exclusive), or NO_VALUE (-1)
 *   [+5] srcStart       - Source index where full modifier range starts (incl. : or :not()
 *   [+6] srcEnd         - Source index where full modifier range ends (incl. closing )).
 *
 * Domain records (starting at offset 5 + maxMods*stride, stride 3 each):
 *   [+0] valueStart     - Source index where domain value starts (after ~)
 *   [+1] valueEnd       - Source index where domain value ends (exclusive)
 *   [+2] flags          - Domain flags (DOMAIN_FLAG_EXCEPTION)
 */

import type { CosmeticRuleSeparator } from '../../nodes';
import { CosmeticSepKind } from '../cosmetic-separator';

/**
 * Buffer offset: cosmetic rule flags.
 */
export const CR_FLAGS_OFFSET = 0;

/**
 * Buffer offset: separator source start position.
 */
export const CR_SEP_SOURCE_START = 1;

/**
 * Buffer offset: number of domain items.
 */
export const CR_DOMAIN_COUNT = 2;

/**
 * Buffer offset: body start position (after separator, trimmed).
 */
export const CR_BODY_START = 3;

/**
 * Cosmetic rule flag bit: exception rule.
 */
export const CR_FLAG_EXCEPTION = 1;

/**
 * Cosmetic rule flag bit: has AdGuard modifiers ([$...]).
 */
export const CR_FLAG_HAS_ADG_MODS = 1 << 5;

/**
 * Cosmetic rule flag bit: has uBO modifiers.
 */
export const CR_FLAG_HAS_UBO_MODS = 1 << 6;

/**
 * Bit shift for packing CosmeticSepKind into flags.
 */
export const CR_SEP_KIND_SHIFT = 1;

/**
 * Bit mask for extracting CosmeticSepKind from flags (4 bits: values 1-4 for element hiding).
 */
export const CR_SEP_KIND_MASK = 0x0f;

/**
 * Record size: number of Int32Array slots per domain record.
 */
export const DOMAIN_RECORD_STRIDE = 3;

/**
 * Domain record field: start offset of domain value (after ~).
 */
export const DOMAIN_FIELD_VALUE_START = 0;

/**
 * Domain record field: end offset of domain value (exclusive).
 */
export const DOMAIN_FIELD_VALUE_END = 1;

/**
 * Domain record field: domain flags.
 */
export const DOMAIN_FIELD_FLAGS = 2;

/**
 * Domain flag bit: exception domain (starts with ~).
 */
export const DOMAIN_FLAG_EXCEPTION = 1;

// ---------------------------------------------------------------------------
// uBO modifier record constants
// ---------------------------------------------------------------------------

/**
 * Record size: number of Int32Array slots per uBO modifier record.
 * Extends the standard 5-field layout with 2 extra fields for source range.
 */
export const UBO_MODIFIER_RECORD_STRIDE = 7;

/**
 * UBO modifier record field: start offset of modifier name.
 */
export const UBO_MOD_FIELD_NAME_START = 0;

/**
 * UBO modifier record field: end offset of modifier name (exclusive).
 */
export const UBO_MOD_FIELD_NAME_END = 1;

/**
 * UBO modifier record field: modifier flags (MODIFIER_FLAG_NEGATED for :not() wrapping).
 */
export const UBO_MOD_FIELD_FLAGS = 2;

/**
 * UBO modifier record field: start offset of value, or NO_VALUE (-1).
 */
export const UBO_MOD_FIELD_VALUE_START = 3;

/**
 * UBO modifier record field: end offset of value (exclusive), or NO_VALUE (-1).
 */
export const UBO_MOD_FIELD_VALUE_END = 4;

/**
 * UBO modifier record field: source start of full modifier range
 * (including leading `:` or `:not(` wrappers).
 */
export const UBO_MOD_FIELD_SRC_START = 5;

/**
 * UBO modifier record field: source end of full modifier range
 * (including closing `)` and any `:not()` closing parens).
 */
export const UBO_MOD_FIELD_SRC_END = 6;

/**
 * Offset in ctx.data where uBO modifier records begin.
 * Same as NR_MODIFIER_RECORDS_OFFSET (5) since ADG and uBO mods are mutually exclusive.
 */
export const CR_UBO_MODS_OFFSET = 5;

// ---------------------------------------------------------------------------
// uBO modifier bitmask constants (for zero-allocation duplicate detection)
// ---------------------------------------------------------------------------

/**
 * Bitmask for :matches-path modifier (bit 0).
 */
export const UBO_MOD_BIT_MATCHES_PATH = 1;

/**
 * Bitmask for :matches-media modifier (bit 1).
 */
export const UBO_MOD_BIT_MATCHES_MEDIA = 1 << 1;

/**
 * Bitmask for :style modifier (bit 2).
 */
export const UBO_MOD_BIT_STYLE = 1 << 2;

/**
 * Bitmask for :remove modifier (bit 3).
 */
export const UBO_MOD_BIT_REMOVE = 1 << 3;

/**
 * Returns the token count of a cosmetic separator.
 *
 * @param kind CosmeticSepKind value.
 *
 * @returns Separator length in tokens.
 */
export function cosmeticSepTokenCount(kind: CosmeticSepKind): number {
    switch (kind) {
        case CosmeticSepKind.ElementHiding: // ##
        case CosmeticSepKind.AdgHtmlFiltering: // $$
            return 2;
        case CosmeticSepKind.ElementHidingException: // #@#
        case CosmeticSepKind.ExtendedElementHiding: // #?#
        case CosmeticSepKind.AbpSnippet: // #$#
        case CosmeticSepKind.AdgJsInjection: // #%#
        case CosmeticSepKind.AdgHtmlFilteringException: // $@$
            return 3;
        case CosmeticSepKind.ExtendedElementHidingException: // #@?#
        case CosmeticSepKind.AbpSnippetException: // #@$#
        case CosmeticSepKind.AdgExtendedCssInjection: // #$?#
        case CosmeticSepKind.AdgJsInjectionException: // #@%#
            return 4;
        case CosmeticSepKind.AdgExtendedCssInjectionException: // #@$?#
            return 5;
        default:
            return 0;
    }
}

/**
 * Returns the character length of a cosmetic separator.
 *
 * @param kind CosmeticSepKind value.
 *
 * @returns Separator length in characters.
 */
export function cosmeticSepLength(kind: CosmeticSepKind): number {
    switch (kind) {
        case CosmeticSepKind.ElementHiding: // ##
        case CosmeticSepKind.AdgHtmlFiltering: // $$
            return 2;
        case CosmeticSepKind.ElementHidingException: // #@#
        case CosmeticSepKind.ExtendedElementHiding: // #?#
        case CosmeticSepKind.AbpSnippet: // #$#
        case CosmeticSepKind.AdgJsInjection: // #%#
        case CosmeticSepKind.AdgHtmlFilteringException: // $@$
            return 3;
        case CosmeticSepKind.ExtendedElementHidingException: // #@?#
        case CosmeticSepKind.AbpSnippetException: // #@$#
        case CosmeticSepKind.AdgExtendedCssInjection: // #$?#
        case CosmeticSepKind.AdgJsInjectionException: // #@%#
            return 4;
        case CosmeticSepKind.AdgExtendedCssInjectionException: // #@$?#
            return 5;
        default:
            return 0;
    }
}

/**
 * Returns whether a cosmetic separator kind represents an exception rule.
 *
 * @param kind CosmeticSepKind value.
 *
 * @returns True if the separator is an exception type.
 */
export function cosmeticSepIsException(kind: CosmeticSepKind): boolean {
    switch (kind) {
        case CosmeticSepKind.ElementHidingException:
        case CosmeticSepKind.ExtendedElementHidingException:
        case CosmeticSepKind.AbpSnippetException:
        case CosmeticSepKind.AdgExtendedCssInjectionException:
        case CosmeticSepKind.AdgJsInjectionException:
        case CosmeticSepKind.AdgHtmlFilteringException:
            return true;
        default:
            return false;
    }
}

/**
 * Maps CosmeticSepKind to CosmeticRuleSeparator string.
 *
 * @param kind CosmeticSepKind value.
 *
 * @returns The separator string (e.g., '##', '#@#').
 */
export function cosmeticSepToString(kind: CosmeticSepKind): CosmeticRuleSeparator {
    switch (kind) {
        case CosmeticSepKind.ElementHiding:
            return '##';
        case CosmeticSepKind.ElementHidingException:
            return '#@#';
        case CosmeticSepKind.ExtendedElementHiding:
            return '#?#';
        case CosmeticSepKind.ExtendedElementHidingException:
            return '#@?#';
        case CosmeticSepKind.AbpSnippet:
            return '#$#';
        case CosmeticSepKind.AbpSnippetException:
            return '#@$#';
        case CosmeticSepKind.AdgExtendedCssInjection:
            return '#$?#';
        case CosmeticSepKind.AdgExtendedCssInjectionException:
            return '#@$?#';
        case CosmeticSepKind.AdgJsInjection:
            return '#%#';
        case CosmeticSepKind.AdgJsInjectionException:
            return '#@%#';
        case CosmeticSepKind.AdgHtmlFiltering:
            return '$$';
        case CosmeticSepKind.AdgHtmlFilteringException:
            return '$@$';
        default:
            throw new Error(`Unknown CosmeticSepKind: ${kind}`);
    }
}
