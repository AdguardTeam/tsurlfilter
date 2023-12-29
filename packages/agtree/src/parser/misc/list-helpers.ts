import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { COMMA, NEGATION_MARKER } from '../../utils/constants';
import { StringUtils } from '../../utils/string';
import { locRange } from '../../utils/location';
import {
    type App,
    type Domain,
    type ListItemNoType,
    type Method,
} from '../common';
import { getParserOptions, type ParserOptions } from '../options';

/**
 * Common options for list parsers.
 */
export interface ListParserOptions extends ParserOptions {
    /**
     * Separator character.
     */
    separator: string;
}

/**
 * Prefixes for error messages which are used for parsing of value lists.
 */
export const LIST_PARSE_ERROR_PREFIX = {
    EMPTY_ITEM: 'Empty value specified in the list',
    NO_MULTIPLE_NEGATION: 'Exception marker cannot be followed by another exception marker',
    NO_SEPARATOR_AFTER_NEGATION: 'Exception marker cannot be followed by a separator',
    NO_SEPARATOR_AT_THE_END: 'Value list cannot end with a separator',
    NO_WHITESPACE_AFTER_NEGATION: 'Exception marker cannot be followed by whitespace',
};

/**
 * Parses a `raw` modifier value which may be represented as a list of items separated by `separator`.
 * Needed for $app, $denyallow, $domain, $method.
 *
 * @param raw Raw modifier value.
 * @param options List parser options. See {@link ListParserOptions}.
 *
 * @returns List AST children — {@link App} | {@link Domain} | {@link Method} —
 * but with no `type` specified (see {@link ListItemNoType}).
 * @throws An {@link AdblockSyntaxError} if the list is syntactically invalid
 *
 * @example
 * - parses an app list — `com.example.app|Example.exe`
 * - parses a domain list — `example.com,example.org,~example.org` or `example.com|~example.org`
 * - parses a method list — `~post|~put`
 */
export const parseListItems = (raw: string, options: Partial<ListParserOptions> = {}): ListItemNoType[] => {
    const separator = options.separator ?? COMMA;
    const { baseLoc, isLocIncluded } = getParserOptions(options);
    const rawListItems: ListItemNoType[] = [];

    // If the last character is a separator, then the list item is invalid
    // and no need to continue parsing
    const realEndIndex = StringUtils.skipWSBack(raw);

    if (raw[realEndIndex] === separator) {
        throw new AdblockSyntaxError(
            LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AT_THE_END,
            locRange(baseLoc, realEndIndex, realEndIndex + 1),
        );
    }

    let offset = 0;

    // Skip whitespace before the list
    offset = StringUtils.skipWS(raw, offset);

    // Split list items by unescaped separators
    while (offset < raw.length) {
        // Skip whitespace before the list item
        offset = StringUtils.skipWS(raw, offset);

        let itemStart = offset;

        // Find the index of the first unescaped separator character
        const separatorStartIndex = StringUtils.findNextUnescapedCharacter(raw, separator, offset);

        const itemEnd = separatorStartIndex === -1
            ? StringUtils.skipWSBack(raw) + 1
            : StringUtils.skipWSBack(raw, separatorStartIndex - 1) + 1;

        const exception = raw[itemStart] === NEGATION_MARKER;

        // Skip the exception marker
        if (exception) {
            itemStart += 1;

            const item = raw[itemStart];

            // Exception marker cannot be followed by another exception marker
            if (item === NEGATION_MARKER) {
                throw new AdblockSyntaxError(
                    LIST_PARSE_ERROR_PREFIX.NO_MULTIPLE_NEGATION,
                    locRange(baseLoc, itemStart, itemStart + 1),
                );
            }

            // Exception marker cannot be followed by a separator
            if (item === separator) {
                throw new AdblockSyntaxError(
                    LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AFTER_NEGATION,
                    locRange(baseLoc, itemStart, itemStart + 1),
                );
            }

            // Exception marker cannot be followed by whitespace
            if (StringUtils.isWhitespace(item)) {
                throw new AdblockSyntaxError(
                    LIST_PARSE_ERROR_PREFIX.NO_WHITESPACE_AFTER_NEGATION,
                    locRange(baseLoc, itemStart, itemStart + 1),
                );
            }
        }

        // List item can't be empty
        if (itemStart === itemEnd) {
            throw new AdblockSyntaxError(
                LIST_PARSE_ERROR_PREFIX.EMPTY_ITEM,
                locRange(baseLoc, itemStart, raw.length),
            );
        }

        const listItem: ListItemNoType = {
            value: raw.substring(itemStart, itemEnd),
            exception,
        };

        if (isLocIncluded) {
            listItem.loc = locRange(baseLoc, itemStart, itemEnd);
        }

        // Collect list item
        rawListItems.push(listItem);

        // Increment the offset to the next list item (or the end of the string)
        offset = separatorStartIndex === -1 ? raw.length : separatorStartIndex + 1;
    }

    return rawListItems;
};
