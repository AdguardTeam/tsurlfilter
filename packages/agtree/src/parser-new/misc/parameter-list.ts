/**
 * @file Parameter list AST parser.
 *
 * Converts the flat {@link Int32Array} buffer produced by
 * the parameter list preparser into a {@link ParameterList} AST node.
 */

import { type ParameterList, type Value } from '../../nodes';
import {
    PL_COUNT,
    PL_HEADER,
    PL_LIST_END,
    PL_LIST_START,
    PL_PARAM_END,
    PL_PARAM_START,
    PL_STRIDE,
} from '../../preparser/misc/parameter-list';

/**
 * AST parser for parameter list nodes.
 *
 * Reads the flat buffer written by the parameter list preparser
 * and constructs a {@link ParameterList} node with optional source locations.
 */
export class ParameterListAstParser {
    /**
     * Builds a {@link ParameterList} node from a preparsed buffer.
     *
     * @param source        Original source string.
     * @param buf           Buffer written by the parameter list preparser.
     * @param isLocIncluded Whether to attach source locations to nodes.
     * @returns ParameterList AST node.
     */
    static parse(source: string, buf: Int32Array, isLocIncluded: boolean): ParameterList {
        const count = buf[PL_COUNT];
        const listStart = buf[PL_LIST_START];
        const listEnd = buf[PL_LIST_END];

        const result: ParameterList = {
            type: 'ParameterList',
            children: [],
        };

        if (isLocIncluded) {
            result.start = listStart;
            result.end = listEnd;
        }

        for (let i = 0; i < count; i += 1) {
            const start = buf[PL_HEADER + i * PL_STRIDE + PL_PARAM_START];
            const end = buf[PL_HEADER + i * PL_STRIDE + PL_PARAM_END];

            if (start === -1) {
                result.children.push(null);
            } else {
                const node: Value = { type: 'Value', value: source.slice(start, end) };

                if (isLocIncluded) {
                    node.start = start;
                    node.end = end;
                }

                result.children.push(node);
            }
        }

        return result;
    }
}
