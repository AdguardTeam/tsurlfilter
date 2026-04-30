/**
 * @file Parser entry-point contracts.
 *
 * Every `*Parser` class under `packages/agtree/src/parser/**` MUST
 * declare `implements` against exactly one of the interfaces below.
 *
 * Six contracts cover every legitimate parser shape in this folder:
 *
 *   - {@link RootParser}         — top-level rule dispatcher; returns `RuleKind`.
 *   - {@link StructuralParser}   — region-writing parser; returns `void`.
 *   - {@link CosmeticBodyParser} — cosmetic body parser; takes the packed
 *                                  classifier result and returns `void`.
 *   - {@link CursorParser}       — token-cursor advancer; returns the next
 *                                  token index.
 *   - {@link BufferedParser}     — embedded sub-parser writing into a
 *                                  caller-supplied `Int32Array` buffer.
 *   - {@link RecordParser}       — single-record parser used inside list
 *                                  parsers; returns the next token index.
 *
 * ## Marker interfaces
 *
 * Parser classes expose their entry points as **static** methods because
 * the codebase deliberately avoids per-call allocations. TypeScript's
 * `implements` keyword only validates **instance** members, so these
 * interfaces are intentionally left empty: they act as classification
 * markers enforced by the regex-based contract-coverage test
 * (`test/parser/contract-coverage.test.ts`) and by code review against
 * the JSDoc shapes documented below.
 */

import type { RuleKind } from './classifier';
import type { ParserContext } from './context';

/**
 * Top-level rule dispatcher.
 *
 * Expected static shape:.
 * ```ts
 * static readonly MIN_DATA_SLOTS: number;
 * static parse(
 *     ctx: ParserContext,
 *     startTi?: number,
 *     endTi?: number,
 *     dataOffset?: number,
 *     options?: TOptions,
 * ): RuleKind;
 * ```
 *
 * @template TOptions - Parser options object shape, or `void` for none.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-interface
export interface RootParser<TOptions = void> {}

/**
 * Region-writing parser. Writes a self-contained record starting at
 * `dataOffset` in `ctx.data`.
 *
 * Expected static shape:.
 * ```ts
 * static readonly MIN_DATA_SLOTS: number;
 * static parse(
 *     ctx: ParserContext,
 *     startTi: number,
 *     endTi: number,
 *     dataOffset: number,
 *     options?: TOptions,
 * ): void;
 * ```
 *
 * @template TOptions - Parser options object shape, or `void` for none.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-interface
export interface StructuralParser<TOptions = void> {}

/**
 * Cosmetic body parser invoked from the cosmetic dispatcher with the
 * packed classifier result. The header has already been written.
 *
 * Expected static shape:.
 * ```ts
 * static readonly MIN_DATA_SLOTS: number;
 * static parse(
 *     ctx: ParserContext,
 *     classified: number,
 *     options?: TOptions,
 * ): void;
 * ```
 *
 * @template TOptions - Parser options object shape, or `void` for none.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-interface
export interface CosmeticBodyParser<TOptions = void> {}

/**
 * Cursor-advancing parser. Returns the new token index without writing
 * structural records (used for value/modifier scanning).
 *
 * Expected static shape:.
 * ```ts
 * static parse(ctx: ParserContext, ti: number, end: number): number;
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface CursorParser {}

/**
 * Sub-parser writing into a caller-supplied buffer (sub-buffers embedded
 * inside parent layouts, e.g. parameter lists, logical expressions).
 *
 * Expected static shape:.
 * ```ts
 * static readonly BUFFER_SIZE: number;
 * static parse(
 *     ctx: ParserContext,
 *     startTi: number,
 *     endTi: number,
 *     buf: Int32Array,
 *     options?: TOptions,
 * ): void;
 * ```
 *
 * @template TOptions - Parser options object shape, or `void` for none.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-interface
export interface BufferedParser<TOptions = void> {}

/**
 * Single-record parser used inside list parsers. Writes one record
 * at `recordsOffset + idx * STRIDE` and returns the next token index,
 * or -1 if no record could be parsed.
 *
 * Expected static shape:.
 * ```ts
 * static readonly MIN_DATA_SLOTS: number;
 * static parse(
 *     ctx: ParserContext,
 *     ti: number,
 *     idx: number,
 *     recordsOffset: number,
 * ): number;
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface RecordParser {}

// Re-export referenced types so consumers don't need a second import.
export type { ParserContext, RuleKind };
