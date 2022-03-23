export default class FiltersApi {
    public static async updateFiltering(
        enableFiltersIds: number[],
        disableFiltersIds: number[],
    ): Promise<void> {
        await chrome.declarativeNetRequest.updateEnabledRulesets({
            enableRulesetIds: enableFiltersIds
                .map((filterId) => {
                    return `ruleset_${filterId}`;
                }),
            disableRulesetIds: disableFiltersIds
                .map((filterId) => {
                    return `ruleset_${filterId}`;
                }),
        });
    }
}
