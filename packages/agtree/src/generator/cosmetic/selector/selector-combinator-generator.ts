import { type SelectorCombinator } from '../../../nodes';
import { SPACE } from '../../../utils/constants';
import { BaseGenerator } from '../../base-generator';

/**
 * Selector combinator generator.
 */
export class SelectorCombinatorGenerator extends BaseGenerator {
    /**
     * Generates a string representation of the selector combinator.
     *
     * @param node Selector combinator node.
     *
     * @returns String representation of the selector combinator.
     */
    public static generate(node: SelectorCombinator): string {
        // For descendant combinator, we don't need to add spaces around it
        if (node.value === ' ') {
            return node.value;
        }

        return SPACE + node.value + SPACE;
    }
}
