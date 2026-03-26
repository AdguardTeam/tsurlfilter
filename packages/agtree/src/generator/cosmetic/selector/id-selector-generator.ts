import { type IdSelector } from '../../../nodes';
import { HASHMARK } from '../../../utils/constants';
import { BaseGenerator } from '../../base-generator';

/**
 * ID selector generator.
 */
export class IdSelectorGenerator extends BaseGenerator {
    /**
     * Generates a string representation of the ID selector.
     *
     * @param node ID selector node.
     *
     * @returns String representation of the ID selector.
     */
    public static generate(node: IdSelector): string {
        return HASHMARK + node.value;
    }
}
