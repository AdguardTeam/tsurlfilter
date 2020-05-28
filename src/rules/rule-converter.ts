import Scriptlets from 'scriptlets';

/**
 * Rule converter class
 */
export class RuleConverter {
    /**
     * uBlock scriptlet rule mask
     */
    private static UBO_SCRIPT_TAG_MASK = '##^script';

    /**
     * AdGuard max-length tag for uBlock scripts conversion
     */
    private static ADGUARD_SCRIPT_MAX_LENGTH = '[max-length="262144"]';

    /**
     * Converts UBO Script rule
     *
     * @param {string} ruleText rule text
     * @returns {string} converted rule
     */
    private static convertUboScriptTagRule(ruleText: string): string[] | null {
        if (ruleText.indexOf(RuleConverter.UBO_SCRIPT_TAG_MASK) === -1) {
            return null;
        }

        // We convert only one case ##^script:has-text at now
        const uboHasTextRule = ':has-text';
        const adgScriptTag = '$$script';
        const uboScriptTag = '##^script';

        const isRegExp = (str: string): boolean => str[0] === '/' && str[str.length - 1] === '/';

        const match = ruleText.split(uboHasTextRule);
        if (match.length === 1) {
            return null;
        }

        const domains = match[0].replace(uboScriptTag, '');
        const rules = [];
        for (let i = 1; i < match.length; i += 1) {
            const attr = match[i].slice(1, -1);
            if (isRegExp(attr)) {
                rules.push(`${domains}${uboScriptTag}${uboHasTextRule}(${attr})`);
            } else {
                // eslint-disable-next-line max-len
                rules.push(`${domains}${adgScriptTag}[tag-content="${attr}"]${RuleConverter.ADGUARD_SCRIPT_MAX_LENGTH}`);
            }
        }

        return rules;
    }

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
        try {
            const converted = Scriptlets.convertScriptletToAdg(rule);
            if (converted) {
                return converted;
            }

            const uboScriptRule = RuleConverter.convertUboScriptTagRule(rule);
            if (uboScriptRule) {
                return uboScriptRule;
            }

            // const uboCssStyleRule = RuleConverter.convertUboCssStyleRule(rule);
            // if (uboCssStyleRule) {
            //     return [uboCssStyleRule];
            // }

            // Convert abp redirect rule
            const abpRedirectRule = RuleConverter.convertUboAndAbpRedirectsToAdg(rule);
            if (abpRedirectRule) {
                return [abpRedirectRule];
            }

            // TODO: Convert options
        } catch (e) {
            // TODO: Log error
        }

        return [rule];
    }
}
