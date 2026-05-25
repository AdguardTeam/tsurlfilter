/**
 * @file Network rule parser data layout constants.
 *
 * Separated from network-rule.ts to avoid circular dependencies with
 * modifier parsers.
 *
 * ## Network Rule Data Layout (Int32Array)
 *
 * Header fields (NR_HEADER_SIZE = 5):
 *   [0] flags           - Bit flags (FLAG_EXCEPTION, etc.)
 *   [1] patternStart    - Source index where pattern begins
 *   [2] patternEnd      - Source index where pattern ends (exclusive)
 *   [3] separatorIndex  - Source index of the '$' separator, or NO_VALUE (-1)
 *   [4] modifierCount   - Number of modifiers parsed.
 *
 * Modifier records (MOD_STRIDE = 5 each, starting at offset NR_HEADER_SIZE):
 *   [+0] nameStart      - Source index where modifier name begins
 *   [+1] nameEnd        - Source index where modifier name ends (exclusive)
 *   [+2] flags          - Modifier flags (MOD_FLAG_NEGATED, etc.)
 *   [+3] valueStart     - Source index where value begins, or NO_VALUE (-1)
 *   [+4] valueEnd       - Source index where value ends (exclusive), or NO_VALUE (-1).
 */

/**
 * Buffer offset: rule flags (exception bit, etc.).
 */
export const NR_FLAGS_OFFSET = 0;

/**
 * Buffer offset: pattern start position.
 */
export const NR_PATTERN_START_OFFSET = 1;

/**
 * Buffer offset: pattern end position.
 */
export const NR_PATTERN_END_OFFSET = 2;

/**
 * Buffer offset: separator ('$') position (or -1 if absent).
 */
export const NR_SEPARATOR_INDEX_OFFSET = 3;

/**
 * Buffer offset: number of modifiers.
 */
export const NR_MODIFIER_COUNT_OFFSET = 4;

/**
 * Buffer offset: where modifier records begin.
 */
export const NR_MODIFIER_RECORDS_OFFSET = 5;

/**
 * Rule flag bit: exception rule (starts with @@).
 */
export const NR_FLAG_EXCEPTION = 1;

/**
 * Rule flag bit: pattern is a regex literal (delimited by `/`).
 */
export const NR_FLAG_PATTERN_REGEX = 1 << 1;

/**
 * Record size: number of Int32Array slots per modifier.
 */
export const MODIFIER_RECORD_STRIDE = 5;

/**
 * Record field: start offset of modifier name.
 */
export const MODIFIER_FIELD_NAME_START = 0;

/**
 * Record field: end offset of modifier name.
 */
export const MODIFIER_FIELD_NAME_END = 1;

/**
 * Record field: modifier flags (negation bit, etc.).
 */
export const MODIFIER_FIELD_FLAGS = 2;

/**
 * Record field: start offset of value (or -1 if absent).
 */
export const MODIFIER_FIELD_VALUE_START = 3;

/**
 * Record field: end offset of value (or -1 if absent).
 */
export const MODIFIER_FIELD_VALUE_END = 4;

/**
 * Modifier flag bit: negated modifier (starts with ~).
 */
export const MODIFIER_FLAG_NEGATED = 1;

/*
 * MODIFIER_FIELD_FLAGS bit layout:
 *
 *   bit  0      : MODIFIER_FLAG_NEGATED  — modifier is negated (~name)
 *   bits 1..4   : value kind             — MODIFIER_VALUE_KIND_SHIFT=1, MASK=0x0F
 *                                          (16 possible kind values)
 *   bits 5..31  : reserved
 *
 * Composition example:
 *   modFlags = MODIFIER_FLAG_NEGATED | (MOD_KIND_DOMAIN_LIST << MODIFIER_VALUE_KIND_SHIFT);
 */

/**
 * Bit shift for modifier value kind (bits 1-4 of MODIFIER_FIELD_FLAGS).
 */
export const MODIFIER_VALUE_KIND_SHIFT = 1;

/**
 * Bit mask for extracting modifier value kind (4 bits → 16 values).
 */
export const MODIFIER_VALUE_KIND_MASK = 0x0F;

/**
 * Modifier value kind: unset / unknown.
 */
export const MOD_KIND_UNKNOWN = 0;

/**
 * Modifier value kind: regex pattern (/pattern/flags).
 */
export const MOD_KIND_REGEX = 1;

/**
 * Modifier value kind: domain list (pipe or comma separated).
 */
export const MOD_KIND_DOMAIN_LIST = 2;

/**
 * Modifier value kind: CSP directive.
 */
export const MOD_KIND_CSP = 3;

/**
 * Modifier value kind: resource name (redirect target).
 */
export const MOD_KIND_RESOURCE = 4;

/**
 * Sentinel value for absent data (-1).
 */
export const NO_VALUE = -1;

/**
 * Default maximum number of modifiers per network rule.
 * Must match the default in {@link createParserContext}.
 */
export const NR_DEFAULT_MAX_MODIFIERS = 64;

/**
 * Minimum `ctx.data` slots required by {@link NetworkRuleParser} with the
 * default modifier capacity.
 *
 * Layout: header (NR_MODIFIER_RECORDS_OFFSET=5) +
 *         NR_DEFAULT_MAX_MODIFIERS(64) × MODIFIER_RECORD_STRIDE(5) = 325.
 */
export const NR_MIN_DATA_SLOTS = NR_MODIFIER_RECORDS_OFFSET + NR_DEFAULT_MAX_MODIFIERS * MODIFIER_RECORD_STRIDE;
