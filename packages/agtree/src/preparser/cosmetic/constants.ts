/* eslint-disable no-bitwise, jsdoc/require-description-complete-sentence */

/**
 * @file Cosmetic rule preparser data layout constants.
 *
 * ## Cosmetic Rule Data Layout (Int32Array)
 *
 * Header fields (CR_HEADER_SIZE = 6):
 *   [0] flags           - Bit flags (exception, sepLen, hasAdgMods, hasUboMods)
 *   [1] SepSourceStart  - Source index where cosmetic separator starts.
 *   [2] domainCount     - Number of domain items
 *   [3] bodyStart       - Source index where body starts (after separator, trimmed)
 *   [4] modifierCount   - Number of modifiers (reuses NR_MODIFIER_COUNT_OFFSET).
 *   [5] bodyEnd         - Source index where body ends (trimmed of trailing whitespace).
 *
 * ADG modifier records (starting at offset 6, stride 5 each):
 *   Reuses the network rule modifier record layout.
 *
 * UBO modifier records (starting at offset 6, stride 7 each — mutually exclusive with ADG).
 *   [+0] nameStart      - Source index where modifier name begins
 *   [+1] nameEnd        - Source index where modifier name ends (exclusive)
 *   [+2] flags          - Modifier flags (MODIFIER_FLAG_NEGATED for :not() wrapping)
 *   [+3] valueStart     - Source index where value begins, or NO_VALUE (-1)
 *   [+4] valueEnd       - Source index where value ends (exclusive), or NO_VALUE (-1)
 *   [+5] srcStart       - Source index where full modifier range starts (incl. : or :not()
 *   [+6] srcEnd         - Source index where full modifier range ends (incl. closing )).
 *
 * Domain records (starting at offset 6 + maxMods*stride, stride 3 each):
 *   [+0] valueStart     - Source index where domain value starts (after ~)
 *   [+1] valueEnd       - Source index where domain value ends (exclusive)
 *   [+2] flags          - Domain flags (DOMAIN_FLAG_EXCEPTION)
 */

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
 * Buffer offset: number of modifiers (AdGuard or uBO, mutually exclusive).
 */
export const CR_MODIFIER_COUNT_OFFSET = 4;

/**
 * Buffer offset: body end position (trimmed of trailing whitespace).
 */
export const CR_BODY_END = 5;

/**
 * Cosmetic rule flag bit: exception rule.
 */
export const CR_FLAG_EXCEPTION = 1;

/**
 * Bit shift for packing separator character length into flags (3 bits: values 2–5).
 */
export const CR_SEP_LEN_SHIFT = 1;

/**
 * Bit mask for extracting separator character length from flags.
 */
export const CR_SEP_LEN_MASK = 0x07;

/**
 * Cosmetic rule flag bit: has AdGuard modifiers ([$...]).
 */
export const CR_FLAG_HAS_ADG_MODS = 1 << 5;

/**
 * Cosmetic rule flag bit: has uBO modifiers.
 */
export const CR_FLAG_HAS_UBO_MODS = 1 << 6;

// ---------------------------------------------------------------------------
// Cosmetic sub-kind (bits 7-9) — identifies separator family
// ---------------------------------------------------------------------------

/**
 * Bit shift for packing cosmetic sub-kind into flags (3 bits).
 */
export const CR_SEP_KIND_SHIFT = 7;

/**
 * Bit mask for extracting cosmetic sub-kind from flags.
 */
export const CR_SEP_KIND_MASK = 0x07;

/**
 * Cosmetic sub-kind: element hiding (##, #@#, #?#, #@?#).
 */
export const CR_SEP_KIND_ELEMENT_HIDING = 0;

/**
 * Cosmetic sub-kind: ABP snippet (#$#, #@$#).
 */
export const CR_SEP_KIND_ABP_SNIPPET = 1;

/**
 * Cosmetic sub-kind: ADG JS injection (#%#, #@%#).
 */
export const CR_SEP_KIND_ADG_JS = 2;

// ---------------------------------------------------------------------------
// Body-type flags (bits 10-11) — identifies body prefix
// ---------------------------------------------------------------------------

/**
 * Cosmetic rule flag bit: body starts with `//scriptlet` (ADG scriptlet).
 * Only set when sub-kind is CR_SEP_KIND_ADG_JS.
 */
export const CR_FLAG_BODY_ADG_SCRIPTLET = 1 << 10;

/**
 * Cosmetic rule flag bit: body starts with `+js(` or `script:inject(`
 * (uBO scriptlet). Only set when sub-kind is CR_SEP_KIND_ELEMENT_HIDING.
 */
export const CR_FLAG_BODY_UBO_SCRIPTLET = 1 << 11;

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
// Scriptlet body preparser data layout
// ---------------------------------------------------------------------------
// Written sequentially after domain records in ctx.data.
// Layout: [snippetCallCount] then for each call:
//   [paramCount] [param0Start, param0End] [param1Start, param1End] ...
// Param start/end are source offsets. A start of -1 means null parameter.

/**
 * Maximum number of extra Int32Array slots reserved for scriptlet body data
 * (snippet call counts + parameter boundaries).
 *
 * **This is an explicit parser limit**, not an implementation artifact.
 * The layout uses 1 slot for `snippetCallCount`, then per call: 1 slot for
 * `paramCount` + 2 slots per parameter (`paramStart`, `paramEnd`). At 128
 * slots the parser can hold at most 63 parameters in a single scriptlet call
 * (1 callCount + 1 paramCount + 63×2 = 128), which is well above any
 * real-world scriptlet usage. Exceeding this limit throws a descriptive error
 * (see `ScriptletBodyPreparser` overflow guards). Unlike domain storage,
 * scriptlet body data is not grown dynamically because the limit is never
 * expected to be reached in practice.
 */
export const SCRIPTLET_BODY_DATA_CAPACITY = 128;

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
 * Offset in ctx.data where modifier records begin (AdGuard or uBO, mutually exclusive).
 */
export const CR_MODIFIER_RECORDS_OFFSET = 6;

/**
 * Offset in ctx.data where uBO modifier records begin (alias for CR_MODIFIER_RECORDS_OFFSET).
 */
export const CR_UBO_MODS_OFFSET = CR_MODIFIER_RECORDS_OFFSET;

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
