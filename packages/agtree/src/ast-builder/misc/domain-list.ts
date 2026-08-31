/**
 * @file Domain list AST parser - shared infrastructure.
 *
 * Builds DomainList AST nodes from parsed domain records in ctx.data.
 * Decoupled from specific rule types - all parameters are caller-provided.
 */

import { ListItemNodeType, ListNodeType } from '../../nodes';
import type { DomainList, DomainListSeparator } from '../../nodes';

import { ListAstBuilder } from './list';

/**
 * Domain list AST parser (shared infrastructure).
 */
export class DomainListAstBuilder {
    /**
     * Parse a domain list from parsed data.
     *
     * A `DomainList` is structurally a {@link ListAstBuilder} list specialized
     * to `DomainList` / `Domain` node types, so the record iteration is
     * delegated to keep the semantics in a single place. The only difference
     * is the `domainCount === 0` early return, which yields `undefined`.
     *
     * @param source Source string.
     * @param data Int32Array with parsed data.
     * @param domainCount Number of domain records.
     * @param domainRecordsOffset Offset where domain records begin.
     * @param separator Separator character (',' or '|').
     * @param isLocIncluded Whether to include location info.
     *
     * @returns DomainList AST node, or undefined if domainCount is 0.
     */
    public static parse(
        source: string,
        data: Int32Array,
        domainCount: number,
        domainRecordsOffset: number,
        separator: DomainListSeparator,
        isLocIncluded: boolean,
    ): DomainList | undefined {
        if (domainCount === 0) {
            return undefined;
        }

        return ListAstBuilder.parse(
            source,
            data,
            domainCount,
            domainRecordsOffset,
            ListNodeType.DomainList,
            ListItemNodeType.Domain,
            separator,
            isLocIncluded,
        ) as DomainList;
    }
}
