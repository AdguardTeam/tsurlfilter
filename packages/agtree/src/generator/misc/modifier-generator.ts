import type { Modifier } from '../../nodes';
import { EMPTY, MODIFIER_ASSIGN_OPERATOR, NEGATION_MARKER } from '../../utils/constants';
import { BaseGenerator } from '../base-generator';

export class ModifierGenerator extends BaseGenerator {
    /**
     * Generates a string from a modifier (serializes it).
     *
     * @param modifier Modifier to generate string from
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
