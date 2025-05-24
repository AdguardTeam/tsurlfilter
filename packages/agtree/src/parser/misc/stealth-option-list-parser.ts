import { PIPE } from '../../utils/constants.js';
import { type StealthOptionList, ListNodeType, ListItemNodeType } from '../../nodes/index.js';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error.js';
import { defaultParserOptions } from '../options.js';
import { BaseParser } from '../base-parser.js';
import { ListItemsParser } from './list-items-parser.js';

const STEALTH_OPTION_LIST_SEPARATOR = PIPE;

/**
 * `StealthOptionListParser` is responsible for parsing a list of stealth options.
 *
 * @see {@link https://adguard.app/kb/general/ad-filtering/create-own-filters/#stealth-modifier}
 */
export class StealthOptionListParser extends BaseParser {
    /**
     * Parses a stealth option list which items are separated by `|`,
     * e.g. `dpi|ip`.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     *
     * @returns Stealth option list AST.
     * @throws An {@link AdblockSyntaxError} if the stealth option list is syntactically invalid.
     * @throws An {@link Error} if the options are invalid.
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): StealthOptionList {
        const result: StealthOptionList = {
            type: ListNodeType.StealthOptionList,
            separator: STEALTH_OPTION_LIST_SEPARATOR,
            children: ListItemsParser.parse(
                raw,
                options,
                baseOffset,
                STEALTH_OPTION_LIST_SEPARATOR,
                ListItemNodeType.StealthOption,
            ),
        };

        if (options.isLocIncluded) {
            result.start = baseOffset;
            result.end = baseOffset + raw.length;
        }

        return result;
    }

    // TODO: implement generate method if needed
}
