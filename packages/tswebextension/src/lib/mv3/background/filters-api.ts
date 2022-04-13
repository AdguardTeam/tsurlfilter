export default class FiltersApi {
    /**
     * Updates filtering rulesets via declarativeNetRequest
     * @param enableFiltersIds rulesets to enable
     * @param disableFiltersIds rulesets to diable
     */
    static async updateFiltering(
        disableFiltersIds: number[],
        enableFiltersIds?: number[],
    ): Promise<void> {
        await chrome.declarativeNetRequest.updateEnabledRulesets({
            enableRulesetIds: enableFiltersIds?.map((filterId) => `ruleset_${filterId}`) || [],
            disableRulesetIds: disableFiltersIds?.map((filterId) => `ruleset_${filterId}`) || [],
        });
    }

    /**
     * Gets current enabled filters IDs
     */
    static async getEnabledRulesets(): Promise<number[]> {
        const rulesets = await chrome.declarativeNetRequest.getEnabledRulesets();
        return rulesets.map((f) => Number.parseInt(f.slice('ruleset_'.length), 10));
    }
}
