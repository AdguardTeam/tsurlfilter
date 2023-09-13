import { PIPE_MODIFIER_SEPARATOR } from '../../utils/constants';
import { locRange } from '../../utils/location';
import {
    type StealthOption,
    type StealthOptionList,
    defaultLocation,
    ListNodeType,
    ListItemNodeType,
} from '../common';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { parseListItems } from './list-helpers';

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
     * @param loc Location of the stealth option list in the rule. If not set, the default location is used.
     *
     * @returns Stealth option list AST.
     * @throws An {@link AdblockSyntaxError} if the stealth option list is syntactically invalid.
     */
    public static parse(
        raw: string,
        loc = defaultLocation,
    ): StealthOptionList {
        const separator = PIPE_MODIFIER_SEPARATOR;

        const rawItems = parseListItems(raw, separator, loc);
        const children: StealthOption[] = rawItems.map((rawListItem) => ({
            ...rawListItem,
            type: ListItemNodeType.StealthOption,
        }));

        return {
            type: ListNodeType.StealthOptionList,
            loc: locRange(loc, 0, raw.length),
            separator,
            children,
        };
    }

    // TODO: implement generate method if needed
}
