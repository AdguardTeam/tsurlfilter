declare namespace chrome.scripting {
    export function executeScript<Args extends unknown[], Result>(
        // Extend ScriptInjection by { injectImmediately: boolean }
        injection: ScriptInjection<Args, Result> & { injectImmediately: boolean }
    ): Promise<InjectionResult<Awaited<Result>>[]>;
}

declare namespace chrome.declarativeNetRequest {
    /**
     * Returns the list of static rules in the given {@link Ruleset} that are
     * currently disabled.
     *
     * @param options Specifies the ruleset to query.
     *
     * Available since Chrome 111.
     *
     * @returns The list of static rules in the given {@link Ruleset} that are
     * currently disabled.
     */
    export function getDisabledRuleIds(
        options: GetDisabledRuleIdsOptions,
    ): Promise<number[]>;

    export interface GetDisabledRuleIdsOptions {
        /**
         * The id corresponding to a static {@link Ruleset}.
         */
        rulesetId: string;
    }

    /**
     * Disables and enables individual static rules in a {@link Ruleset}.
     * NOTE: changes to rules belonging to a disabled {@link Ruleset} will take
     * effect the next time that it becomes enabled.
     *
     * @param options Specifies the list of rulesets and rules ids.
     *
     * @returns Promise with void.
     */
    export function updateStaticRules(
        options: UpdateStaticRulesOptions,
    ): Promise<void>;

    export interface UpdateStaticRulesOptions {
        /**
         * The id corresponding to a static {@link Ruleset}.
         */
        rulesetId: string;

        /**
         * Set of ids corresponding to rules in the {@link Ruleset} to disable.
         */
        disableRuleIds?: number[];

        /**
         * Set of ids corresponding to rules in the {@link Ruleset} to enable.
         */
        enableRuleIds?: number[];
    }
}
