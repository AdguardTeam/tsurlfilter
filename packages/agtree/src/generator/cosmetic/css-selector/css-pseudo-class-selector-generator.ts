import { type CssPseudoClassSelector } from '../../../nodes';
import {
    CLOSE_PARENTHESIS,
    COLON,
    EMPTY,
    OPEN_PARENTHESIS,
} from '../../../utils/constants';
import { BaseGenerator } from '../../base-generator';
import { ValueGenerator } from '../../misc/value-generator';

/**
 * CSS pseudo-class selector generator.
 */
export class CssPseudoClassSelectorGenerator extends BaseGenerator {
    /**
     * Generates a string representation of the CSS pseudo-class selector.
     *
     * @param node CSS pseudo-class selector node.
     *
     * @returns String representation of the CSS pseudo-class selector.
     *
     * @throws Error if the `node` is invalid.
     */
    public static generate(node: CssPseudoClassSelector): string {
        const result: string[] = [];

        result.push(COLON);
        result.push(ValueGenerator.generate(node.name));

        if (node.argument !== undefined) {
            result.push(OPEN_PARENTHESIS);
            result.push(ValueGenerator.generate(node.argument));
            result.push(CLOSE_PARENTHESIS);
        }

        return result.join(EMPTY);
    }
}
