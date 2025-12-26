import type { ScriptletInjectionRuleBody } from '../../../nodes';
import { SEMICOLON, SPACE } from '../../../utils/constants';
import { BaseGenerator } from '../../base-generator';
import { ParameterListGenerator } from '../../misc/parameter-list-generator';
import { AbpSnippetInjectionBodyCommon } from '../../../common/abp-snippet-injection-body-common';

/**
 * Adblock Plus snippet injection body generator.
 */
export class AbpSnippetInjectionBodyGenerator extends BaseGenerator {
    /**
     * Generates a string representation of the Adblock Plus-style snippet call body.
     *
     * @param node Scriptlet injection rule body
     * @returns String representation of the rule body
     * @throws Error if the scriptlet call is empty
     */
    public static generate(node: ScriptletInjectionRuleBody): string {
        const result: string[] = [];

        if (node.children.length === 0) {
            throw new Error(AbpSnippetInjectionBodyCommon.ERROR_MESSAGES.EMPTY_SCRIPTLET_CALL);
        }

        for (const scriptletCall of node.children) {
            if (scriptletCall.children.length === 0) {
                throw new Error(AbpSnippetInjectionBodyCommon.ERROR_MESSAGES.EMPTY_SCRIPTLET_CALL);
            }

            result.push(ParameterListGenerator.generate(scriptletCall, SPACE));
        }

        return result.join(SEMICOLON + SPACE);
    }
}
