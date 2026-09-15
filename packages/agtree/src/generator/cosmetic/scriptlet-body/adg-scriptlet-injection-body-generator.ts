import type { ScriptletInjectionRuleBody } from '../../../nodes';
import {
    ADG_SCRIPTLET_MASK,
    CLOSE_PARENTHESIS,
    COMMA,
    EMPTY,
    OPEN_PARENTHESIS,
    SPACE,
} from '../../../utils/constants';
import { BaseGenerator } from '../../base-generator';
import { ParameterGenerator } from '../../misc/parameter-generator';
import { ParameterListGenerator } from '../../misc/parameter-list-generator';

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
     * @param node Scriptlet injection rule body.
     *
     * @returns String representation of the rule body.
     *
     * @throws Error if the scriptlet call has multiple parameters.
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

    /**
     * Generates an ADG scriptlet body directly from raw (source-slice)
     * parameters, without allocating AST nodes. Produces the same output as
     * {@link generate} for the equivalent `ScriptletInjectionRuleBody`.
     *
     * @param params Raw scriptlet parameters (quotes intact), as returned by
     *   `CosmeticRuleDataReader.getScriptletParams`.
     *
     * @returns Canonical `//scriptlet(...)` body.
     */
    public static generateFromRawParams(params: readonly string[]): string {
        const parts = params.map((raw) => ParameterGenerator.generateFromRaw(raw));

        return ADG_SCRIPTLET_MASK + OPEN_PARENTHESIS + parts.join(`${COMMA}${SPACE}`) + CLOSE_PARENTHESIS;
    }
}
