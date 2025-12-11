import { type CssComplexSelector } from '../../../nodes';
import { EMPTY } from '../../../utils/constants';
import { BaseGenerator } from '../../base-generator';
import { CssComplexSelectorItemGenerator } from './css-complex-selector-item-generator';

/**
 * CSS complex selector generator.
 */
export class CssComplexSelectorGenerator extends BaseGenerator {
    /**
     * Generates a string representation of the CSS complex selector.
     *
     * @param node CSS complex selector node.
     *
     * @returns String representation of the CSS complex selector.
     *
     * @throws Error if the `node` is invalid.
     */
    public static generate(node: CssComplexSelector): string {
        if (node.children.length === 0) {
            throw new Error('CSS complex selector cannot be empty');
        }

        const result: string[] = [];
        for (let i = 0; i < node.children.length; i += 1) {
            const complexSelectorItem = node.children[i];

            if (i === 0 && complexSelectorItem.combinator) {
                throw new Error('First complex selector item cannot start with a combinator');
            }

            if (i > 0 && !complexSelectorItem.combinator) {
                throw new Error('Missing combinator between complex selector items');
            }

            result.push(CssComplexSelectorItemGenerator.generate(complexSelectorItem));
        }

        return result.join(EMPTY);
    }
}
