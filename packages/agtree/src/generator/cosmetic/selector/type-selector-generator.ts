import { type TypeSelector } from '../../../nodes';
import { BaseGenerator } from '../../base-generator';

/**
 * Type selector generator.
 */
export class TypeSelectorGenerator extends BaseGenerator {
    /**
     * Generates a string representation of the type selector.
     *
     * @param node Type selector node.
     *
     * @returns String representation of the type selector.
     */
    public static generate(node: TypeSelector): string {
        return node.value;
    }
}
