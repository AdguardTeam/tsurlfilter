import { type ComplexSelector } from '../../../nodes';
import { EMPTY } from '../../../utils/constants';
import { BaseGenerator } from '../../base-generator';
import { TypeSelectorGenerator } from './type-selector-generator';
import { IdSelectorGenerator } from './id-selector-generator';
import { ClassSelectorGenerator } from './class-selector-generator';
import { AttributeSelectorGenerator } from './attribute-selector-generator';
import { PseudoClassSelectorGenerator } from './pseudo-class-selector-generator';
import { SelectorCombinatorGenerator } from './selector-combinator-generator';

/**
 * Complex selector generator.
 */
export class ComplexSelectorGenerator extends BaseGenerator {
    /**
     * Generates a string representation of the complex selector.
     *
     * @param node Complex selector node.
     *
     * @returns String representation of the complex selector.
     *
     * @throws Error if the `node` is invalid.
     */
    public static generate(node: ComplexSelector): string {
        if (node.children.length === 0) {
            throw new Error('Complex selector cannot be empty');
        }

        const result: string[] = [];
        for (let i = 0; i < node.children.length; i += 1) {
            const selector = node.children[i];
            const { type } = selector;

            // Validate that compound selectors are not empty
            if (
                (i === 0 || node.children[i - 1].type === 'SelectorCombinator')
                && type === 'SelectorCombinator'
            ) {
                throw new Error('Empty compound selector found');
            }

            let selectorResult: string;
            switch (type) {
                case 'TypeSelector':
                    selectorResult = TypeSelectorGenerator.generate(selector);
                    break;

                case 'IdSelector':
                    selectorResult = IdSelectorGenerator.generate(selector);
                    break;

                case 'ClassSelector':
                    selectorResult = ClassSelectorGenerator.generate(selector);
                    break;

                case 'AttributeSelector':
                    selectorResult = AttributeSelectorGenerator.generate(selector);
                    break;

                case 'PseudoClassSelector':
                    selectorResult = PseudoClassSelectorGenerator.generate(selector);
                    break;

                case 'SelectorCombinator':
                    selectorResult = SelectorCombinatorGenerator.generate(selector);
                    break;

                default:
                    throw new Error(`Unknown selector type: ${type}`);
            }

            result.push(selectorResult);
        }

        return result.join(EMPTY);
    }
}
