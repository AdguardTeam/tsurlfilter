/* eslint-disable no-bitwise */

/**
 * @file CSS selector list preparser data layout constants.
 *
 * ## Data Layout (Int32Array region starting at `dataOffset`)
 *
 * Header (2 slots):
 *   [dataOffset + 0]  SL_COUNT   — number of complex selectors
 *   [dataOffset + 1]  SL_FLAGS   — bitfield (reserved).
 *
 * Complex selector records (stride = 3, starting at dataOffset + SL_HEADER_SIZE):
 *   [base + 0]  COMPLEX_FIELD_CHILD_COUNT    — number of children (selectors + combinators)
 *   [base + 1]  COMPLEX_FIELD_SOURCE_START   — source start offset
 *   [base + 2]  COMPLEX_FIELD_SOURCE_END     — source end offset.
 *
 * Child records (stride = 11, starting after all complex records):
 *   [base + 0]  CHILD_FIELD_KIND             — ChildKind discriminator
 *   [base + 1]  CHILD_FIELD_SOURCE_START     — source start offset
 *   [base + 2]  CHILD_FIELD_SOURCE_END       — source end offset
 *   [base + 3]  CHILD_FIELD_0               — value_start / name_start / combinator_value
 *   [base + 4]  CHILD_FIELD_1               — value_end   / name_end
 *   [base + 5]  CHILD_FIELD_2               — operator_start / arg_start
 *   [base + 6]  CHILD_FIELD_3               — operator_end   / arg_end
 *   [base + 7]  CHILD_FIELD_4               — attr_value_start
 *   [base + 8]  CHILD_FIELD_5               — attr_value_end
 *   [base + 9]  CHILD_FIELD_6               — flag_start
 *   [base + 10] CHILD_FIELD_7               — flag_end.
 *
 * ## Field mapping per ChildKind
 *
 * | Kind                | FIELD_0..1    | FIELD_2..3     | FIELD_4..5    | FIELD_6..7  |
 * |---------------------|---------------|----------------|---------------|-------------|
 * | TypeSelector        | value start/end | NO_VALUE      | NO_VALUE      | NO_VALUE    |
 * | IdSelector          | value start/end | NO_VALUE      | NO_VALUE      | NO_VALUE    |
 * | ClassSelector       | value start/end | NO_VALUE      | NO_VALUE      | NO_VALUE    |
 * | AttributeSelector   | name start/end  | op start/end  | val start/end | flag s/e    |
 * | PseudoClassSelector | name start/end  | arg start/end | NO_VALUE      | NO_VALUE    |
 * | SelectorCombinator  | combinator type | NO_VALUE      | NO_VALUE      | NO_VALUE    |
 */

// ---------------------------------------------------------------------------
// Sentinel
// ---------------------------------------------------------------------------

/**
 * Sentinel value for absent optional fields.
 */
export const NO_VALUE = -1;

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

/**
 * Number of Int32Array slots in the selector-list header.
 */
export const SL_HEADER_SIZE = 2;

/**
 * Header slot: number of complex selectors in the list.
 */
export const SL_COUNT_OFFSET = 0;

/**
 * Header slot: bitfield for preparse-level flags (reserved).
 */
export const SL_FLAGS_OFFSET = 1;

// ---------------------------------------------------------------------------
// Complex selector records
// ---------------------------------------------------------------------------

/**
 * Record size for complex selector entries.
 */
export const COMPLEX_STRIDE = 3;

/**
 * Complex selector record field: number of children.
 */
export const COMPLEX_FIELD_CHILD_COUNT = 0;

/**
 * Complex selector record field: source start offset.
 */
export const COMPLEX_FIELD_SOURCE_START = 1;

/**
 * Complex selector record field: source end offset.
 */
export const COMPLEX_FIELD_SOURCE_END = 2;

// ---------------------------------------------------------------------------
// Child records (simple selectors + combinators)
// ---------------------------------------------------------------------------

/**
 * Record size for child entries (simple selectors and combinators).
 * Sized to accommodate AttributeSelector, which has the most fields.
 */
export const CHILD_STRIDE = 11;

/**
 * Child record field: ChildKind discriminator.
 */
export const CHILD_FIELD_KIND = 0;

/**
 * Child record field: source start offset.
 */
export const CHILD_FIELD_SOURCE_START = 1;

/**
 * Child record field: source end offset.
 */
export const CHILD_FIELD_SOURCE_END = 2;

/**
 * Child record field 0: value_start / name_start / combinator_value.
 */
export const CHILD_FIELD_0 = 3;

/**
 * Child record field 1: value_end / name_end.
 */
export const CHILD_FIELD_1 = 4;

/**
 * Child record field 2: operator_start / arg_start.
 */
export const CHILD_FIELD_2 = 5;

/**
 * Child record field 3: operator_end / arg_end.
 */
export const CHILD_FIELD_3 = 6;

/**
 * Child record field 4: attr_value_start.
 */
export const CHILD_FIELD_4 = 7;

/**
 * Child record field 5: attr_value_end.
 */
export const CHILD_FIELD_5 = 8;

/**
 * Child record field 6: flag_start.
 */
export const CHILD_FIELD_6 = 9;

/**
 * Child record field 7: flag_end.
 */
export const CHILD_FIELD_7 = 10;

// ---------------------------------------------------------------------------
// ChildKind discriminators
// ---------------------------------------------------------------------------

/**
 * Child kind values used in CHILD_FIELD_KIND.
 */
export const enum ChildKind {
    /**
     * Type (tag name) or universal (`*`) selector.
     */
    TypeSelector = 0,

    /**
     * ID selector (`#id`).
     */
    IdSelector = 1,

    /**
     * Class selector (`.class`).
     */
    ClassSelector = 2,

    /**
     * Attribute selector (`[attr=val]`).
     */
    AttributeSelector = 3,

    /**
     * Pseudo-class selector (`:hover`, `:nth-child(2n+1)`).
     */
    PseudoClassSelector = 4,

    /**
     * Selector combinator (descendant, child, next-sibling, subsequent-sibling).
     */
    SelectorCombinator = 5,
}

// ---------------------------------------------------------------------------
// Combinator value encoding (stored in CHILD_FIELD_0 for SelectorCombinator)
// ---------------------------------------------------------------------------

/**
 * Descendant combinator (whitespace).
 */
export const COMBINATOR_DESCENDANT = 0;

/**
 * Child combinator (`>`).
 */
export const COMBINATOR_CHILD = 1;

/**
 * Next-sibling combinator (`+`).
 */
export const COMBINATOR_NEXT_SIBLING = 2;

/**
 * Subsequent-sibling combinator (`~`).
 */
export const COMBINATOR_SUBSEQUENT_SIBLING = 3;

// ---------------------------------------------------------------------------
// Default capacities
// ---------------------------------------------------------------------------

/**
 * Default maximum number of complex selectors supported per selector list.
 */
export const DEFAULT_MAX_COMPLEX = 8;

/**
 * Default maximum number of child records (simple selectors + combinators)
 * supported across all complex selectors.
 */
export const DEFAULT_MAX_CHILDREN = 64;

// ---------------------------------------------------------------------------
// Minimum buffer capacity
// ---------------------------------------------------------------------------

/**
 * Minimum Int32Array slots required for the default capacity configuration:
 * 2 header + 8 * 3 complex records + 64 * 11 child records = 730.
 */
export const SL_MIN_DATA_SLOTS = SL_HEADER_SIZE
    + DEFAULT_MAX_COMPLEX * COMPLEX_STRIDE
    + DEFAULT_MAX_CHILDREN * CHILD_STRIDE;
