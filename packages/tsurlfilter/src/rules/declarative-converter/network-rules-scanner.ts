import { NetworkRuleOption } from '../network-rule';

import type { IFilter } from './filter';
import type { IndexedNetworkRuleWithHash } from './network-indexed-rule-with-hash';
import { FilterScanner } from './filter-scanner';

/**
 * This is an intermediate type required for conversion from filter to ruleset.
 *
 * Contains scanned indexed rules with theirs hashes: regular rules separately,
 * rules with `$badfilter` separately.
 */
export type ScannedFilter = {
    id: number;
    rules: IndexedNetworkRuleWithHash[];
    badFilterRules: IndexedNetworkRuleWithHash[];
};

/**
 * The result of scanning a list of filters includes the scanned filters and
 * any errors that may occur during the scan.
 */
type ScannedFiltersWithErrors = {
    errors: Error[];
    filters: ScannedFilter[];
};

/**
 * Scanner for network rules from list of filters.
 */
export class NetworkRulesScanner {
    /**
     * Asynchronous scans the list of filters for network rules.
     *
     * @param filterList List of {@link IFilter}.
     * @param filterFn If this function is specified, it will be applied to each
     * rule after it has been parsed and transformed. This function is needed
     * for example to apply $badfilter: to exclude negated rules from the array
     * of rules that will be returned.
     * @param maxNumberOfScannedNetworkRules Maximum number of network rules to
     * scan, all other rules will be ignored. It will be applied to each filter
     * separately, not for cumulative scope of rules from all filters, because
     * it looks simpler and more predictable solution to prevent too long scan.
     *
     * @returns List of filters includes the scanned filters and any errors that
     * may occur during the scan.
     */
    public static async scanRules(
        filterList: IFilter[],
        filterFn?: (r: IndexedNetworkRuleWithHash) => boolean,
        maxNumberOfScannedNetworkRules?: number,
    ): Promise<ScannedFiltersWithErrors> {
        const res: ScannedFiltersWithErrors = {
            errors: [],
            filters: [],
        };

        const promises = filterList.map(async (filter): Promise<ScannedFilter> => {
            const scanner = await FilterScanner.createNew(filter);
            const { errors, rules } = scanner.getIndexedRules(filterFn, maxNumberOfScannedNetworkRules);

            res.errors = res.errors.concat(errors);

            const badFilterRules = rules.filter(({ rule }) => {
                return rule.rule.isOptionEnabled(NetworkRuleOption.Badfilter);
            });

            return {
                id: filter.getId(),
                rules,
                badFilterRules,
            };
        });

        const tasks = await Promise.allSettled(promises);

        tasks.forEach((task, index) => {
            if (task.status === 'rejected') {
                const filterId = filterList[index].getId();
                res.errors.push(new Error(`Cannot scan rules from filter ${filterId}: ${task.reason}`));
                return;
            }

            res.filters.push(task.value);
        });

        return res;
    }
}
