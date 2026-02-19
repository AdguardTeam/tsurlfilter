import { type PseudoClassSelector } from '../../../nodes';
import {
    CLOSE_PARENTHESIS,
    COLON,
    EMPTY,
    OPEN_PARENTHESIS,
} from '../../../utils/constants';
import { BaseGenerator } from '../../base-generator';
import { ValueGenerator } from '../../misc/value-generator';

/**
 * Pseudo-class selector generator.
 */
export class PseudoClassSelectorGenerator extends BaseGenerator {
    /**
     * Generates a string representation of the pseudo-class selector.
     *
     * @param node Pseudo-class selector node.
     *
     * @returns String representation of the pseudo-class selector.
     */
    public static generate(node: PseudoClassSelector): string {
        const result: string[] = [];

        result.push(COLON);
        result.push(ValueGenerator.generate(node.name));

        if (node.argument) {
            result.push(OPEN_PARENTHESIS);
            result.push(ValueGenerator.generate(node.argument));
            result.push(CLOSE_PARENTHESIS);
        }

        return result.join(EMPTY);
    }
}
