import type { ScriptletInjectionRuleBody } from '../../../nodes';
import { SEMICOLON, SPACE } from '../../../utils/constants';
import { BaseGenerator } from '../../base-generator';
import { ParameterListGenerator } from '../../misc/parameter-list-generator';

export class AbpSnippetInjectionBodyGenerator extends BaseGenerator {
    // FIXME the same error message is in the parser too, so it needs to be moved to some common directory
    /**
     * Error messages used by the parser.
     */
    public static readonly ERROR_MESSAGES = {
        EMPTY_SCRIPTLET_CALL: 'Empty ABP snippet call',
    };

    /**
     * Generates a string representation of the Adblock Plus-style snippet call body.
     *
     * @param node Scriptlet injection rule body
     * @returns String representation of the rule body
     */
    public static generate(node: ScriptletInjectionRuleBody): string {
        const result: string[] = [];

        if (node.children.length === 0) {
            throw new Error(AbpSnippetInjectionBodyGenerator.ERROR_MESSAGES.EMPTY_SCRIPTLET_CALL);
        }

        for (const scriptletCall of node.children) {
            if (scriptletCall.children.length === 0) {
                throw new Error(AbpSnippetInjectionBodyGenerator.ERROR_MESSAGES.EMPTY_SCRIPTLET_CALL);
            }

            result.push(ParameterListGenerator.generate(scriptletCall, SPACE));
        }

        return result.join(SEMICOLON + SPACE);
    }
}
