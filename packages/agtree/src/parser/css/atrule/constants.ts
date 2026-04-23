/* eslint-disable jsdoc/require-description-complete-sentence */

/**
 * @file CSS at-rule parser data layout constants.
 *
 * ## Data Layout (Int32Array region starting at `dataOffset`)
 *
 * Header (15 slots):
 *   [dataOffset + 0]  AT_SOURCE_START         — source offset of `@`
 *   [dataOffset + 1]  AT_NAME_SOURCE_START    — source start offset of at-rule name
 *   [dataOffset + 2]  AT_NAME_SOURCE_END      — source end offset of at-rule name
 *   [dataOffset + 3]  AT_NAME_START_TI        — token index of at-rule name first token
 *   [dataOffset + 4]  AT_NAME_END_TI          — token index: exclusive end of name tokens
 *   [dataOffset + 5]  AT_PRELUDE_SOURCE_START — source start offset of prelude (-1 if absent)
 *   [dataOffset + 6]  AT_PRELUDE_SOURCE_END   — source end offset of prelude (-1 if absent)
 *   [dataOffset + 7]  AT_PRELUDE_START_TI     — token index of first prelude token (-1 if absent)
 *   [dataOffset + 8]  AT_PRELUDE_END_TI       — token index: exclusive end of prelude tokens (-1 if absent)
 *   [dataOffset + 9]  AT_OPEN_BRACE_POS       — source offset of `{` (-1 if no block)
 *   [dataOffset + 10] AT_OPEN_BRACE_TI        — token index of `{` (-1 if no block)
 *   [dataOffset + 11] AT_CLOSE_BRACE_POS      — source offset of `}` (-1 if no block)
 *   [dataOffset + 12] AT_CLOSE_BRACE_TI       — token index of `}` (-1 if no block)
 *   [dataOffset + 13] AT_BLOCK_START_TI       — token index: first token of block content (-1 if no block)
 *   [dataOffset + 14] AT_BLOCK_END_TI         — token index: exclusive end of block content (-1 if no block)
 *
 * After the header, sub-parser regions follow contiguously:
 *   [dataOffset + AT_HEADER_SIZE ..]:
 *       CssRuleParser region (for block body content)
 */

import { CR_MIN_DATA_SLOTS } from '../rule/constants';

// Header slot offsets
export const AT_SOURCE_START = 0;
export const AT_NAME_SOURCE_START = 1;
export const AT_NAME_SOURCE_END = 2;
export const AT_NAME_START_TI = 3;
export const AT_NAME_END_TI = 4;
export const AT_PRELUDE_SOURCE_START = 5;
export const AT_PRELUDE_SOURCE_END = 6;
export const AT_PRELUDE_START_TI = 7;
export const AT_PRELUDE_END_TI = 8;
export const AT_OPEN_BRACE_POS = 9;
export const AT_OPEN_BRACE_TI = 10;
export const AT_CLOSE_BRACE_POS = 11;
export const AT_CLOSE_BRACE_TI = 12;
export const AT_BLOCK_START_TI = 13;
export const AT_BLOCK_END_TI = 14;

/**
 * Sentinel value for absent optional fields.
 */
export const AT_NO_VALUE = -1;

/**
 * Number of header slots used by the at-rule parser.
 */
export const AT_HEADER_SIZE = 15;

/**
 * Minimum buffer capacity for the at-rule parser, including sub-parser
 * region for one CssRuleParser call (block body content).
 */
export const AT_MIN_DATA_SLOTS = AT_HEADER_SIZE + CR_MIN_DATA_SLOTS;
