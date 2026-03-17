import { type AppList, ListItemNodeType, ListNodeType } from '../../nodes';
import { PIPE as APP_LIST_SEPARATOR } from '../../utils/constants';
import { BaseParser } from '../base-parser';
import { defaultParserOptions } from '../options';

import { ListItemsParser } from './list-items-parser';

/**
 * `AppListParser` is responsible for parsing an app list.
 *
 * @see {@link https://adguard.app/kb/general/ad-filtering/create-own-filters/#app-modifier}
 */
export class AppListParser extends BaseParser {
    /**
     * Parses an app list which items are separated by `|`,
     * e.g. `Example.exe|com.example.osx`.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     *
     * @returns App list AST.
     *
     * @throws An {@link AdblockSyntaxError} if the app list is syntactically invalid.
     * @throws An {@link Error} if the options are invalid.
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): AppList {
        const result: AppList = {
            type: ListNodeType.AppList,
            separator: APP_LIST_SEPARATOR,
            children: ListItemsParser.parse(raw, options, baseOffset, APP_LIST_SEPARATOR, ListItemNodeType.App),
        };

        if (options.isLocIncluded) {
            result.start = baseOffset;
            result.end = baseOffset + raw.length;
        }

        return result;
    }

    // TODO: implement generate method if needed
}
