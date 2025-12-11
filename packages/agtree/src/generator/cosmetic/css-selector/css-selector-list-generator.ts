import { type CssSelectorList } from '../../../nodes';
import { COMMA, EMPTY, SPACE } from '../../../utils/constants';
import { BaseGenerator } from '../../base-generator';
import { CssComplexSelectorGenerator } from './css-complex-selector-generator';

/**
 * CSS selector list generator.
 */
export class CssSelectorListGenerator extends BaseGenerator {
    /**
     * Generates a string representation of the CSS selector list.
     *
     * @param node CSS selector list node.
     *
     * @returns String representation of the CSS selector list.
     *
     * @throws Error if the `node` is invalid.
     */
    public static generate(node: CssSelectorList): string {
        if (node.children.length === 0) {
            throw new Error('CSS selector list cannot be empty');
        }

        const result: string[] = [];
        for (let i = 0; i < node.children.length; i += 1) {
            const complexSelector = node.children[i];

            if (i > 0) {
                result.push(COMMA);
                result.push(SPACE);
            }

            result.push(CssComplexSelectorGenerator.generate(complexSelector));
        }

        return result.join(EMPTY);
    }
}
