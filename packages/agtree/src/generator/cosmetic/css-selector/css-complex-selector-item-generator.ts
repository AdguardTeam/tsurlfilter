import { type CssComplexSelectorItem } from '../../../nodes';
import { EMPTY, SPACE } from '../../../utils/constants';
import { BaseGenerator } from '../../base-generator';
import { ValueGenerator } from '../../misc/value-generator';
import { CssCompoundSelectorGenerator } from './css-compound-selector-generator';

/**
 * CSS complex selector item generator.
 */
export class CssComplexSelectorItemGenerator extends BaseGenerator {
    /**
     * Generates a string representation of the CSS complex selector item.
     *
     * @param node CSS complex selector item node.
     *
     * @returns String representation of the CSS complex selector item.
     *
     * @throws Error if the `node` is invalid.
     */
    public static generate(node: CssComplexSelectorItem): string {
        const result: string[] = [];

        if (node.combinator) {
            if (node.combinator.value === SPACE) {
                result.push(SPACE);
            } else {
                result.push(SPACE);
                result.push(ValueGenerator.generate(node.combinator));
                result.push(SPACE);
            }
        }

        result.push(CssCompoundSelectorGenerator.generate(node.selector));

        return result.join(EMPTY);
    }
}
