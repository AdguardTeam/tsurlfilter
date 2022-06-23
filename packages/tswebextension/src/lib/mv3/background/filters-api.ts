import { Configuration } from '../../common';

const RULESET_PREFIX = 'ruleset_';

type Filters = Configuration['filters'];
type FiltersOfTwoTypes = {
    declarativeFilters: Filters,
    customFilters: Filters,
};

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
            enableRulesetIds: enableFiltersIds?.map((filterId) => `${RULESET_PREFIX}${filterId}`) || [],
            disableRulesetIds: disableFiltersIds?.map((filterId) => `${RULESET_PREFIX}${filterId}`) || [],
        });
    }

    /**
     * Gets current enabled filters IDs
     */
    static async getEnabledRulesets(): Promise<number[]> {
        const rulesets = await chrome.declarativeNetRequest.getEnabledRulesets();
        return rulesets.map((f) => Number.parseInt(f.slice(RULESET_PREFIX.length), 10));
    }

    /**
     * Separate array of filters to two groups: declarative and custom
     * @param filters filters with id and content
     * @returns object with two fields: declarative and custom
     */
    static separateRulesets(filters: Filters): FiltersOfTwoTypes {
        const res = {
            declarativeFilters: [],
            customFilters: [],
        } as FiltersOfTwoTypes;

        const manifest = chrome.runtime.getManifest();
        const onlyDeclarativeIds = manifest.declarative_net_request.rule_resources
            .map((r: chrome.declarativeNetRequest.Ruleset) => Number.parseInt(r.id.slice(RULESET_PREFIX.length), 10));

        filters.forEach((f) => {
            if (onlyDeclarativeIds.includes(f.filterId)) {
                res.declarativeFilters.push(f);
            } else {
                res.customFilters.push(f);
            }
        });

        return res;
    }
}
