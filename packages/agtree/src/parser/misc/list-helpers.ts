import { EMPTY, NEGATION_MARKER } from '../../utils/constants';
import { type ListItemNodeType, type ListItem } from '../../nodes';

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

// FIXME move to a separate file with generators
/**
 * Generates a string representation of a list item.
 *
 * @param item List item to generate.
 * @template T Type of the list item.
 *
 * @returns String representation of the list item.
 */
const generateListItem = <T extends ListItemNodeType>(item: ListItem<T>): string => {
    return `${item.exception ? NEGATION_MARKER : EMPTY}${item.value}`;
};

// FIXME move to a separate file with generators
/**
 * Generates a string representation of a list of items.
 *
 * @param items List of items to generate.
 * @param separator Separator character.
 * @template T Type of the list items.
 *
 * @returns String representation of the list of items.
 */
export const generateListItems = <T extends ListItemNodeType>(items: ListItem<T>[], separator: string): string => {
    return items.map(generateListItem).join(separator);
};
