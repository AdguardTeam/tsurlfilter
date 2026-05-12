/**
 * @file Hard-cap constants for growable parser buffers.
 *
 * These are theoretical maxima — growth past these caps raises a
 * {@link CapacityOverflowError}. They are NOT user-configurable.
 *
 * Sized to comfortably exceed any observed real-world filter rule
 * (largest known `$domain=` values are ~2 000 entries; we cap at 65 536).
 */

/**
 * Hard cap for tokenizer `types` / `ends` length.
 */
export const MAX_TOKEN_CAPACITY = 262_144;

/**
 * Hard cap for modifier records per rule.
 */
export const MAX_MODIFIER_CAPACITY = 65_536;

/**
 * Hard cap for domain records per rule.
 */
export const MAX_DOMAIN_CAPACITY = 65_536;

/**
 * Hard cap for the scriptlet body region (Int32 slots).
 */
export const MAX_SCRIPTLET_BODY_CAPACITY = 65_536;
