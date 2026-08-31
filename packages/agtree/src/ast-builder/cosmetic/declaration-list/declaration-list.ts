/**
 * @file CSS declaration list AST builder.
 *
 * Reads parsed data from an Int32Array (produced by
 * `DeclarationListParser.parse()`) and builds a CssDeclarationList
 * AST node by iterating declaration records.
 */

import type { CssDeclaration, CssDeclarationList, Value } from '../../../nodes';
import { NodeType } from '../../../nodes';
import { DeclarationListParser } from '../../../parser/css/declaration-list';
import { DEFAULT_MAX_DECLARATIONS } from '../../../parser/css/declaration-list/constants';

/**
 * Parse options for the declaration list AST builder.
 */
export interface DeclarationListParseOptions {
    /**
     * Whether to include location info (start/end) in AST nodes.
     *
     * Defaults to `true`.
     */
    isLocIncluded?: boolean;
}

/**
 * CSS declaration list AST builder.
 *
 * Reads declaration records from a pre-populated `Int32Array` and produces
 * a typed `CssDeclarationList` AST node. Performs **zero validation** — the
 * parser guarantees structural correctness before this builder is called.
 */
export class DeclarationListAstBuilder {
    /**
     * Build a CssDeclarationList AST node from parsed data.
     *
     * @param source Original source string.
     * @param data Int32Array written by `DeclarationListParser.parse()`.
     * @param dataOffset Base offset within `data`.
     * @param _maxDeclarations Max declarations capacity used during parse (kept for API consistency).
     * @param listStart Source offset of the first character of the declaration list.
     * @param listEnd Source offset just past the last character.
     * @param options Parse options.
     *
     * @returns CssDeclarationList AST node.
     */
    public static parse(
        source: string,
        data: Int32Array,
        dataOffset: number = 0,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _maxDeclarations: number = DEFAULT_MAX_DECLARATIONS,
        listStart: number = 0,
        listEnd: number = source.length,
        options: DeclarationListParseOptions = {},
    ): CssDeclarationList {
        const { isLocIncluded = true } = options;

        const n = DeclarationListParser.declCount(data, dataOffset);
        const children: CssDeclaration[] = new Array(n);

        for (let i = 0; i < n; i += 1) {
            const propStart = DeclarationListParser.propertyStart(data, dataOffset, i);
            const propEnd = DeclarationListParser.propertyEnd(data, dataOffset, i);
            const valStart = DeclarationListParser.valueStart(data, dataOffset, i);
            const valEnd = DeclarationListParser.valueEnd(data, dataOffset, i);
            const imp = DeclarationListParser.important(data, dataOffset, i);
            const fullDeclEnd = DeclarationListParser.declEnd(data, dataOffset, i);

            const property: Value = {
                type: NodeType.Value,
                value: source.slice(propStart, propEnd),
            };

            const value: Value = {
                type: NodeType.Value,
                value: source.slice(valStart, valEnd),
            };

            if (isLocIncluded) {
                property.start = propStart;
                property.end = propEnd;
                value.start = valStart;
                value.end = valEnd;
            }

            const declaration: CssDeclaration = {
                type: NodeType.CssDeclaration,
                property,
                value,
                important: imp === 1,
            };

            if (isLocIncluded) {
                declaration.start = propStart;
                declaration.end = fullDeclEnd;
            }

            children[i] = declaration;
        }

        const result: CssDeclarationList = {
            type: NodeType.CssDeclarationList,
            children,
        };

        if (isLocIncluded) {
            result.start = listStart;
            result.end = listEnd;
        }

        return result;
    }
}
