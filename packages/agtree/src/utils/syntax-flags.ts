/**
 * @file Syntax bitflag constants and helpers.
 *
 * Each bit represents a product that supports a given rule syntax.
 * Zero (SYNTAX_UNKNOWN) means detection was incomplete or skipped.
 */

/**
 * Branded type for syntax bitflags.
 *
 * Each bit represents a product: bit 0 = ADG, bit 1 = UBO, bit 2 = ABP.
 * The brand prevents accidental assignment of arbitrary numbers.
 * Use the exported SYNTAX_* constants and bitwise OR to construct valid values.
 */
export type SyntaxFlags = number & { readonly __brand: 'SyntaxFlags' };

/**
 * No syntax detected — detection incomplete or skipped.
 */
// eslint-disable-next-line no-bitwise
export const SYNTAX_UNKNOWN = 0 as SyntaxFlags;

/**
 * AdGuard syntax (bit 0).
 */
// eslint-disable-next-line no-bitwise
export const SYNTAX_ADG = (1 << 0) as SyntaxFlags;

/**
 * UBlock Origin syntax (bit 1).
 */
// eslint-disable-next-line no-bitwise
export const SYNTAX_UBO = (1 << 1) as SyntaxFlags;

/**
 * Adblock Plus syntax (bit 2).
 */
// eslint-disable-next-line no-bitwise
export const SYNTAX_ABP = (1 << 2) as SyntaxFlags;

/**
 * All products — rule is universally supported.
 */
// eslint-disable-next-line no-bitwise
export const SYNTAX_ALL = (SYNTAX_ADG | SYNTAX_UBO | SYNTAX_ABP) as SyntaxFlags;

/**
 * Check whether syntax is unknown (no bits set).
 *
 * @param flags Syntax bitflag value.
 *
 * @returns True if no product bits are set.
 */
export function isUnknown(flags: SyntaxFlags): boolean {
    return flags === SYNTAX_UNKNOWN;
}

/**
 * Check whether all product bits are set (universally supported).
 *
 * @param flags Syntax bitflag value.
 *
 * @returns True if ADG, UBO, and ABP bits are all set.
 */
export function hasAllProducts(flags: SyntaxFlags): boolean {
    return (flags & SYNTAX_ALL) === SYNTAX_ALL;
}

/**
 * Check whether a specific product bit is set.
 *
 * @param flags Syntax bitflag value.
 * @param product Single product bit to check (SYNTAX_ADG, SYNTAX_UBO, or SYNTAX_ABP).
 *
 * @returns True if the product bit is set in flags.
 */
export function hasProduct(flags: SyntaxFlags, product: SyntaxFlags): boolean {
    return (flags & product) !== 0;
}
