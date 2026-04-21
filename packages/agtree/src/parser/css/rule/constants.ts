/* eslint-disable jsdoc/require-description-complete-sentence */

/**
 * @file CSS rule parser data layout constants.
 *
 * ## Data Layout (Int32Array region starting at `dataOffset`)
 *
 * Header (12 slots):
 *   [dataOffset + 0]  CR_SL_SOURCE_START     — source start offset of selector list
 *   [dataOffset + 1]  CR_SL_SOURCE_END       — source end offset of selector list
 *   [dataOffset + 2]  CR_SL_START_TI         — token index: first token of selector list
 *   [dataOffset + 3]  CR_SL_END_TI           — token index: exclusive end of selector list
 *   [dataOffset + 4]  CR_OPEN_BRACE_SOURCE_POS  — source offset of `{`
 *   [dataOffset + 5]  CR_OPEN_BRACE_TI       — token index of `{`
 *   [dataOffset + 6]  CR_CLOSE_BRACE_SOURCE_POS — source offset of `}`
 *   [dataOffset + 7]  CR_CLOSE_BRACE_TI      — token index of `}`
 *   [dataOffset + 8]  CR_DL_SOURCE_START     — source start offset of declaration list
 *   [dataOffset + 9]  CR_DL_SOURCE_END       — source end offset of declaration list
 *   [dataOffset + 10] CR_DL_START_TI         — token index: first token of declaration list
 *   [dataOffset + 11] CR_DL_END_TI           — token index: exclusive end of declaration list
 *
 * After the header, sub-parser regions follow contiguously:
 *   [dataOffset + CR_HEADER_SIZE .. + CR_HEADER_SIZE + SL_MIN_DATA_SLOTS - 1]:
 *       selector list parser region
 *   [dataOffset + CR_HEADER_SIZE + SL_MIN_DATA_SLOTS ..]:
 *       declaration list parser region
 */

import { DL_MIN_DATA_SLOTS } from '../declaration-list/constants';
import { SL_MIN_DATA_SLOTS } from '../selector-list/constants';

// Header slot offsets
export const CR_SL_SOURCE_START = 0;
export const CR_SL_SOURCE_END = 1;
export const CR_SL_START_TI = 2;
export const CR_SL_END_TI = 3;
export const CR_OPEN_BRACE_SOURCE_POS = 4;
export const CR_OPEN_BRACE_TI = 5;
export const CR_CLOSE_BRACE_SOURCE_POS = 6;
export const CR_CLOSE_BRACE_TI = 7;
export const CR_DL_SOURCE_START = 8;
export const CR_DL_SOURCE_END = 9;
export const CR_DL_START_TI = 10;
export const CR_DL_END_TI = 11;

/**
 * Number of header slots used by the rule parser.
 */
export const CR_HEADER_SIZE = 12;

/**
 * Minimum buffer capacity for the rule parser, including sub-parser
 * regions for the selector list and declaration list.
 */
export const CR_MIN_DATA_SLOTS = CR_HEADER_SIZE + SL_MIN_DATA_SLOTS + DL_MIN_DATA_SLOTS;
