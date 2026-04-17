/**
 * @file CSS declaration list AST builder.
 *
 * Reads preparsed data from an Int32Array (produced by
 * `DeclarationListPreparser.preparse()`) and builds a CssDeclarationList
 * AST node by iterating declaration records.
 */

import type { CssDeclaration, CssDeclarationList, Value } from '../../../nodes-new';
import { DeclarationListPreparser } from '../../../preparser/css/declaration-list';
import { DEFAULT_MAX_DECLARATIONS } from '../../../preparser/css/declaration-list/constants';

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
 * preparser guarantees structural correctness before this builder is called.
 */
export class DeclarationListAstParser {
    /**
     * Build a CssDeclarationList AST node from preparsed data.
     *
     * @param source Original source string.
     * @param data Int32Array written by `DeclarationListPreparser.preparse()`.
     * @param dataOffset Base offset within `data`.
     * @param _maxDeclarations Max declarations capacity used during preparse (kept for API consistency).
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

        const n = DeclarationListPreparser.declCount(data, dataOffset);
        const children: CssDeclaration[] = new Array(n);

        for (let i = 0; i < n; i += 1) {
            const propStart = DeclarationListPreparser.propertyStart(data, dataOffset, i);
            const propEnd = DeclarationListPreparser.propertyEnd(data, dataOffset, i);
            const valStart = DeclarationListPreparser.valueStart(data, dataOffset, i);
            const valEnd = DeclarationListPreparser.valueEnd(data, dataOffset, i);
            const imp = DeclarationListPreparser.important(data, dataOffset, i);
            const fullDeclEnd = DeclarationListPreparser.declEnd(data, dataOffset, i);

            const property: Value = {
                type: 'Value',
                value: source.slice(propStart, propEnd),
            };

            const value: Value = {
                type: 'Value',
                value: source.slice(valStart, valEnd),
            };

            if (isLocIncluded) {
                property.start = propStart;
                property.end = propEnd;
                value.start = valStart;
                value.end = valEnd;
            }

            const declaration: CssDeclaration = {
                type: 'CssDeclaration',
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
            type: 'CssDeclarationList',
            children,
        };

        if (isLocIncluded) {
            result.start = listStart;
            result.end = listEnd;
        }

        return result;
    }
}
