/**
 * @file Value parser — creates Value AST nodes from source indices.
 */

import { type Value } from '../nodes';

/**
 * Parser for Value AST nodes.
 */
export class ValueParser {
    /**
     * Builds a Value AST node from source indices.
     *
     * @param source Original source string.
     * @param start Start index in source (inclusive).
     * @param end End index in source (exclusive).
     * @param isLocIncluded Whether to include location info.
     * @returns Value AST node.
     */
    static parse(
        source: string,
        start: number,
        end: number,
        isLocIncluded: boolean,
    ): Value {
        const node: Value = {
            type: 'Value',
            value: source.slice(start, end),
        };

        if (isLocIncluded) {
            node.start = start;
            node.end = end;
        }

        return node;
    }
}
