import { BaseGenerator } from '../base-generator';
import type { Agent } from '../../nodes';
import { EMPTY, SPACE } from '../../utils/constants';
import { isUndefined } from '../../utils/type-guards';

export class AgentGenerator extends BaseGenerator {
    /**
     * Converts an adblock agent node to a string.
     *
     * @param value Agent node
     * @returns Raw string
     */
    public static generate(value: Agent): string {
        let result = EMPTY;

        // Agent adblock name
        result += value.adblock.value;

        // Agent adblock version (if present)
        if (!isUndefined(value.version)) {
            // Add a space between the name and the version
            result += SPACE;

            result += value.version.value;
        }

        return result;
    }
}
