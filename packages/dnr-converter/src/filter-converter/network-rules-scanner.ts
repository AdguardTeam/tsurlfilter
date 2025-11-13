import { type IFilter } from '../filter';
import { type NetworkRule, NetworkRuleOption } from '../network-rule';

import { FilterScanner } from './filter-scanner';

/**
 * Interface that represents a scanned filter.
 */
export interface ScannedFilter {
    /**
     * The filter ID.
     */
    id: number;

    /**
     * List of scanned network rules.
     */
    rules: NetworkRule[];

    /**
     * List of scanned network rules with `$badfilter` option.
     */
    badFilterRules: NetworkRule[];
}

/**
 * Interface that represents result of scanning a list of filters.
 */
export interface ScannedFiltersWithErrors {
    /**
     * List of errors occurred during the scan.
     */
    errors: Error[];

    /**
     * List of scanned filters.
     */
    filters: ScannedFilter[];
}

/**
 * Utility class to scan {@link NetworkRule} from a list of {@link IFilter}.
 */
export class NetworkRulesScanner {
    /**
     * Checks whether the given rule is a bad filter rule.
     *
     * @param rule {@link NetworkRule} to check.
     *
     * @returns `true` if the rule is a bad filter rule, `false` otherwise.
     */
    private static isBadFilterRule(rule: NetworkRule): boolean {
        return rule.isOptionEnabled(NetworkRuleOption.Badfilter);
    }

    /**
     * Asynchronously scans the list of filters for network rules.
     *
     * @param filters List of {@link IFilter}.
     * @param filterFn If this function is specified, it will be applied to each
     * rule after it has been parsed and transformed. This function is needed
     * for example to apply `$badfilter`: to exclude negated rules from the array
     * of rules that will be returned.
     * @param maxNumberOfScannedNetworkRules Maximum number of network rules to
     * scan, all other rules will be ignored. It will be applied to each filter
     * separately, not for cumulative scope of rules from all filters, because
     * it looks simpler and more predictable solution to prevent too long scan.
     *
     * @returns Result object of {@link ScannedFiltersWithErrors}.
     */
    public static async scanRules(
        filters: IFilter[],
        filterFn?: (r: NetworkRule) => boolean,
        maxNumberOfScannedNetworkRules?: number,
    ): Promise<ScannedFiltersWithErrors> {
        const result: ScannedFiltersWithErrors = {
            errors: [],
            filters: [],
        };

        const promises = filters.map(async (filter): Promise<ScannedFilter> => {
            const scanner = await FilterScanner.createNew(filter);

            const { errors, rules } = scanner.getNetworkRules(filterFn, maxNumberOfScannedNetworkRules);
            const badFilterRules = rules.filter(NetworkRulesScanner.isBadFilterRule);

            result.errors = result.errors.concat(errors);

            return {
                id: filter.getId(),
                rules,
                badFilterRules,
            };
        });

        const tasks = await Promise.allSettled(promises);
        for (let i = 0; i < tasks.length; i += 1) {
            const task = tasks[i];
            if (task.status === 'rejected') {
                result.errors.push(new Error(`Cannot scan rules from filter ${filters[i].getId()}: ${task.reason}`));
            } else {
                result.filters.push(task.value);
            }
        }

        return result;
    }
}
