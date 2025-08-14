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
 * Due to Chrome Web Store policies, we cannot execute remotely hosted code.
 * Therefore, we use the following approach:
 *
 * 1. We bundle AdGuard’s script rules into a local file included with the extension.
 * 2. At runtime, we verify each script rule to see if it's included in our local bundle.
 *    If it is, we allow it to run; otherwise, we discard it.
 *
 * The whole process is explained below.
 *
 * To fully comply with Chrome Web Store policies regarding remote code execution,
 * we implement a strict security-focused approach for Scriptlet and JavaScript rules execution.
 *
 * 1. Default - regular users that did not grant User scripts API permission explicitly:
 *    - We collect and pre-build script rules from the filters and statically bundle
 *      them into the extension - STEP 1. See 'updateLocalResourcesForChromiumMv3' in our build tools.
 *      IMPORTANT: all scripts and their arguments are local and bundled within the extension.
 *    - These pre-verified local scripts are passed to the engine - STEP 2.
 *    - At runtime before the execution, we check if each script rule is included
 *      in our local scripts list (STEP 3).
 *    - Only pre-verified local scripts are executed via chrome.scripting API (STEP 4.1 and 4.2).
 *      All other scripts are discarded.
 *    - Custom filters are NOT allowed for regular users to prevent any possibility
 *      of remote code execution, regardless of rule interpretation.
 *
 * 2. For advanced users that explicitly granted User scripts API permission -
 *    via enabling the Developer mode or Allow user scripts in the extension details:
 *    - Custom filters are allowed and may contain Scriptlet and JS rules
 *      that can be executed using the browser's built-in userScripts API (STEP 4.3),
 *      which provides a secure sandbox.
 *    - This execution bypasses the local script verification process but remains
 *      isolated and secure through Chrome's native sandboxing.
 *    - This mode requires explicit user activation and is intended for advanced users only.
 *
 * IMPORTANT:
 * Custom filters are ONLY supported when User scripts API permission is explicitly enabled.
 * This strict policy prevents Chrome Web Store rejection due to potential remote script execution.
 * When custom filters are allowed, they may contain:
 * 1. Network rules – converted to DNR rules and applied via dynamic rules.
 * 2. Cosmetic rules – interpreted directly in the extension code.
 * 3. Scriptlet and JS rules – executed via the browser's userScripts API (userScripts.execute)
 *    with Chrome's native sandboxing providing security isolation.
 *
 * For regular users without User scripts API permission (default case):
 * - Only pre-bundled filters with statically verified scripts are supported.
 * - Downloading custom filters or any rules from remote sources is blocked entirely
 *   to ensure compliance with the store policies.
 *
 * This implementation ensures perfect compliance with Chrome Web Store policies
 * by preventing any possibility of remote code execution for regular users.
 *
 * It is possible to follow all places using this logic by searching JS_RULES_EXECUTION.
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
