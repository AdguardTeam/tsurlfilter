import { PIPE } from '../../utils/constants';
import { locRange } from '../../utils/location';
import {
    type Method,
    type MethodList,
    ListNodeType,
    ListItemNodeType,
} from '../common';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { type ListParserOptions, parseListItems } from './list-helpers';
import { getParserOptions } from '../options';

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
     * @param options List parser options. See {@link ListParserOptions}.
     *
     * @returns Method list AST.
     * @throws An {@link AdblockSyntaxError} if the method list is syntactically invalid.
     * @throws An {@link Error} if the options are invalid.
     */
    public static parse(raw: string, options: Partial<ListParserOptions> = {}): MethodList {
        const separator = options.separator ?? PIPE;

        if (separator !== PIPE) {
            throw new Error(`Invalid separator: ${separator}`);
        }

        const { baseLoc, isLocIncluded } = getParserOptions(options);
        const rawItems = parseListItems(raw, { separator, baseLoc, isLocIncluded });
        const children: Method[] = rawItems.map((rawListItem) => ({
            ...rawListItem,
            type: ListItemNodeType.Method,
        }));

        const result: MethodList = {
            type: ListNodeType.MethodList,
            separator,
            children,
        };

        if (isLocIncluded) {
            result.loc = locRange(baseLoc, 0, raw.length);
        }

        return result;
    }

    // TODO: implement generate method if needed
}
