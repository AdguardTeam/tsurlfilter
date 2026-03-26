import { type ClassSelector } from '../../../nodes';
import { DOT } from '../../../utils/constants';
import { BaseGenerator } from '../../base-generator';

/**
 * Class selector generator.
 */
export class ClassSelectorGenerator extends BaseGenerator {
    /**
     * Generates a string representation of the class selector.
     *
     * @param node Class selector node.
     *
     * @returns String representation of the class selector.
     */
    public static generate(node: ClassSelector): string {
        return DOT + node.value;
    }
}
