/* eslint-disable no-param-reassign */

/**
 * @file Logical expression preparser.
 *
 * Parses boolean expressions used in `!#if` preprocessor directives into a
 * compact, flat `Int32Array` representation. The grammar is:
 *
 *   expr    := primary (('&&' | '||') primary)*   (precedence climbing)
 *   primary := '!' primary | '(' expr ')' | variable
 *   variable := <Ident token>
 *
 * Relies entirely on {@link TokenType} values from the shared tokenizer —
 * no character inspection is performed here. All token-range navigation
 * helpers come from `../context`.
 *
 * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#conditions-directive}
 */

import { TokenType } from '../../tokenizer/token-types';
import type { PreparserContext } from '../context';
import { skipWs, tokenStart } from '../context';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';

// Buffer layout constants

/**
 * Buffer index: index of the root node (-1 when the expression is empty or
 * failed to parse).
 */
export const LE_ROOT = 0;

/**
 * Buffer index: total number of allocated node records.
 */
export const LE_COUNT = 1;

/**
 * Buffer index of the first node record (all records follow sequentially).
 */
export const LE_HEADER = 2;

/**
 * Number of `Int32` slots occupied by one node record.
 */
export const LE_STRIDE = 5;

// Node record field offsets (relative to node base)

/**
 * Field offset: node kind (`LE_KIND_VAR`, `LE_KIND_NOT`, `LE_KIND_AND`,
 * `LE_KIND_OR`, or `LE_KIND_PAR`).
 */
export const LE_KIND = 0;

/**
 * Field offset: source start offset (inclusive).
 */
export const LE_SRC_START = 1;

/**
 * Field offset: source end offset (exclusive).
 */
export const LE_SRC_END = 2;

/**
 * Field offset: left / unary child node index (`-1` when absent).
 */
export const LE_LEFT = 3;

/**
 * Field offset: right child node index (`-1` when absent).
 */
export const LE_RIGHT = 4;

// Capacity

/**
 * Maximum number of expression nodes the buffer can hold.
 */
export const LE_MAX_NODES = 32;

/**
 * Minimum required `Int32Array` length for the output buffer.
 *
 * `LE_HEADER + LE_MAX_NODES * LE_STRIDE` = 2 + 32 × 5 = 162.
 */
export const LE_BUFFER_SIZE = LE_HEADER + LE_MAX_NODES * LE_STRIDE;

// Node kind values

/**
 * Node kind: variable (e.g. `adguard`, `adguard_ext_safari`).
 * `left` and `right` are both `-1`.
 */
export const LE_KIND_VAR = 0;

/**
 * Node kind: unary NOT (`!`).
 * `left` = operand index; `right` = `-1`.
 */
export const LE_KIND_NOT = 1;

/**
 * Node kind: binary AND (`&&`).
 * `left` = left operand index; `right` = right operand index.
 */
export const LE_KIND_AND = 2;

/**
 * Node kind: binary OR (`||`).
 * `left` = left operand index; `right` = right operand index.
 */
export const LE_KIND_OR = 3;

/**
 * Node kind: parenthesised group (`(expr)`).
 * `left` = inner expression index; `right` = `-1`.
 * Source bounds mirror the inner expression (matching old-parser behaviour).
 */
export const LE_KIND_PAR = 4;

// Internal operator precedence

const PREC_OR = 1;
const PREC_AND = 2;
const PREC_NOT = 3;

// Mutable parse cursor

/**
 * Mutable cursor shared across all recursive parse helpers.
 * Kept as a plain object to avoid closures or extra allocations.
 */
interface ParseCursor {
    /**
     * Current token index within `ctx`.
     */
    ti: number;
    /**
     * Number of node records allocated in `buf` so far.
     */
    count: number;
}

// Preparser

/**
 * Token-based preparser for logical expressions used in preprocessor
 * directives (`!#if`, `!#endif`, …).
 *
 * Call {@link LogicalExpressionPreparser.preparse} to fill an `Int32Array`
 * buffer with a flat node-tree, then use the static accessor methods to
 * inspect individual nodes without allocating any objects.
 */
export class LogicalExpressionPreparser {
    /**
     * Parses the logical expression in token sub-range `[startTi, endTi)` of
     * the preparser context and writes a flat node-tree into `buf`.
     *
     * @param ctx Preparser context (tokenizer output must be loaded).
     * @param startTi First token index of the expression (inclusive).
     * @param endTi Token index past the last expression token (exclusive).
     * @param buf Output buffer (at least {@link LE_BUFFER_SIZE} elements).
     *
     * @throws {AdblockSyntaxError} When the expression is syntactically invalid.
     */
    public static preparse(
        ctx: PreparserContext,
        startTi: number,
        endTi: number,
        buf: Int32Array,
    ): void {
        buf[LE_ROOT] = -1;
        buf[LE_COUNT] = 0;

        const cursor: ParseCursor = { ti: startTi, count: 0 };

        cursor.ti = skipWs(ctx, cursor.ti);
        if (cursor.ti >= endTi) {
            // Empty expression — root stays -1
            return;
        }

        const root = LogicalExpressionPreparser.parseExpr(ctx, endTi, buf, cursor, 0);

        buf[LE_ROOT] = root;
        buf[LE_COUNT] = cursor.count;

        // Ensure nothing meaningful was left unconsumed
        cursor.ti = skipWs(ctx, cursor.ti);
        if (cursor.ti < endTi) {
            const errStart = tokenStart(ctx, cursor.ti);
            const errEnd = ctx.ends[cursor.ti];
            throw new AdblockSyntaxError(
                'Unexpected token in logical expression',
                errStart,
                errEnd,
            );
        }
    }

    /**
     * Returns the root node index, or `-1` if the expression was empty.
     *
     * @param buf Buffer written by {@link LogicalExpressionPreparser.preparse}.
     * @returns Root node index.
     */
    public static rootIndex(buf: Int32Array): number {
        return buf[LE_ROOT];
    }

    /**
     * Returns the total number of nodes allocated in the buffer.
     *
     * @param buf Buffer written by {@link LogicalExpressionPreparser.preparse}.
     * @returns Node count.
     */
    public static nodeCount(buf: Int32Array): number {
        return buf[LE_COUNT];
    }

    /**
     * Returns the kind of node `i` (one of the `LE_KIND_*` constants).
     *
     * @param buf Buffer written by {@link LogicalExpressionPreparser.preparse}.
     * @param i   Node index (0-based).
     * @returns Node kind.
     */
    public static nodeKind(buf: Int32Array, i: number): number {
        return buf[LE_HEADER + i * LE_STRIDE + LE_KIND];
    }

    /**
     * Returns the inclusive source start offset of node `i`.
     *
     * @param buf Buffer written by {@link LogicalExpressionPreparser.preparse}.
     * @param i   Node index.
     * @returns Source start offset.
     */
    public static nodeSrcStart(buf: Int32Array, i: number): number {
        return buf[LE_HEADER + i * LE_STRIDE + LE_SRC_START];
    }

    /**
     * Returns the exclusive source end offset of node `i`.
     *
     * @param buf Buffer written by {@link LogicalExpressionPreparser.preparse}.
     * @param i   Node index.
     * @returns Source end offset (exclusive).
     */
    public static nodeSrcEnd(buf: Int32Array, i: number): number {
        return buf[LE_HEADER + i * LE_STRIDE + LE_SRC_END];
    }

    /**
     * Returns the left / unary child index of node `i`, or `-1` if absent.
     *
     * @param buf Buffer written by {@link LogicalExpressionPreparser.preparse}.
     * @param i   Node index.
     * @returns Left child index, or `-1`.
     */
    public static nodeLeft(buf: Int32Array, i: number): number {
        return buf[LE_HEADER + i * LE_STRIDE + LE_LEFT];
    }

    /**
     * Returns the right child index of node `i`, or `-1` if absent.
     *
     * @param buf Buffer written by {@link LogicalExpressionPreparser.preparse}.
     * @param i   Node index.
     * @returns Right child index, or `-1`.
     */
    public static nodeRight(buf: Int32Array, i: number): number {
        return buf[LE_HEADER + i * LE_STRIDE + LE_RIGHT];
    }

    /**
     * Allocates a new node record and returns its index.
     *
     * @param buf Output buffer.
     * @param cursor Mutable parse cursor.
     * @param kind Node kind constant.
     * @param srcStart Source start offset.
     * @param srcEnd Source end offset (exclusive).
     * @param left Left / unary child index, or `-1`.
     * @param right Right child index, or `-1`.
     * @returns Newly allocated node index.
     */
    private static alloc(
        buf: Int32Array,
        cursor: ParseCursor,
        kind: number,
        srcStart: number,
        srcEnd: number,
        left: number,
        right: number,
    ): number {
        const idx = cursor.count;
        const base = LE_HEADER + idx * LE_STRIDE;
        buf[base + LE_KIND] = kind;
        buf[base + LE_SRC_START] = srcStart;
        buf[base + LE_SRC_END] = srcEnd;
        buf[base + LE_LEFT] = left;
        buf[base + LE_RIGHT] = right;
        cursor.count += 1;
        return idx;
    }

    /**
     * Parses an expression using precedence climbing.
     *
     * @param ctx Preparser context.
     * @param endTi Exclusive end token index for this expression.
     * @param buf Output buffer.
     * @param cursor Mutable parse cursor.
     * @param minPrec Minimum operator precedence to consume.
     * @returns Node index of the parsed expression.
     */
    private static parseExpr(
        ctx: PreparserContext,
        endTi: number,
        buf: Int32Array,
        cursor: ParseCursor,
        minPrec: number,
    ): number {
        let node = LogicalExpressionPreparser.parsePrimary(ctx, endTi, buf, cursor);

        // Skip whitespace before the first binary-operator check
        cursor.ti = skipWs(ctx, cursor.ti);

        while (cursor.ti < endTi) {
            const { types } = ctx;
            const { ti } = cursor;

            let opKind = -1;
            let prec = 0;

            // && — two consecutive AndSign tokens with no whitespace between
            if (
                types[ti] === TokenType.AndSign
                && ti + 1 < endTi
                && types[ti + 1] === TokenType.AndSign
            ) {
                opKind = LE_KIND_AND;
                prec = PREC_AND;
            } else if (
                // || — two consecutive Pipe tokens with no whitespace between
                types[ti] === TokenType.Pipe
                && ti + 1 < endTi
                && types[ti + 1] === TokenType.Pipe
            ) {
                opKind = LE_KIND_OR;
                prec = PREC_OR;
            }

            if (opKind === -1 || prec < minPrec) break;

            // Consume the two-token operator
            cursor.ti += 2;

            const right = LogicalExpressionPreparser.parseExpr(ctx, endTi, buf, cursor, prec + 1);

            const leftStart = buf[LE_HEADER + node * LE_STRIDE + LE_SRC_START];
            const rightEnd = buf[LE_HEADER + right * LE_STRIDE + LE_SRC_END];
            node = LogicalExpressionPreparser.alloc(buf, cursor, opKind, leftStart, rightEnd, node, right);

            // Skip whitespace before re-evaluating the loop condition
            cursor.ti = skipWs(ctx, cursor.ti);
        }

        return node;
    }

    /**
     * Parses a primary expression: `!primary`, `(expr)`, or a variable.
     *
     * @param ctx Preparser context.
     * @param endTi Exclusive end token index.
     * @param buf Output buffer.
     * @param cursor Mutable parse cursor.
     * @returns Node index of the parsed primary.
     * @throws {AdblockSyntaxError} On unexpected input.
     */
    private static parsePrimary(
        ctx: PreparserContext,
        endTi: number,
        buf: Int32Array,
        cursor: ParseCursor,
    ): number {
        cursor.ti = skipWs(ctx, cursor.ti);

        if (cursor.ti >= endTi) {
            const errOff = endTi > 0 ? ctx.ends[endTi - 1] : ctx.source.length;
            throw new AdblockSyntaxError('Unexpected end of logical expression', errOff, errOff);
        }

        const { types, ends } = ctx;
        const { ti } = cursor;

        // NOT operator: `!primary`
        if (types[ti] === TokenType.ExclamationMark) {
            const opStart = tokenStart(ctx, ti);
            cursor.ti += 1;
            const child = LogicalExpressionPreparser.parseExpr(ctx, endTi, buf, cursor, PREC_NOT);
            const childEnd = buf[LE_HEADER + child * LE_STRIDE + LE_SRC_END];
            return LogicalExpressionPreparser.alloc(buf, cursor, LE_KIND_NOT, opStart, childEnd, child, -1);
        }

        // Parenthesised expression: `(expr)`
        if (types[ti] === TokenType.OpenParen) {
            // skip `(`
            cursor.ti += 1;
            const inner = LogicalExpressionPreparser.parseExpr(ctx, endTi, buf, cursor, 0);

            cursor.ti = skipWs(ctx, cursor.ti);
            if (cursor.ti >= endTi || types[cursor.ti] !== TokenType.CloseParen) {
                const errOff = cursor.ti < endTi ? tokenStart(ctx, cursor.ti) : ends[endTi - 1];
                throw new AdblockSyntaxError('Missing closing parenthesis in logical expression', errOff, errOff + 1);
            }
            // skip `)`
            cursor.ti += 1;

            // Mirror old-parser behaviour: Parenthesis bounds equal the inner
            // expression bounds, not the outer parentheses characters.
            const innerStart = buf[LE_HEADER + inner * LE_STRIDE + LE_SRC_START];
            const innerEnd = buf[LE_HEADER + inner * LE_STRIDE + LE_SRC_END];
            return LogicalExpressionPreparser.alloc(buf, cursor, LE_KIND_PAR, innerStart, innerEnd, inner, -1);
        }

        // Variable: a single Ident token
        if (types[ti] === TokenType.Ident) {
            const varStart = tokenStart(ctx, ti);
            const varEnd = ends[ti];
            cursor.ti += 1;
            return LogicalExpressionPreparser.alloc(buf, cursor, LE_KIND_VAR, varStart, varEnd, -1, -1);
        }

        const errStart = tokenStart(ctx, ti);
        throw new AdblockSyntaxError('Unexpected token in logical expression', errStart, ends[ti]);
    }
}
