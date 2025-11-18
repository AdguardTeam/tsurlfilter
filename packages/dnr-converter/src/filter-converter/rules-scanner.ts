import { RuleCategory } from '@adguard/agtree';
import { FilterListParser, type ParserOptions } from '@adguard/agtree/parser';

import { MaxScannedRulesError } from '../errors/limitation-errors';
import { NetworkRule, NetworkRuleOption } from '../network-rule';

import { type Filter } from './types';

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
 * Interface that represents scanned rules with errors.
 */
export interface ScannedRulesWithErrors {
    /**
     * List of scanned {@link NetworkRule}.
     */
    rules: NetworkRule[];

    /**
     * List of errors occurred during the scan.
     */
    errors: Error[];
}

/**
 * Class that responsible for scanning filter rules and converting them into {@link NetworkRule}.
 */
export class RulesScanner {
    /**
     * Parser options for filter scanning.
     */
    private static readonly PARSER_OPTIONS: ParserOptions = {
        // We don't want parser to throw errors, so we can collect them all in the result object
        tolerant: true,
        // Location info is needed for source mapping
        isLocIncluded: true,
        // All syntaxes (abp, ubo) should be parsed
        parseAbpSpecificRules: true,
        parseUboSpecificRules: true,
        // Raw text is needed for error reporting
        includeRaws: true,
        // We don't need to process comments
        ignoreComments: true,
        // We only need to process network rules
        parseHostRules: false,
    };

    /**
     * Scans the list of filters for network rules.
     *
     * @param filters List of {@link Filter}.
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
    public static scanFilters(
        filters: Filter[],
        filterFn?: (r: NetworkRule) => boolean,
        maxNumberOfScannedNetworkRules?: number,
    ): ScannedFiltersWithErrors {
        const result: ScannedFiltersWithErrors = {
            errors: [],
            filters: [],
        };

        for (let i = 0; i < filters.length; i += 1) {
            const filter = filters[i];

            const { errors, rules } = RulesScanner.scanRules(
                filter,
                filterFn,
                maxNumberOfScannedNetworkRules,
            );
            const badFilterRules = rules.filter(RulesScanner.isBadFilterRule);

            result.errors = result.errors.concat(errors);
            result.filters.push({
                id: filter.id,
                rules,
                badFilterRules,
            });
        }

        return result;
    }

    /**
     * Extracts only the network rules (ignore cosmetic and host rules)
     * and tries to convert each line into {@link NetworkRule}.
     *
     * @param filter From which filter the rules should be scanned.
     * @param filterFn If this function is specified, it will be applied to each
     * rule after it has been parsed and transformed. This function is needed
     * for example to apply `$badfilter`: to exclude negated rules from the array
     * of rules that will be returned.
     * @param maxNumberOfScannedNetworkRules Maximum number of network rules to
     * scan, all other rules will be ignored and an error {@link MaxScannedRulesError}
     * will be added to the list of result errors.
     *
     * @returns Result object of {@link ScannedRulesWithErrors}.
     */
    private static scanRules(
        filter: Filter,
        filterFn?: (r: NetworkRule) => boolean,
        maxNumberOfScannedNetworkRules?: number,
    ): ScannedRulesWithErrors {
        const { id, content } = filter;

        // Parse filter content into AST
        const ast = FilterListParser.parse(content, RulesScanner.PARSER_OPTIONS);

        // Build result object
        let curNumberOfScannedNetworkRules = 0;
        const result: ScannedRulesWithErrors = {
            errors: [],
            rules: [],
        };

        for (let i = 0; i < ast.children.length; i += 1) {
            /**
             * We use `!` because location info and raw rule is always included in our parser options.
             *
             * @see {@link RulesScanner.PARSER_OPTIONS}
             */
            const node = ast.children[i];
            const index = node.start!;
            const raw = node.raws!.text!;

            if (node.category === RuleCategory.Invalid) {
                const { name, message } = node.error;
                const msg = `[${name}] ${message}: filter id - ${id}, line index - ${index}, line - ${raw}`;
                result.errors.push(new Error(msg));
                continue;
            }

            try {
                const networkRules = NetworkRule.parseFromNode(id, index, node);

                const filteredRules = filterFn
                    ? networkRules.filter(filterFn)
                    : networkRules;

                result.rules.push(...filteredRules);

                curNumberOfScannedNetworkRules += filteredRules.length;

                if (
                    maxNumberOfScannedNetworkRules !== undefined
                    && curNumberOfScannedNetworkRules >= maxNumberOfScannedNetworkRules
                ) {
                    const lastRuleLineIndex = networkRules[networkRules.length - 1].getIndex();
                    // This error needed for future improvements, for example
                    // to show in the UI which rules were skipped.
                    const msg = `Maximum number of scanned network rules reached at line index ${lastRuleLineIndex}.`;
                    result.errors.push(new MaxScannedRulesError(msg, lastRuleLineIndex));
                    break;
                }
            } catch (e) {
                if (e instanceof Error) {
                    result.errors.push(e);
                } else {
                    // eslint-disable-next-line max-len
                    const msg = `Unknown error during creating network rule from raw string: filter id - ${id}, line index - ${index}, line - ${raw}`;
                    result.errors.push(new Error(msg));
                }
                continue;
            }
        }

        return result;
    }

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
}
