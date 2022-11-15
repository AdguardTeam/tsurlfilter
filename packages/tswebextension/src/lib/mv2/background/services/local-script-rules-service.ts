import { isFirefox } from '../utils';

type ScriptRule = {
    domains: string,
    script: string,
};

export type LocalScriptRules = {
    comment: string,
    rules: ScriptRule[],
};

/**
 * By the rules of AMO we cannot use remote scripts (and our JS rules can be counted as such).
 * Because of that we use the following approach (that was accepted by AMO reviewers):
 *
 * 1. We pre-build JS rules from AdGuard filters into the JSON file.
 * 2. At runtime we check every JS rule if it's included into JSON.
 *  If it is included we allow this rule to work since it's pre-built. Other rules are discarded.
 * 3. We also allow "User rules" to work since those rules are added manually by the user.
 *  This way filters maintainers can test new rules before including them in the filters.
 */
export class LocalScriptRulesService {
    private static jsRuleGenericDomainToken = '<any>';

    private static jsRuleSeparatorToken = '#%#';

    private data = new Set<string>();

    /**
     * Saves local script rules to object
     *
     * @param json JSON object with pre-build JS rules
     */
    setLocalScriptRules(json: LocalScriptRules): void {
        this.data = new Set(json.rules.map((rule) => {
            const { domains, script } = rule;
            let ruleText = '';
            if (domains !== LocalScriptRulesService.jsRuleGenericDomainToken) {
                ruleText = domains;
            }
            ruleText += `${LocalScriptRulesService.jsRuleSeparatorToken}${script}`;

            return ruleText;
        }));
    }

    /**
     * Checks if ruleText is in the pre-build JS rules JSON
     *
     * @param ruleText Rule text
     * @returns true, if rule is local, else returns false
     */
    isLocal(ruleText: string): boolean {
        if (isFirefox) {
            return this.data.has(ruleText);
        }

        // For other browsers all scripts are local
        return true;
    }
}

export const localScriptRulesService = new LocalScriptRulesService();
