import { type CssAttributeSelector } from '../../../nodes';
import { CLOSE_SQUARE_BRACKET, EMPTY, OPEN_SQUARE_BRACKET } from '../../../utils/constants';
import { BaseGenerator } from '../../base-generator';
import { ValueGenerator } from '../../misc/value-generator';
import { CssAttributeSelectorValueGenerator } from './css-attribute-selector-value-generator';

/**
 * CSS attribute selector generator.
 */
export class CssAttributeSelectorGenerator extends BaseGenerator {
    /**
     * Generates a string representation of the CSS attribute selector.
     *
     * @param node CSS attribute selector node.
     *
     * @returns String representation of the CSS attribute selector.
     */
    public static generate(node: CssAttributeSelector): string {
        const result: string[] = [];

        result.push(OPEN_SQUARE_BRACKET);
        result.push(ValueGenerator.generate(node.name));

        if (node.value) {
            result.push(CssAttributeSelectorValueGenerator.generate(node.value));
        }

        result.push(CLOSE_SQUARE_BRACKET);

        return result.join(EMPTY);
    }
}
