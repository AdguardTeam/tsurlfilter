import { type CosmeticRule } from '@adguard/tsurlfilter';

// FIXME this type was duplicated somewhere else
export type ScriptFunction = () => void;

export type LocalScriptRules = {
    [key: string]: ScriptFunction;
};

// FIXME comment
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
    // FIXME comment
    /**
     * If {@link setLocalScriptRules} was called (for example, it should be
     * called in Firefox AMO), this set will contain a list of prebuilt JSON
     * with scriptlets and JS rules allowed to run.
     * Otherwise it will remain undefined.
     * Key is the scriptlet call (e.g.: `example.com#%#//scriptlet('foo')` it will be `#%#//scriptlet('foo')`)
     * and the value is the list of domains from the rule.
     */
    private localScripts: LocalScriptRules | undefined;

    /**
     * Saves local script rules to object.
     *
     * @param localScriptRules Object with pre-build JS rules.
     */
    setLocalScriptRules(localScriptRules: LocalScriptRules): void {
        this.localScripts = localScriptRules;
    }

    /**
     * Checks if ruleText is in the pre-built JSON with JS rules.
     *
     * @param rule Rule text.
     *
     * @returns True, if rule is local, else returns false.
     */
    isLocal(rule: CosmeticRule): boolean {
        return !!this.getLocalScriptFunction(rule);
    }

    /**
     * Gets local script function for the rule.
     *
     * @param rule Cosmetic rule.
     *
     * @returns Local script function or undefined if it's not found.
     */
    getLocalScriptFunction(rule: CosmeticRule): ScriptFunction | undefined {
        if (this.localScripts === undefined) {
            return undefined;
        }

        const scriptFunc = this.localScripts[rule.getContent()];

        if (scriptFunc === undefined) {
            return undefined;
        }

        return scriptFunc;
    }
}

export const localScriptRulesService = new LocalScriptRulesService();
