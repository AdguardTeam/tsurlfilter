import { PIPE_MODIFIER_SEPARATOR } from '../../utils/constants';
import { locRange } from '../../utils/location';
import {
    type App,
    type AppList,
    defaultLocation,
    ListNodeType,
    ListItemNodeType,
} from '../common';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { parseListItems } from './list-helpers';

/**
 * `AppListParser` is responsible for parsing an app list.
 *
 * @see {@link https://adguard.app/kb/general/ad-filtering/create-own-filters/#app-modifier}
 */
export class AppListParser {
    /**
     * Parses an app list which items are separated by `|`,
     * e.g. `Example.exe|com.example.osx`.
     *
     * @param raw Raw app list
     * @param loc Location of the app list in the rule. If not set, the default location is used.
     *
     * @returns App list AST.
     * @throws An {@link AdblockSyntaxError} if the app list is syntactically invalid.
     */
    public static parse(
        raw: string,
        loc = defaultLocation,
    ): AppList {
        const separator = PIPE_MODIFIER_SEPARATOR;

        const rawItems = parseListItems(raw, separator, loc);
        const children: App[] = rawItems.map((rawListItem) => ({
            ...rawListItem,
            type: ListItemNodeType.App,
        }));

        return {
            type: ListNodeType.AppList,
            loc: locRange(loc, 0, raw.length),
            separator,
            children,
        };
    }

    // TODO: implement generate method if needed
}
