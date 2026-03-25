/**
 * @file Domain list AST parser - shared infrastructure.
 *
 * Builds DomainList AST nodes from preparsed domain records in ctx.data.
 * Decoupled from specific rule types - all parameters are caller-provided.
 */

import { ListItemNodeType, ListNodeType } from '../../nodes';
import type { Domain, DomainList, DomainListSeparator } from '../../nodes';
import {
    DOMAIN_FIELD_FLAGS,
    DOMAIN_FIELD_VALUE_END,
    DOMAIN_FIELD_VALUE_START,
    DOMAIN_FLAG_EXCEPTION,
    DOMAIN_RECORD_STRIDE,
} from '../../preparser/cosmetic/constants';

/**
 * Domain list AST parser (shared infrastructure).
 */
export class DomainListParser {
    /**
     * Parse a domain list from preparsed data.
     *
     * @param source Source string.
     * @param data Int32Array with preparsed data.
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

        const children: Domain[] = [];
        let listStart = -1;
        let listEnd = -1;

        for (let i = 0; i < domainCount; i += 1) {
            const recordBase = domainRecordsOffset + i * DOMAIN_RECORD_STRIDE;
            const valueStart = data[recordBase + DOMAIN_FIELD_VALUE_START];
            const valueEnd = data[recordBase + DOMAIN_FIELD_VALUE_END];
            const flags = data[recordBase + DOMAIN_FIELD_FLAGS];

            // Guard against empty slices
            if (valueEnd <= valueStart) {
                continue;
            }

            const value = source.slice(valueStart, valueEnd);
            const exception = (flags & DOMAIN_FLAG_EXCEPTION) !== 0;

            const domain: Domain = {
                type: ListItemNodeType.Domain,
                value,
                exception,
            };

            if (isLocIncluded) {
                domain.start = valueStart;
                domain.end = valueEnd;
            }

            children.push(domain);

            // Track list start/end
            if (listStart === -1 || valueStart < listStart) {
                listStart = valueStart;
            }
            if (listEnd === -1 || valueEnd > listEnd) {
                listEnd = valueEnd;
            }
        }

        const domainList: DomainList = {
            type: ListNodeType.DomainList,
            separator,
            children,
        };

        if (isLocIncluded && listStart !== -1) {
            domainList.start = listStart;
            domainList.end = listEnd;
        }

        return domainList;
    }
}
