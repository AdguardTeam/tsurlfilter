/**
 * @file Generic list AST builder — builds AppList / MethodList /
 * StealthOptionList nodes from parsed list-item records in ctx.data.
 *
 * Reuses the domain record layout written by the structural DomainListParser.
 */

import {
    type ListItem,
    type ListItemNodeType,
    type ListNodeType,
    type Node,
} from '../../nodes';
import {
    DOMAIN_FIELD_FLAGS,
    DOMAIN_FIELD_VALUE_END,
    DOMAIN_FIELD_VALUE_START,
    DOMAIN_FLAG_EXCEPTION,
    DOMAIN_RECORD_STRIDE,
} from '../../parser/cosmetic/constants';

/**
 * Generic pipe/comma separated list AST builder.
 */
export class ListAstBuilder {
    /**
     * Builds a list node from parsed list-item records.
     *
     * @param source Source string.
     * @param data Int32Array with parsed records.
     * @param count Number of item records.
     * @param recordsOffset Offset where item records begin.
     * @param listType Target list node type (e.g. ListNodeType.AppList).
     * @param itemType Target item node type (e.g. ListItemNodeType.App).
     * @param separator Separator character.
     * @param isLocIncluded Whether to include location info.
     *
     * @returns List node with typed children.
     */
    public static parse<L extends ListNodeType, I extends ListItemNodeType>(
        source: string,
        data: Int32Array,
        count: number,
        recordsOffset: number,
        listType: L,
        itemType: I,
        separator: string,
        isLocIncluded: boolean,
    ): Node & { type: L; separator: string; children: ListItem<I>[] } {
        const children: ListItem<I>[] = [];
        let listStart = -1;
        let listEnd = -1;

        for (let i = 0; i < count; i += 1) {
            const recordBase = recordsOffset + i * DOMAIN_RECORD_STRIDE;
            const valueStart = data[recordBase + DOMAIN_FIELD_VALUE_START];
            const valueEnd = data[recordBase + DOMAIN_FIELD_VALUE_END];
            const flags = data[recordBase + DOMAIN_FIELD_FLAGS];

            if (valueEnd <= valueStart) {
                continue;
            }

            const item = {
                type: itemType,
                value: source.slice(valueStart, valueEnd),
                exception: (flags & DOMAIN_FLAG_EXCEPTION) !== 0,
            } as ListItem<I>;

            if (isLocIncluded) {
                item.start = valueStart;
                item.end = valueEnd;
            }

            children.push(item);

            if (listStart === -1 || valueStart < listStart) {
                listStart = valueStart;
            }
            if (listEnd === -1 || valueEnd > listEnd) {
                listEnd = valueEnd;
            }
        }

        const list = { type: listType, separator, children } as Node & {
            type: L;
            separator: string;
            children: ListItem<I>[];
        };

        if (isLocIncluded && listStart !== -1) {
            list.start = listStart;
            list.end = listEnd;
        }

        return list;
    }
}
