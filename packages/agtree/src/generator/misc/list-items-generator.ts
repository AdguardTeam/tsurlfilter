import { type ListItem, type ListItemNodeType } from '../../nodes/index.js';
import { EMPTY, NEGATION_MARKER } from '../../utils/constants.js';

/**
 * Utility class for generating string representations of list items.
 */
export class ListItemsGenerator {
    /**
     * Generates a string representation of a list item.
     *
     * @param item List item to generate.
     * @template T Type of the list item.
     *
     * @returns String representation of the list item.
     */
    private static generateListItem = <T extends ListItemNodeType>(item: ListItem<T>): string => {
        return `${item.exception ? NEGATION_MARKER : EMPTY}${item.value}`;
    };

    /**
     * Generates a string representation of a list of items.
     *
     * @param items List of items to generate.
     * @param separator Separator character.
     * @template T Type of the list items.
     *
     * @returns String representation of the list of items.
     */
    public static generate = <T extends ListItemNodeType>(items: ListItem<T>[], separator: string): string => {
        return items.map(ListItemsGenerator.generateListItem)
            .join(separator);
    };
}
