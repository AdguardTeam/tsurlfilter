/**
 * A function type representing local script logic.
 */
export type LocalScriptFunction = () => void;

/**
 * An object containing local script functions, mapping each script (as a string)
 * to the corresponding function that’s ready to run.
 */
export type LocalScriptFunctionData = {
    [key: string]: LocalScriptFunction;
};

/**
 * An object containing local scriptlet rules, mapping each rule to a boolean value
 * indicating whether it is allowed to run.
 */
export type LocalScriptletRulesData = {
    [key: string]: boolean;
};

/**
 * It is possible to follow all places using this logic by searching JS_RULES_EXECUTION.
 *
 * Due to Chrome Web Store policies, we cannot execute remotely hosted code.
 * Therefore, we use the following approach:
 *
 * 1. We bundle AdGuard’s JS rules into a local file included with the extension.
 * 2. At runtime, we verify each JS rule to see if it's included in our local bundle.
 *    If it is, we allow it to run; otherwise, we discard it.
 */
export class LocalScriptRulesService {
    /**
     * When {@link setLocalScriptRules} is called, this holds a list of prebuilt JS rules
     * allowed to run. If it’s never called, this remains undefined.
     */
    private localScripts: LocalScriptFunctionData | undefined;

    /**
     * When {@link setLocalScriptletRules} is called, this holds a list of pre-built Scriptlets rules allowed to run.
     * If it is never called, this remains undefined.
     */
    private localScriptlets: LocalScriptletRulesData | undefined;

    /**
     * Stores prebuilt JS rules in memory for later use.
     *
     * @param localScriptRules A map of script text to their corresponding functions.
     * @param localScriptletRules A map of scriptlet rules as string
     * to a boolean value indicating whether it is allowed to run.
     */
    setLocalScriptRules(localScriptRules: LocalScriptFunctionData, localScriptletRules: LocalScriptletRulesData): void {
        this.localScripts = localScriptRules;
        this.localScriptlets = localScriptletRules;
    }

    /**
     * Checks if the given script text is included in our prebuilt local scripts.
     *
     * This helper method is primarily for transparency during the Chrome Web Store review process.
     *
     * @param scriptText The script rule to verify.
     *
     * @returns True if the script is part of our local collection, false otherwise.
     */
    public isLocalScript(scriptText: string): boolean {
        if (this.localScripts === undefined) {
            return false;
        }

        return this.localScripts[scriptText] !== undefined;
    }

    /**
     * Checks if the given scriptlet rule is included in our prebuilt local scriptlets.
     *
     * This helper method is primarily for transparency during the Chrome Web Store review process.
     *
     * @param scriptletRuleText The scriptlet rule to verify.
     *
     * @returns True if the scriptlet rule is part of our local collection, false otherwise.
     */
    public isLocalScriptlet(scriptletRuleText: string): boolean {
        if (this.localScriptlets === undefined) {
            return false;
        }

        return this.localScriptlets[scriptletRuleText] !== undefined;
    }

    /**
     * Retrieves the function associated with the specified script text
     * from our local scripts collection.
     *
     * @param scriptText The script content to look up.
     * @returns The corresponding function if found, or null otherwise.
     */
    getLocalScriptFunction(scriptText: string): LocalScriptFunction | null {
        if (this.localScripts === undefined) {
            return null;
        }

        const scriptFunc = this.localScripts[scriptText];
        return scriptFunc !== undefined ? scriptFunc : null;
    }
}

export const localScriptRulesService = new LocalScriptRulesService();
