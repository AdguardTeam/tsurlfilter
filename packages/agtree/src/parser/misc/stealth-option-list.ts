import { PIPE } from '../../utils/constants';
import { locRange } from '../../utils/location';
import {
    type StealthOption,
    type StealthOptionList,
    ListNodeType,
    ListItemNodeType,
} from '../common';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { type ListParserOptions, parseListItems } from './list-helpers';
import { getParserOptions } from '../options';

/**
 * `StealthOptionListParser` is responsible for parsing a list of stealth options.
 *
 * @see {@link https://adguard.app/kb/general/ad-filtering/create-own-filters/#stealth-modifier}
 */
export class StealthOptionListParser {
    /**
     * Parses a stealth option list which items are separated by `|`,
     * e.g. `dpi|ip`.
     *
     * @param raw Raw list of stealth options.
     * @param options List parser options. See {@link ListParserOptions}.
     *
     * @returns Stealth option list AST.
     * @throws An {@link AdblockSyntaxError} if the stealth option list is syntactically invalid.
     * @throws An {@link Error} if the options are invalid.
     */
    public static parse(raw: string, options: Partial<ListParserOptions> = {}): StealthOptionList {
        const separator = options.separator ?? PIPE;

        if (separator !== PIPE) {
            throw new Error(`Invalid separator: ${separator}`);
        }

        const { baseLoc, isLocIncluded } = getParserOptions(options);
        const rawItems = parseListItems(raw, { separator, baseLoc, isLocIncluded });
        const children: StealthOption[] = rawItems.map((rawListItem) => ({
            ...rawListItem,
            type: ListItemNodeType.StealthOption,
        }));

        const result: StealthOptionList = {
            type: ListNodeType.StealthOptionList,
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
