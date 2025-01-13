import { type CosmeticRule } from '@adguard/tsurlfilter';

/**
 * Local script function type.
 */
export type LocalScriptFunction = () => void;

/**
 * Type for local script functions data where
 * - key is rule as string
 * - value is function ready to be executed.
 */
export type LocalScriptFunctionData = {
    [key: string]: LocalScriptFunction;
};

/**
 * By the rules of AMO we cannot use remote scripts (and our JS rules can be counted as such).
 * Because of that we use the following approach (that was accepted by Chrome reviewers):
 *
 * 1. We pre-build JS rules from AdGuard filters into the JSON file.
 * 2. At runtime we check every JS rule if it's included into JSON.
 *    If it is included we allow this rule to work since it's pre-built. Other rules are discarded.
 * 3. We also allow "User rules" to work since those rules are added manually by the user.
 *    This way filters maintainers can test new rules before including them in the filters.
 */
export class LocalScriptRulesService {
    /**
     * If {@link setLocalScriptRules} was called (for example, it should be
     * called for Chromium-MV3), this set will contain a list of prebuilt js file
     * with JS rules allowed to run.
     * Otherwise it will remain undefined.
     */
    private localScripts: LocalScriptFunctionData | undefined;

    /**
     * Saves local script rules to object.
     *
     * @param localScriptRules Object with pre-build JS rules.
     */
    setLocalScriptRules(localScriptRules: LocalScriptFunctionData): void {
        this.localScripts = localScriptRules;
    }

    /**
     * Gets local script function for the rule.
     *
     * @param rule Cosmetic rule.
     *
     * @returns Local script function or null if not found.
     */
    getLocalScriptFunction(rule: CosmeticRule): LocalScriptFunction | null {
        if (this.localScripts === undefined) {
            return null;
        }

        const scriptFunc = this.localScripts[rule.getContent()];

        if (scriptFunc === undefined) {
            return null;
        }

        return scriptFunc;
    }
}

export const localScriptRulesService = new LocalScriptRulesService();
