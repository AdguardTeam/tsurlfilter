import type { AppList } from '../../nodes';
import { BaseGenerator } from '../base-generator';
import { ListItemsGenerator } from './list-items-generator';

/**
 * App list generator.
 */
export class AppListGenerator extends BaseGenerator {
    /**
     * Converts a app list node to a string.
     *
     * @param node App list node.
     *
     * @returns Raw string.
     */
    public static generate(node: AppList): string {
        return ListItemsGenerator.generate(node.children, node.separator);
    }
}
