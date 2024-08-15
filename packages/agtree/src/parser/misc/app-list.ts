import { PIPE } from '../../utils/constants';
import { type AppList, ListNodeType, ListItemNodeType } from '../common';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { parseListItems } from './list-helpers';
import { defaultParserOptions } from '../options';
import { ParserBase } from '../interface';

const APP_LIST_SEPARATOR = PIPE;

/**
 * `AppListParser` is responsible for parsing an app list.
 *
 * @see {@link https://adguard.app/kb/general/ad-filtering/create-own-filters/#app-modifier}
 */
export class AppListParser extends ParserBase {
    /**
     * Parses an app list which items are separated by `|`,
     * e.g. `Example.exe|com.example.osx`.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     *
     * @returns App list AST.
     * @throws An {@link AdblockSyntaxError} if the app list is syntactically invalid.
     * @throws An {@link Error} if the options are invalid.
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): AppList {
        const result: AppList = {
            type: ListNodeType.AppList,
            separator: APP_LIST_SEPARATOR,
            children: parseListItems(raw, options, baseOffset, APP_LIST_SEPARATOR, ListItemNodeType.App),
        };

        if (options.isLocIncluded) {
            result.start = baseOffset;
            result.end = baseOffset + raw.length;
        }

        return result;
    }

    // TODO: implement generate method if needed
}
