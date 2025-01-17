import type { Value } from '../../nodes';
import { BaseGenerator } from '../base-generator';

/**
 * Generator for value nodes.
 */
export class ValueGenerator extends BaseGenerator {
    /**
     * Converts a value node to a string.
     *
     * @param node Value node.
     * @returns Raw string.
     */
    public static generate(node: Value): string {
        return node.value;
    }
}
