import type { ScriptletInjectionRuleBody } from '../../../nodes/index.js';
import {
    ADG_SCRIPTLET_MASK,
    CLOSE_PARENTHESIS,
    EMPTY,
    OPEN_PARENTHESIS,
} from '../../../utils/constants.js';
import { ParameterListGenerator } from '../../misc/parameter-list-generator.js';
import { BaseGenerator } from '../../base-generator.js';

/**
 * AdGuard scriptlet injection body generator.
 */
export class AdgScriptletInjectionBodyGenerator extends BaseGenerator {
    /**
     * Error messages used by the generator.
     */
    public static readonly ERROR_MESSAGES = {
        NO_MULTIPLE_SCRIPTLET_CALLS: 'ADG syntaxes does not support multiple scriptlet calls within one single rule',
    };

    /**
     * Generates a string representation of the AdGuard scriptlet call body.
     *
     * @param node Scriptlet injection rule body
     * @returns String representation of the rule body
     * @throws Error if the scriptlet call has multiple parameters
     */
    public static generate(node: ScriptletInjectionRuleBody): string {
        const result: string[] = [];

        if (node.children.length > 1) {
            throw new Error(AdgScriptletInjectionBodyGenerator.ERROR_MESSAGES.NO_MULTIPLE_SCRIPTLET_CALLS);
        }

        result.push(ADG_SCRIPTLET_MASK);
        result.push(OPEN_PARENTHESIS);

        if (node.children.length > 0) {
            result.push(ParameterListGenerator.generate(node.children[0]));
        }

        result.push(CLOSE_PARENTHESIS);

        return result.join(EMPTY);
    }
}
