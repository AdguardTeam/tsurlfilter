import type { MethodList } from '../../nodes';
import { BaseGenerator } from '../base-generator';
import { ListItemsGenerator } from './list-items-generator';

/**
 * Method list generator.
 */
export class MethodListGenerator extends BaseGenerator {
    /**
     * Converts a method list node to a string.
     *
     * @param node Method list node.
     *
     * @returns Raw string.
     */
    public static generate(node: MethodList): string {
        return ListItemsGenerator.generate(node.children, node.separator);
    }
}
