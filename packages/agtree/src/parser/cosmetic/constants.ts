/* eslint-disable no-bitwise, jsdoc/require-description-complete-sentence */

import { SL_MIN_DATA_SLOTS } from '../css/selector-list/constants';
import { MODIFIER_RECORD_STRIDE } from '../network/constants';

/**
 * @file Cosmetic rule parser data layout constants.
 *
 * ## Cosmetic Rule Data Layout (Int32Array)
 *
 * Header fields (CR_HEADER_SIZE = 7):
 *   [0] flags           - Bit flags (exception, sepLen, hasAdgMods, hasUboMods)
 *   [1] SepSourceStart  - Source index where cosmetic separator starts.
 *   [2] domainCount     - Number of domain items
 *   [3] bodyStart       - Source index where body starts (after separator, trimmed)
 *   [4] modifierCount   - Number of modifiers (reuses NR_MODIFIER_COUNT_OFFSET).
 *   [5] bodyEnd         - Source index where body ends (trimmed of trailing whitespace).
 *   [6] bodyStartTi     - Token index where body starts (after separator + whitespace).
 *
 * ADG modifier records (starting at offset 7, stride 5 each):
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
 * Domain records (starting at offset 7 + maxMods*stride, stride 3 each):
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
// Scriptlet body parser data layout
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
 * (see `ScriptletBodyParser` overflow guards). Unlike domain storage,
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
 * Buffer offset: body start token index (after separator + whitespace skip).
 * Used by ScriptletBodyParser to avoid re-scanning from body source position.
 */
export const CR_BODY_START_TI = 6;

/**
 * Offset in ctx.data where modifier records begin (AdGuard or uBO, mutually exclusive).
 * Follows the 7-slot header: [flags, sep, domainCount, bodyStart, modCount, bodyEnd, bodyStartTi].
 */
export const CR_MODIFIER_RECORDS_OFFSET = 7;

/**
 * Offset in ctx.data where uBO modifier records begin (alias for CR_MODIFIER_RECORDS_OFFSET).
 */
export const CR_UBO_MODS_OFFSET = CR_MODIFIER_RECORDS_OFFSET;

/**
 * Compute the selector-list data offset within a parsed cosmetic-rule buffer.
 *
 * When the rule carries an AdGuard `[$…]` modifier list (indicated by
 * {@link CR_FLAG_HAS_ADG_MODS}), the selector-list region starts after the
 * modifier records (at `CR_MODIFIER_RECORDS_OFFSET + modCount * stride`).
 * Otherwise it starts at {@link CR_MODIFIER_RECORDS_OFFSET}.
 *
 * Shared between the structural parser and the AST builder so the layout
 * rule is defined in one place.
 *
 * @param data Parsed cosmetic-rule data buffer.
 * @param dataOffset Offset within `data` where the CR header starts.
 *
 * @returns Selector-list data offset relative to `dataOffset`.
 */
export function slDataOffset(data: Int32Array, dataOffset = 0): number {
    if ((data[dataOffset + CR_FLAGS_OFFSET] & CR_FLAG_HAS_ADG_MODS) === 0) {
        return CR_MODIFIER_RECORDS_OFFSET;
    }

    const modCount = data[dataOffset + CR_MODIFIER_COUNT_OFFSET];
    return CR_MODIFIER_RECORDS_OFFSET + modCount * MODIFIER_RECORD_STRIDE;
}

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
 * Maximum number of distinct uBO pseudo-class modifiers.
 * One per seenMask bit: matches-path, matches-media, style, remove.
 */
export const EH_MAX_UBO_MODS = 4;

/**
 * Minimum `ctx.data` slots required by {@link ElementHidingParser} with
 * the default uBO modifier capacity.
 *
 * Layout: CR header (CR_MODIFIER_RECORDS_OFFSET=7) +
 *         EH_MAX_UBO_MODS(4) × UBO_MODIFIER_RECORD_STRIDE(7) = 35.
 */
export const EH_MIN_DATA_SLOTS = CR_MODIFIER_RECORDS_OFFSET + EH_MAX_UBO_MODS * UBO_MODIFIER_RECORD_STRIDE;

// ---------------------------------------------------------------------------
// HTML filtering sub-kind constants
// ---------------------------------------------------------------------------

/**
 * Cosmetic sub-kind: ADG HTML filtering ($$, $@$).
 */
export const CR_SEP_KIND_ADG_HTML_FILTERING = 3;

/**
 * Cosmetic sub-kind: uBO HTML filtering (## / #@# with ^ body prefix).
 */
export const CR_SEP_KIND_UBO_HTML_FILTERING = 4;

// ---------------------------------------------------------------------------
// HTML filtering body-type flags (bit 12)
// ---------------------------------------------------------------------------

/**
 * Cosmetic rule flag bit: body is a uBO `responseheader(...)` rule.
 * Only set when sub-kind is CR_SEP_KIND_UBO_HTML_FILTERING.
 */
export const CR_FLAG_BODY_UBO_RESPONSEHEADER = 1 << 12;

/**
 * Cosmetic rule flag bit: body contains `:style()` or `:remove()` modifier
 * (uBO CSS injection). Only set when sub-kind is CR_SEP_KIND_ELEMENT_HIDING.
 *
 * When set, the AST builder dispatcher routes to
 * `UboCssInjectionAstBuilder` instead of `ElementHidingAstBuilder`.
 */
export const CR_FLAG_BODY_UBO_CSS_INJECTION = 1 << 13;

/**
 * Cosmetic rule flag bit: body is ABP CSS injection (element hiding separator
 * with a CSS declaration block body, e.g., `##div { color: red; }`).
 * Only set when sub-kind is CR_SEP_KIND_ELEMENT_HIDING.
 */
export const CR_FLAG_BODY_ABP_CSS_INJECTION = 1 << 14;

// ---------------------------------------------------------------------------
// HTML filtering responseheader data layout
// ---------------------------------------------------------------------------
// When CR_FLAG_BODY_UBO_RESPONSEHEADER is set, the following offsets
// (relative to dataOffset) store function name and argument boundaries.

/**
 * Buffer offset: responseheader function name start.
 */
export const HF_FN_NAME_START = 7;

/**
 * Buffer offset: responseheader function name end (exclusive).
 */
export const HF_FN_NAME_END = 8;

/**
 * Buffer offset: responseheader argument start (trimmed).
 */
export const HF_ARG_START = 9;

/**
 * Buffer offset: responseheader argument end (trimmed, exclusive).
 */
export const HF_ARG_END = 10;

/**
 * Number of reserved slots for responseheader data (after CR header).
 */
export const HF_RESPONSEHEADER_SLOTS = 4;

/**
 * Minimum `ctx.data` slots required by {@link HtmlFilteringParser}.
 * Layout: CR header ({@link CR_MODIFIER_RECORDS_OFFSET}) + {@link SL_MIN_DATA_SLOTS}.
 * Also covers responseheader case: CR header (7) + 4 = 11 (fits within the total).
 */
export const HF_MIN_DATA_SLOTS = CR_MODIFIER_RECORDS_OFFSET + SL_MIN_DATA_SLOTS;

// ---------------------------------------------------------------------------
// AdGuard CSS injection sub-kind
// ---------------------------------------------------------------------------

/**
 * Cosmetic sub-kind: ADG CSS injection (#$#, #@$#, #$?#, #@$?#).
 */
export const CR_SEP_KIND_ADG_CSS_INJECTION = 5;

// ---------------------------------------------------------------------------
// CSS injection body data layout (written at CR_MODIFIER_RECORDS_OFFSET)
// ---------------------------------------------------------------------------

/**
 * CSS injection body flags.
 * Bit 0: has @media wrapper.
 * Bit 1: has `remove: true` declaration.
 */
export const CSS_INJ_FLAGS = 0;

/**
 * CSS injection flag: body starts with `@media`.
 */
export const CSS_INJ_FLAG_HAS_MEDIA = 1;

/**
 * CSS injection flag: declaration list contains `remove: true`.
 */
export const CSS_INJ_FLAG_REMOVE = 1 << 1;

/**
 * Media query list source start (-1 if no @media).
 */
export const CSS_INJ_MEDIA_QUERY_START = 1;

/**
 * Media query list source end (-1 if no @media).
 */
export const CSS_INJ_MEDIA_QUERY_END = 2;

/**
 * `@media` `{` token index (-1 if no @media).
 */
export const CSS_INJ_MEDIA_OPEN_BRACE_TI = 3;

/**
 * `@media` `}` token index (-1 if no @media).
 */
export const CSS_INJ_MEDIA_CLOSE_BRACE_TI = 4;

/**
 * Selector list source start.
 */
export const CSS_INJ_SL_SOURCE_START = 5;

/**
 * Selector list source end.
 */
export const CSS_INJ_SL_SOURCE_END = 6;

/**
 * Selector list start token index.
 */
export const CSS_INJ_SL_START_TI = 7;

/**
 * Selector list end token index (exclusive).
 */
export const CSS_INJ_SL_END_TI = 8;

/**
 * Rule `{` token index.
 */
export const CSS_INJ_OPEN_BRACE_TI = 9;

/**
 * Rule `}` token index.
 */
export const CSS_INJ_CLOSE_BRACE_TI = 10;

/**
 * Declaration list source start.
 */
export const CSS_INJ_DL_SOURCE_START = 11;

/**
 * Declaration list source end.
 */
export const CSS_INJ_DL_SOURCE_END = 12;

/**
 * Declaration list start token index.
 */
export const CSS_INJ_DL_START_TI = 13;

/**
 * Declaration list end token index (exclusive).
 */
export const CSS_INJ_DL_END_TI = 14;

/**
 * Number of fixed header slots for CSS injection body data.
 */
export const CSS_INJ_HEADER_SIZE = 15;

/**
 * Minimum `ctx.data` slots for AdgCssInjectionParser (header only).
 */
export const CSS_INJ_MIN_DATA_SLOTS = CSS_INJ_HEADER_SIZE;
