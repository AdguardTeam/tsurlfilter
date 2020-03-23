import Scriptlets from 'scriptlets';

/**
 * Rule converter class
 */
export class RuleConverter {
    /**
     * Convert external scriptlet rule to AdGuard scriptlet syntax
     *
     * @param {string} rule convert rule
     */
    public static convertRule(rule: string): string[] {
        const converted = Scriptlets.convertScriptletToAdg(rule);
        if (converted) {
            return converted;
        }

        // TODO: Convert ubo script rule
        // TODO: Convert ubo css rule

        // TODO: Convert abp redirect rule
        // TODO: Convert options

        return [rule];
    }
}
