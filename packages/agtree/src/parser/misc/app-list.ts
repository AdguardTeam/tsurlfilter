import { PIPE } from '../../utils/constants';
import { locRange } from '../../utils/location';
import {
    type App,
    type AppList,
    ListNodeType,
    ListItemNodeType,
} from '../common';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { type ListParserOptions, parseListItems } from './list-helpers';
import { getParserOptions } from '../options';

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
     * @param options List parser options. See {@link ListParserOptions}.
     *
     * @returns App list AST.
     * @throws An {@link AdblockSyntaxError} if the app list is syntactically invalid.
     * @throws An {@link Error} if the options are invalid.
     */
    public static parse(raw: string, options: Partial<ListParserOptions> = {}): AppList {
        const separator = options.separator ?? PIPE;

        if (separator !== PIPE) {
            throw new Error(`Invalid separator: ${separator}`);
        }

        const { baseLoc, isLocIncluded } = getParserOptions(options);

        const rawItems = parseListItems(raw, { separator, baseLoc, isLocIncluded });
        const children: App[] = rawItems.map((rawListItem) => ({
            ...rawListItem,
            type: ListItemNodeType.App,
        }));

        const result: AppList = {
            type: ListNodeType.AppList,
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
