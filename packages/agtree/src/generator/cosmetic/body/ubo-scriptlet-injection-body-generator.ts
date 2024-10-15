import { BaseGenerator } from '../../base-generator';
import type { ScriptletInjectionRuleBody } from '../../../nodes';
import {
    CLOSE_PARENTHESIS,
    EMPTY,
    OPEN_PARENTHESIS,
    UBO_SCRIPTLET_MASK,
} from '../../../utils/constants';
import { ParameterListGenerator } from '../../misc/parameter-list-generator';

export class UboScriptletInjectionBodyGenerator extends BaseGenerator {
    /**
     * Error messages used by the parser.
     */
    public static readonly ERROR_MESSAGES = {
        NO_MULTIPLE_SCRIPTLET_CALLS: 'uBO syntaxes does not support multiple scriptlet calls within one single rule',
    };

    /**
     * Generates a string representation of the uBlock scriptlet call body.
     *
     * @param node Scriptlet injection rule body
     * @returns String representation of the rule body
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
