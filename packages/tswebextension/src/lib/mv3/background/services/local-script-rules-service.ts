/**
 * A function type representing local script logic.
 */
export type LocalScriptFunction = () => void;

/**
 * An object containing local script functions where:
 * - key — script text
 * - value — function that is ready to run.
 */
export type LocalScriptFunctionData = {
    [key: string]: LocalScriptFunction;
};

/**
 * Search for 'JS_RULES_EXECUTION' to find all parts of script execution
 * process in the extension.
 *
 * 1. We collect and bundle all scripts that can be executed on web pages into
 *    the extension package into so-called `localScriptRules`.
 * 2. Rules that control when and where these scripts can be executed are also
 *    bundled within the extension package inside ruleset files.
 * 3. The rules look like: `example.org#%#scripttext`. Whenever the rule is
 *    matched, we check if there's a function for `scripttext` in
 *    `localScriptRules`, retrieve it from there and execute it.
 */
export class LocalScriptRulesService {
    /**
     * When {@link setLocalScriptRules} is called, this holds a list of prebuilt JS rules
     * allowed to run. If it is never called, this remains undefined.
     */
    private localScripts: LocalScriptFunctionData | undefined;

    /**
     * Stores prebuilt JS rules in memory for later use.
     *
     * @param localScriptRules A map of script text to their corresponding functions.
     */
    public setLocalScriptRules(localScriptRules: LocalScriptFunctionData): void {
        this.localScripts = localScriptRules;
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
     * Retrieves the function associated with the specified script text
     * from our local scripts collection.
     *
     * @param scriptText The script content to look up.
     *
     * @returns The corresponding function if found, or null otherwise.
     */
    public getLocalScriptFunction(scriptText: string): LocalScriptFunction | null {
        if (this.localScripts === undefined) {
            return null;
        }

        const scriptFunc = this.localScripts[scriptText];
        return scriptFunc !== undefined ? scriptFunc : null;
    }
}

export const localScriptRulesService = new LocalScriptRulesService();
