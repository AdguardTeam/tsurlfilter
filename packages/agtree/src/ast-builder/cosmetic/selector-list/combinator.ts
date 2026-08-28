/**
 * @file Selector combinator AST builder.
 *
 * Builds a SelectorCombinator AST node from a parsed child record.
 */

import type { SelectorCombinator, SelectorCombinatorValue } from '../../../nodes';
import { NodeType } from '../../../nodes';
import {
    CHILD_FIELD_0,
    CHILD_FIELD_SOURCE_END,
    CHILD_FIELD_SOURCE_START,
} from '../../../parser/css/selector-list/constants';

/**
 * Lookup table mapping parser combinator encoding to string values.
 *
 * Index matches the `COMBINATOR_*` constants from the parser.
 * - 0 (`COMBINATOR_DESCENDANT`)         → `' '`.
 * - 1 (`COMBINATOR_CHILD`)              → `'>'`.
 * - 2 (`COMBINATOR_NEXT_SIBLING`)       → `'+'`.
 * - 3 (`COMBINATOR_SUBSEQUENT_SIBLING`) → `'~'`.
 */
const COMBINATOR_VALUES: readonly SelectorCombinatorValue[] = [' ', '>', '+', '~'];

/**
 * Build a SelectorCombinator AST node from a parsed child record.
 *
 * The combinator character is resolved from a constant lookup table keyed by
 * the encoded combinator value in CHILD_FIELD_0 — no source.slice() needed.
 *
 * @param source Original source string (unused — combinator values are constant).
 * @param data Int32Array buffer with parsed data.
 * @param base Absolute base index of the child record in data.
 * @param isLocIncluded Whether to include start/end on the node.
 *
 * @returns SelectorCombinator AST node.
 */
export function buildSelectorCombinator(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    source: string,
    data: Int32Array,
    base: number,
    isLocIncluded: boolean,
): SelectorCombinator {
    const node: SelectorCombinator = {
        type: NodeType.SelectorCombinator,
        value: COMBINATOR_VALUES[data[base + CHILD_FIELD_0]],
    };

    if (isLocIncluded) {
        node.start = data[base + CHILD_FIELD_SOURCE_START];
        node.end = data[base + CHILD_FIELD_SOURCE_END];
    }

    return node;
}
