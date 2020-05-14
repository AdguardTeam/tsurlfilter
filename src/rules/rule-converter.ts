import Scriptlets from 'scriptlets';

/**
 * Rule converter class
 */
export class RuleConverter {
    /**
     * Converts UBO and ABP redirect rules to AdGuard redirect rules
     * @param rule
     * @return {string} convertedRule
     */
    private static convertUboAndAbpRedirectsToAdg(rule: string): string | null {
        const { redirects } = Scriptlets;
        if (redirects.isUboRedirectCompatibleWithAdg(rule) || redirects.isAbpRedirectCompatibleWithAdg(rule)) {
            return redirects.convertRedirectToAdg(rule);
        }

        return rule;
    }

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

        // Convert abp redirect rule
        const abpRedirectRule = RuleConverter.convertUboAndAbpRedirectsToAdg(rule);
        if (abpRedirectRule) {
            return [abpRedirectRule];
        }

        // TODO: Convert options

        return [rule];
    }
}
