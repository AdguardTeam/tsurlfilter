import { type CssCompoundSelector } from '../../../nodes';
import { EMPTY } from '../../../utils/constants';
import { BaseGenerator } from '../../base-generator';
import { CssSimpleSelectorGenerator } from './css-simple-selector-generator';

/**
 * CSS compound selector generator.
 */
export class CssCompoundSelectorGenerator extends BaseGenerator {
    /**
     * Generates a string representation of the CSS compound selector.
     *
     * @param node CSS compound selector node.
     *
     * @returns String representation of the CSS compound selector.
     *
     * @throws Error if the `node` is invalid.
     */
    public static generate(node: CssCompoundSelector): string {
        if (node.children.length === 0) {
            throw new Error('CSS compound selector cannot be empty');
        }

        const result: string[] = [];
        for (const simpleSelector of node.children) {
            result.push(CssSimpleSelectorGenerator.generate(simpleSelector));
        }

        return result.join(EMPTY);
    }
}
