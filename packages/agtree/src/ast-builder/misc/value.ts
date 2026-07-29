/**
 * @file Value parser — creates Value AST nodes from source indices.
 */

import {
    NodeType,
    type Raw,
    type Value,
    type ValueKind,
} from '../../nodes';

/**
 * Parser for Value AST nodes.
 */
export class ValueAstBuilder {
    /**
     * Builds a Value AST node from source indices.
     *
     * @param source Original source string.
     * @param start Start index in source (inclusive).
     * @param end End index in source (exclusive).
     * @param isLocIncluded Whether to include location info.
     * @param kind Optional semantic kind to attach to the node.
     *
     * @returns Value AST node.
     */
    public static parse(
        source: string,
        start: number,
        end: number,
        isLocIncluded: boolean,
        kind?: ValueKind,
    ): Value {
        const node: Value = {
            type: NodeType.Value,
            value: source.slice(start, end),
        };

        if (kind !== undefined) {
            node.kind = kind;
        }

        if (isLocIncluded) {
            node.start = start;
            node.end = end;
        }

        return node;
    }

    /**
     * Builds a Raw AST node from source indices.
     *
     * Use this when a sub-parser exists for the content but was not invoked
     * (e.g. CSS selectors, domain lists, JS code).
     *
     * @param source Original source string.
     * @param start Start index in source (inclusive).
     * @param end End index in source (exclusive).
     * @param isLocIncluded Whether to include location info.
     * @param kind Optional semantic kind to attach to the node.
     *
     * @returns Raw AST node.
     */
    public static parseRaw(
        source: string,
        start: number,
        end: number,
        isLocIncluded: boolean,
        kind?: ValueKind,
    ): Raw {
        const node: Raw = {
            type: NodeType.Raw,
            value: source.slice(start, end),
        };

        if (kind !== undefined) {
            node.kind = kind;
        }

        if (isLocIncluded) {
            node.start = start;
            node.end = end;
        }

        return node;
    }
}
