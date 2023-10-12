import { Filter, IFilter } from '@adguard/tsurlfilter/es/declarative-converter';

import { FailedEnableRuleSetsError } from '../errors/failed-enable-rule-sets-error';
import { getFilterName } from '../utils/get-filter-name';

import { ConfigurationMV3 } from './configuration';

export const RULE_SET_NAME_PREFIX = 'ruleset_';

export type UpdateStaticFiltersResult = {
    errors: FailedEnableRuleSetsError[],
};

/**
 * FiltersApi knows how to enable or disable static rule sets (which were built
 * with the extension) and how to create {@link Filter} through
 * loading its contents.
 */
export default class FiltersApi {
    /**
     * Enables or disables the provided rule set identifiers.
     *
     * @param disableFiltersIds Rule sets to disable.
     * @param enableFiltersIds Rule sets to enable.
     *
     * @returns Promise resolved with result of updating {@link UpdateStaticFiltersResult}.
     */
    static async updateFiltering(
        disableFiltersIds: number[],
        enableFiltersIds?: number[],
    ): Promise<UpdateStaticFiltersResult> {
        const res: UpdateStaticFiltersResult = {
            errors: [],
        };

        const enableRulesetIds = enableFiltersIds?.map((filterId) => `${RULE_SET_NAME_PREFIX}${filterId}`) || [];
        const disableRulesetIds = disableFiltersIds?.map((filterId) => `${RULE_SET_NAME_PREFIX}${filterId}`) || [];

        try {
            await chrome.declarativeNetRequest.updateEnabledRulesets({
                enableRulesetIds,
                disableRulesetIds,
            });
        } catch (e) {
            const msg = 'Cannot change list of enabled rule sets';
            const err = new FailedEnableRuleSetsError(
                msg,
                enableRulesetIds,
                disableRulesetIds,
                e as Error,
            );
            res.errors.push(err);
        }

        return res;
    }

    /**
     * Returns current enabled rule sets IDs.
     *
     * @returns List of extracted enabled rule sets ids.
     */
    public static async getEnabledRuleSets(): Promise<number[]> {
        const ruleSets = await chrome.declarativeNetRequest.getEnabledRulesets();
        return ruleSets.map((f) => Number.parseInt(f.slice(RULE_SET_NAME_PREFIX.length), 10));
    }

    /**
     * Loads filters content from provided filtersPath (which has been extracted
     * from field 'filtersPath' of the {@link Configuration}).
     *
     * @param id Filter id.
     * @param filtersPath Path to filters directory.
     *
     * @returns Promise resolved file content as a list of strings.
     */
    private static async loadFilterContent(id: number, filtersPath: string): Promise<string[]> {
        const filterName = getFilterName(id);
        const url = chrome.runtime.getURL(`${filtersPath}/${filterName}`);
        const file = await fetch(url);
        const content = await file.text();

        return content.split(/\r?\n/);
    }

    /**
     * Loads content for provided filters ids;.
     *
     * @param filtersIds List of filters ids.
     * @param filtersPath Path to filters directory.
     *
     * @returns List of {@link IFilter} with a lazy content loading feature.
     */
    static createStaticFilters(
        filtersIds: ConfigurationMV3['staticFiltersIds'],
        filtersPath: string,
    ): IFilter[] {
        return filtersIds.map((filterId) => new Filter(filterId, {
            getContent: () => this.loadFilterContent(filterId, filtersPath),
        }));
    }

    /**
     * Wraps custom filter into {@link IFilter}.
     *
     * @param customFilters List of custom filters.
     *
     * @returns List of {@link IFilter} with a lazy content loading feature.
     */
    static createCustomFilters(customFilters: ConfigurationMV3['customFilters']): IFilter[] {
        return customFilters.map((f) => new Filter(f.filterId, {
            getContent: () => Promise.resolve(f.content.split('\n')),
        }));
    }
}
