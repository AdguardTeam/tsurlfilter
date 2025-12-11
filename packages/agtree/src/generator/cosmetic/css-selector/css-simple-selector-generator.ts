import { type CssSimpleSelector } from '../../../nodes';
import { BaseGenerator } from '../../base-generator';
import { ValueGenerator } from '../../misc/value-generator';
import { CssAttributeSelectorGenerator } from './css-attribute-selector-generator';
import { CssPseudoClassSelectorGenerator } from './css-pseudo-class-selector-generator';

/**
 * CSS simple selector generator.
 */
export class CssSimpleSelectorGenerator extends BaseGenerator {
    /**
     * Generates a string representation of the CSS simple selector.
     *
     * @param node CSS simple selector node.
     *
     * @returns String representation of the CSS simple selector.
     *
     * @throws Error if the `node` is invalid.
     */
    public static generate(node: CssSimpleSelector): string {
        const { type } = node;
        switch (type) {
            case 'Value':
                return ValueGenerator.generate(node);

            case 'CssAttributeSelector':
                return CssAttributeSelectorGenerator.generate(node);

            case 'CssPseudoClassSelector':
                return CssPseudoClassSelectorGenerator.generate(node);

            default:
                throw new Error(`Unknown simple selector type: ${type}`);
        }
    }
}
