/* eslint-disable no-bitwise */

/**
 * @file Cosmetic rule preparser data layout constants.
 *
 * ## Cosmetic Rule Data Layout (Int32Array)
 *
 * Header fields (CR_HEADER_SIZE = 4):
 *   [0] flags           - Bit flags (exception, sepKind, hasAdgMods, hasUboMods)
 *   [1] sepSourceStart  - Source index where cosmetic separator starts
 *   [2] domainCount     - Number of domain items
 *   [3] bodyStart       - Source index where body starts (after separator, trimmed)
 *   [4] modifierCount   - Number of modifiers (reuses NR_MODIFIER_COUNT_OFFSET)
 *
 * Modifier records (starting at offset 5, stride 5 each):
 *   Reuses the network rule modifier record layout.
 *
 * Domain records (starting at offset 5 + maxMods*5, stride 3 each):
 *   [+0] valueStart     - Source index where domain value starts (after ~)
 *   [+1] valueEnd       - Source index where domain value ends (exclusive)
 *   [+2] flags          - Domain flags (DOMAIN_FLAG_EXCEPTION)
 */

import { CosmeticSepKind } from '../cosmetic-separator';
import type { CosmeticRuleSeparator } from '../../nodes';

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
            return 2;
        case CosmeticSepKind.ElementHidingException: // #@#
        case CosmeticSepKind.ExtendedElementHiding: // #?#
            return 3;
        case CosmeticSepKind.ExtendedElementHidingException: // #@?#
            return 4;
        case CosmeticSepKind.AbpSnippet: // #$#
        case CosmeticSepKind.AbpSnippetException: // #@$#
            return 3;
        case CosmeticSepKind.AdgExtendedCssInjection: // #$?#
        case CosmeticSepKind.AdgExtendedCssInjectionException: // #@$?#
            return 4;
        case CosmeticSepKind.AdgJsInjection: // #%#
        case CosmeticSepKind.AdgJsInjectionException: // #@%#
            return 3;
        case CosmeticSepKind.AdgHtmlFiltering: // $$
        case CosmeticSepKind.AdgHtmlFilteringException: // $@$
            return 2;
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
            return 2;
        case CosmeticSepKind.ElementHidingException: // #@#
        case CosmeticSepKind.ExtendedElementHiding: // #?#
            return 3;
        case CosmeticSepKind.ExtendedElementHidingException: // #@?#
            return 4;
        case CosmeticSepKind.AbpSnippet: // #$#
        case CosmeticSepKind.AbpSnippetException: // #@$#
            return 3;
        case CosmeticSepKind.AdgExtendedCssInjection: // #$?#
        case CosmeticSepKind.AdgExtendedCssInjectionException: // #@$?#
            return 4;
        case CosmeticSepKind.AdgJsInjection: // #%#
        case CosmeticSepKind.AdgJsInjectionException: // #@%#
            return 3;
        case CosmeticSepKind.AdgHtmlFiltering: // $$
        case CosmeticSepKind.AdgHtmlFilteringException: // $@$
            return 2;
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
