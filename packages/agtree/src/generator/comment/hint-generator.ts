import type { Hint } from '../../nodes';
import {
    CLOSE_PARENTHESIS,
    COMMA,
    EMPTY,
    OPEN_PARENTHESIS,
} from '../../utils/constants';
import { BaseGenerator } from '../base-generator';
import { ParameterListGenerator } from '../misc/parameter-list-generator';

/**
 * Hint generator.
 */
export class HintGenerator extends BaseGenerator {
    /**
     * Generates a string representation of a hint.
     *
     * @param hint Hint AST node
     * @returns String representation of the hint
     */
    public static generate(hint: Hint): string {
        let result = EMPTY;

        result += hint.name.value;

        if (hint.params && hint.params.children.length > 0) {
            result += OPEN_PARENTHESIS;
            result += ParameterListGenerator.generate(hint.params, COMMA);
            result += CLOSE_PARENTHESIS;
        }

        return result;
    }
}
