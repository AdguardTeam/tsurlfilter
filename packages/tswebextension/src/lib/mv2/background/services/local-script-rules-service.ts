import { type CosmeticRule } from '@adguard/tsurlfilter';
import { some } from 'lodash-es';

type ScriptDomains = {
    permittedDomains: string[];
    restrictedDomains: string[];
};

export type LocalScriptRules = {
    comment: string;
    rules: Record<string, ScriptDomains[]>;
};

/**
 * By the rules of AMO we cannot use remote scripts (and our JS rules can be counted as such).
 * Because of that we use the following approach (that was accepted by AMO reviewers):
 *
 * 1. We pre-build JS rules from AdGuard filters into the JSON file.
 * 2. At runtime we check every JS rule if it's included into JSON.
 *    If it is included, we allow this rule to work since it's pre-built. Other rules are discarded.
 * 3. We also allow "User rules" to work since those rules are added manually by the user.
 *    This way filters maintainers can test new rules before including them in the filters.
 */
export class LocalScriptRulesService {
    /**
     * If {@link setLocalScriptRules} was called (for example, it should be
     * called in Firefox AMO), this set will contain a list of prebuilt JSON
     * with scriptlets and JS rules allowed to run.
     * Otherwise it will remain undefined.
     * Key is the scriptlet call (e.g.: `example.com#%#//scriptlet('foo')` it will be `#%#//scriptlet('foo')`)
     * and the value is the list of domains from the rule.
     */
    private localScripts: Map<string, ScriptDomains[]> | undefined;

    /**
     * Saves local script rules to object.
     *
     * @param json JSON object with pre-build JS rules.
     */
    setLocalScriptRules(json: LocalScriptRules): void {
        this.localScripts = new Map(Object.entries(json.rules));
    }

    /**
     * Checks if ruleText is in the pre-built JSON with JS rules.
     *
     * @param rule Rule text.
     *
     * @returns True, if rule is local, else returns false.
     */
    isLocal(rule: CosmeticRule): boolean {
        if (this.localScripts === undefined) {
            return true;
        }

        // Key can be checked quickly
        const scriptDomains = this.localScripts.get(rule.getContent());

        if (scriptDomains === undefined) {
            return false;
        }

        return some(scriptDomains, {
            permittedDomains: rule.getPermittedDomains() ?? [],
            restrictedDomains: rule.getRestrictedDomains() ?? [],
        } as ScriptDomains);
    }
}

export const localScriptRulesService = new LocalScriptRulesService();
