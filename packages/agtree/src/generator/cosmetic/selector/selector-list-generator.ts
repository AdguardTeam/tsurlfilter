import { type SelectorList } from '../../../nodes';
import { COMMA, EMPTY, SPACE } from '../../../utils/constants';
import { BaseGenerator } from '../../base-generator';
import { ComplexSelectorGenerator } from './complex-selector-generator';

/**
 * Selector list generator.
 */
export class SelectorListGenerator extends BaseGenerator {
    /**
     * Generates a string representation of the selector list.
     *
     * @param node Selector list node.
     *
     * @returns String representation of the selector list.
     *
     * @throws Error if the `node` is invalid.
     */
    public static generate(node: SelectorList): string {
        if (node.children.length === 0) {
            throw new Error('Selector list cannot be empty');
        }

        const result: string[] = [];
        for (let i = 0; i < node.children.length; i += 1) {
            const complexSelector = node.children[i];

            if (i > 0) {
                result.push(COMMA);
                result.push(SPACE);
            }

            result.push(ComplexSelectorGenerator.generate(complexSelector));
        }

        return result.join(EMPTY);
    }
}
