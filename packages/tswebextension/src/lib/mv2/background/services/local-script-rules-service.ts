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
    private static readonly JS_RULE_GENERIC_DOMAIN_TOKEN = '<any>';

    private static readonly JS_RULE_SEPARATOR_TOKEN = '#%#';

    /**
     * If {@link setLocalScriptRules} was called (for example, it should be
     * called in Firefox AMO), this set will contain a list of prebuilt JSON
     * with scriptlets and JS rules allowed to run.
     * Otherwise it will remain undefined.
     */
    private localScripts: Set<string> | undefined;

    /**
     * Saves local script rules to object.
     *
     * @param json JSON object with pre-build JS rules.
     */
    setLocalScriptRules(json: LocalScriptRules): void {
        this.localScripts = new Set(json.rules.map((rule) => {
            const { domains, script } = rule;
            let ruleText = '';
            if (domains !== LocalScriptRulesService.JS_RULE_GENERIC_DOMAIN_TOKEN) {
                ruleText = domains;
            }
            ruleText += `${LocalScriptRulesService.JS_RULE_SEPARATOR_TOKEN}${script}`;

            return ruleText;
        }));
    }

    /**
     * Checks if ruleText is in the pre-built JSON with JS rules.
     *
     * @param ruleText Rule text.
     *
     * @returns True, if rule is local, else returns false.
     */
    isLocal(ruleText: string): boolean {
        if (this.localScripts === undefined) {
            return true;
        }

        /**
         * In case of Firefox add-ons JS filtering rules are hardcoded
         * into add-on code. So, if rule is not local - we exclude these
         * rules from execution for Firefox AMO.
         *
         * Check description of {@link LocalScriptRulesService} for
         * details about script source.
         */
        return this.localScripts.has(ruleText);
    }
}

export const localScriptRulesService = new LocalScriptRulesService();
