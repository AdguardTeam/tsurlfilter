/* eslint-disable no-bitwise, jsdoc/require-description-complete-sentence */

/**
 * @file CSS declaration list parser data layout constants.
 *
 * ## Data Layout (Int32Array region starting at `dataOffset`)
 *
 * Header (1 slot):
 *   [dataOffset + 0]  DL_COUNT  — number of declarations.
 *
 * Declaration records (stride = 6, starting at dataOffset + DL_HEADER_SIZE):
 *   [base + 0]  DECL_FIELD_PROPERTY_START  — source start offset of property name
 *   [base + 1]  DECL_FIELD_PROPERTY_END    — source end offset of property name
 *   [base + 2]  DECL_FIELD_VALUE_START     — source start offset of trimmed value (excl. !important)
 *   [base + 3]  DECL_FIELD_VALUE_END       — source end offset of trimmed value (excl. !important)
 *   [base + 4]  DECL_FIELD_IMPORTANT       — 1 if !important, 0 otherwise
 *   [base + 5]  DECL_FIELD_DECL_END        — source end offset of full declaration (incl. !important)
 */

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

/**
 * Number of Int32Array slots in the declaration-list header.
 */
export const DL_HEADER_SIZE = 1;

/**
 * Header slot: number of declarations in the list.
 */
export const DL_COUNT_OFFSET = 0;

// ---------------------------------------------------------------------------
// Declaration records
// ---------------------------------------------------------------------------

/**
 * Record size for declaration entries.
 */
export const DECL_STRIDE = 6;

/**
 * Declaration record field: source start offset of property name.
 */
export const DECL_FIELD_PROPERTY_START = 0;

/**
 * Declaration record field: source end offset of property name.
 */
export const DECL_FIELD_PROPERTY_END = 1;

/**
 * Declaration record field: source start offset of trimmed value.
 */
export const DECL_FIELD_VALUE_START = 2;

/**
 * Declaration record field: source end offset of trimmed value.
 */
export const DECL_FIELD_VALUE_END = 3;

/**
 * Declaration record field: 1 if !important, 0 otherwise.
 */
export const DECL_FIELD_IMPORTANT = 4;

/**
 * Declaration record field: source end offset of the full declaration,
 * including the `!important` suffix when present.
 */
export const DECL_FIELD_DECL_END = 5;

// ---------------------------------------------------------------------------
// Default capacities
// ---------------------------------------------------------------------------

/**
 * Default maximum number of declarations supported per declaration list.
 * Most CSS injection rules have 1-3 declarations; 16 provides headroom.
 */
export const DEFAULT_MAX_DECLARATIONS = 16;

// ---------------------------------------------------------------------------
// Minimum buffer capacity
// ---------------------------------------------------------------------------

/**
 * Minimum Int32Array slots required for the default capacity configuration:
 * 1 header + 16 * 6 declaration records = 97.
 */
export const DL_MIN_DATA_SLOTS = DL_HEADER_SIZE
    + DEFAULT_MAX_DECLARATIONS * DECL_STRIDE;
