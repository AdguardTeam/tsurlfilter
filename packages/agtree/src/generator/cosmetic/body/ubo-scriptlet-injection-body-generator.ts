import { BaseGenerator } from '../../base-generator.js';
import type { ScriptletInjectionRuleBody } from '../../../nodes/index.js';
import {
    CLOSE_PARENTHESIS,
    EMPTY,
    OPEN_PARENTHESIS,
    UBO_SCRIPTLET_MASK,
} from '../../../utils/constants.js';
import { ParameterListGenerator } from '../../misc/parameter-list-generator.js';

/**
 * uBlock scriptlet injection body generator.
 */
export class UboScriptletInjectionBodyGenerator extends BaseGenerator {
    /**
     * Error messages used by the generator.
     */
    public static readonly ERROR_MESSAGES = {
        NO_MULTIPLE_SCRIPTLET_CALLS: 'uBO syntaxes does not support multiple scriptlet calls within one single rule',
    };

    /**
     * Generates a string representation of the uBlock scriptlet call body.
     *
     * @param node Scriptlet injection rule body
     * @returns String representation of the rule body
     * @throws Error if the scriptlet call has multiple parameters
     */
    public static generate(node: ScriptletInjectionRuleBody): string {
        const result: string[] = [];

        if (node.children.length > 1) {
            throw new Error(UboScriptletInjectionBodyGenerator.ERROR_MESSAGES.NO_MULTIPLE_SCRIPTLET_CALLS);
        }

        // During generation, we only support the modern scriptlet mask
        result.push(UBO_SCRIPTLET_MASK);
        result.push(OPEN_PARENTHESIS);

        if (node.children.length > 0) {
            const [parameterListNode] = node.children;
            result.push(ParameterListGenerator.generate(parameterListNode));
        }

        result.push(CLOSE_PARENTHESIS);

        return result.join(EMPTY);
    }
}
