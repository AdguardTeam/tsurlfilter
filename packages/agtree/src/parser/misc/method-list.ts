import { PIPE_MODIFIER_SEPARATOR } from '../../utils/constants';
import { locRange } from '../../utils/location';
import {
    type Method,
    type MethodList,
    defaultLocation,
    ListNodeType,
    ListItemNodeType,
} from '../common';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { parseListItems } from './list-helpers';

/**
 * `MethodListParser` is responsible for parsing a method list.
 *
 * @see {@link https://adguard.app/kb/general/ad-filtering/create-own-filters/#method-modifier}
 */
export class MethodListParser {
    /**
     * Parses a method list which items are separated by `|`,
     * e.g. `get|post|put`.
     *
     * @param raw Raw method list
     * @param loc Location of the method list in the rule. If not set, the default location is used.
     *
     * @returns Method list AST.
     * @throws An {@link AdblockSyntaxError} if the method list is syntactically invalid.
     */
    public static parse(
        raw: string,
        loc = defaultLocation,
    ): MethodList {
        const separator = PIPE_MODIFIER_SEPARATOR;

        const rawItems = parseListItems(raw, separator, loc);
        const children: Method[] = rawItems.map((rawListItem) => ({
            ...rawListItem,
            type: ListItemNodeType.Method,
        }));

        return {
            type: ListNodeType.MethodList,
            loc: locRange(loc, 0, raw.length),
            separator,
            children,
        };
    }

    // TODO: implement generate method if needed
}
