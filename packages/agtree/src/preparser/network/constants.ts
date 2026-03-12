/**
 * @file Network rule preparser data layout constants.
 *
 * Separated from network-rule.ts to avoid circular dependencies with
 * modifier preparsers.
 *
 * ## Network Rule Data Layout (Int32Array)
 *
 * Header fields (NR_HEADER_SIZE = 5):
 *   [0] flags           - Bit flags (FLAG_EXCEPTION, etc.)
 *   [1] patternStart    - Source index where pattern begins
 *   [2] patternEnd      - Source index where pattern ends (exclusive)
 *   [3] separatorIndex  - Source index of the '$' separator, or NO_VALUE (-1)
 *   [4] modifierCount   - Number of modifiers parsed
 *
 * Modifier records (MOD_STRIDE = 5 each, starting at offset NR_HEADER_SIZE):
 *   [+0] nameStart      - Source index where modifier name begins
 *   [+1] nameEnd        - Source index where modifier name ends (exclusive)
 *   [+2] flags          - Modifier flags (MOD_FLAG_NEGATED, etc.)
 *   [+3] valueStart     - Source index where value begins, or NO_VALUE (-1)
 *   [+4] valueEnd       - Source index where value ends (exclusive), or NO_VALUE (-1)
 */

// Network Rule Header Field Offsets

export const NR_FLAGS = 0;
export const NR_PATTERN_START = 1;
export const NR_PATTERN_END = 2;
export const NR_SEPARATOR_INDEX = 3;
export const NR_MODIFIER_COUNT = 4;
export const NR_HEADER_SIZE = 5;

// Network Rule Flag Bits

export const FLAG_EXCEPTION = 1;

// Modifier Record Layout

export const MOD_STRIDE = 5;
export const MOD_NAME_START = 0;
export const MOD_NAME_END = 1;
export const MOD_FLAGS = 2;
export const MOD_VALUE_START = 3;
export const MOD_VALUE_END = 4;

// Modifier Flag Bits

export const MOD_FLAG_NEGATED = 1;

// Sentinel

export const NO_VALUE = -1;
