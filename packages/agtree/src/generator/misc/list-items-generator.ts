import { type ListItem, type ListItemNodeTypeType } from '../../nodes';
import { EMPTY, NEGATION_MARKER } from '../../utils/constants';

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
    private static generateListItem = <T extends ListItemNodeTypeType>(item: ListItem<T>): string => {
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
    public static generate = <T extends ListItemNodeTypeType>(items: ListItem<T>[], separator: string): string => {
        return items.map(ListItemsGenerator.generateListItem)
            .join(separator);
    };
}
