import { type ListItem, ListItemNodeType } from '../../nodes/index.js';
import { defaultParserOptions } from '../options.js';
import { COMMA, NEGATION_MARKER } from '../../utils/constants.js';
import { StringUtils } from '../../utils/string.js';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error.js';

/**
 * Prefixes for error messages which are used for parsing of value lists.
 */
export const LIST_PARSE_ERROR_PREFIX = {
    EMPTY_ITEM: 'Empty value specified in the list',
    NO_MULTIPLE_NEGATION: 'Exception marker cannot be followed by another exception marker',
    NO_SEPARATOR_AFTER_NEGATION: 'Exception marker cannot be followed by a separator',
    NO_SEPARATOR_AT_THE_BEGINNING: 'Value list cannot start with a separator',
    NO_SEPARATOR_AT_THE_END: 'Value list cannot end with a separator',
    NO_WHITESPACE_AFTER_NEGATION: 'Exception marker cannot be followed by whitespace',
};

/**
 * Parser for list items in modifiers.
 */
export class ListItemsParser {
    /**
     * Parses a `raw` modifier value which may be represented as a list of items separated by `separator`.
     * Needed for $app, $denyallow, $domain, $method.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @param separator Separator character (default: comma)
     * @param type Type of the list items (default: {@link ListItemNodeType.Domain}).
     * @template T Type of the list items.
     *
     * @returns List of parsed items.
     * @throws An {@link AdblockSyntaxError} if the list is syntactically invalid
     *
     * @example
     * - parses an app list — `com.example.app|Example.exe`
     * - parses a domain list — `example.com,example.org,~example.org` or `example.com|~example.org`
     * - parses a method list — `~post|~put`
     */
    public static parse<T extends ListItemNodeType>(
        raw: string,
        options = defaultParserOptions,
        baseOffset = 0,
        separator = COMMA,
        type: T = ListItemNodeType.Unknown as T,
    ): ListItem<T>[] {
        // Function body here
        const rawListItems: ListItem<T>[] = [];

        let offset = 0;

        // Skip whitespace before the list
        offset = StringUtils.skipWS(raw, offset);

        // If the first character is a separator, then the list is invalid
        // and no need to continue parsing
        if (raw[offset] === separator) {
            throw new AdblockSyntaxError(
                LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AT_THE_BEGINNING,
                baseOffset + offset,
                baseOffset + raw.length,
            );
        }

        // If the last character is a separator, then the list item is invalid
        // and no need to continue parsing
        const realEndIndex = StringUtils.skipWSBack(raw);

        if (raw[realEndIndex] === separator) {
            throw new AdblockSyntaxError(
                LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AT_THE_END,
                baseOffset + realEndIndex,
                baseOffset + realEndIndex + 1,
            );
        }

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
                        baseOffset + itemStart,
                        baseOffset + itemStart + 1,
                    );
                }

                // Exception marker cannot be followed by a separator
                if (item === separator) {
                    throw new AdblockSyntaxError(
                        LIST_PARSE_ERROR_PREFIX.NO_SEPARATOR_AFTER_NEGATION,
                        baseOffset + itemStart,
                        baseOffset + itemStart + 1,
                    );
                }

                // Exception marker cannot be followed by whitespace
                if (StringUtils.isWhitespace(item)) {
                    throw new AdblockSyntaxError(
                        LIST_PARSE_ERROR_PREFIX.NO_WHITESPACE_AFTER_NEGATION,
                        baseOffset + itemStart,
                        baseOffset + itemStart + 1,
                    );
                }
            }

            // List item can't be empty
            // Note we use '<=' instead of '===' because we have bidirectional trim
            // This is needed to handle cases like 'example.com, ,example.org'
            if (itemEnd <= itemStart) {
                throw new AdblockSyntaxError(
                    LIST_PARSE_ERROR_PREFIX.EMPTY_ITEM,
                    baseOffset + itemStart,
                    baseOffset + raw.length,
                );
            }

            const listItem: ListItem<T> = {
                type,
                value: raw.slice(itemStart, itemEnd),
                exception,
            };

            if (options.isLocIncluded) {
                listItem.start = baseOffset + itemStart;
                listItem.end = baseOffset + itemEnd;
            }

            // Collect list item
            rawListItems.push(listItem);

            // Increment the offset to the next list item (or the end of the string)
            offset = separatorStartIndex === -1 ? raw.length : separatorStartIndex + 1;
        }

        return rawListItems;
    }
}
