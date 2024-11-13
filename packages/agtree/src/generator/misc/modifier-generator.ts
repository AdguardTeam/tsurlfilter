import type { Modifier } from '../../nodes';
import { EMPTY, MODIFIER_ASSIGN_OPERATOR, NEGATION_MARKER } from '../../utils/constants';
import { BaseGenerator } from '../base-generator';

/**
 * Generator for modifier nodes.
 */
export class ModifierGenerator extends BaseGenerator {
    /**
     * Converts a modifier AST node to a string.
     *
     * @param modifier Modifier AST node to convert
     * @returns String representation of the modifier
     */
    public static generate(modifier: Modifier): string {
        let result = EMPTY;

        if (modifier.exception) {
            result += NEGATION_MARKER;
        }

        result += modifier.name.value;

        if (modifier.value !== undefined) {
            result += MODIFIER_ASSIGN_OPERATOR;
            result += modifier.value.value;
        }

        return result;
    }
}
