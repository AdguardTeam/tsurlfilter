import { type FilterListParseOptions, FilterListPipeline, RuleCategory } from '@adguard/agtree';

import { MaxScannedRulesError } from '../errors/limitation-errors';
import { type IFilter } from '../filter/types';
import { OPTION_NAMES } from '../rule/option-names';
import { Rule } from '../rule/rule';

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
    rules: Rule[];

    /**
     * List of scanned network rules with `$badfilter` option.
     */
    badFilterRules: Rule[];
}

/**
 * Interface that represents result of scanning a list of filters.
 */
interface ScannedFiltersWithErrors {
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
interface ScannedRulesWithErrors {
    /**
     * List of scanned {@link Rule}.
     */
    rules: Rule[];

    /**
     * List of errors occurred during the scan.
     */
    errors: Error[];
}

/**
 * Class that responsible for scanning filter rules and converting them into {@link Rule}.
 */
export class RulesScanner {
    /**
     * Shared filter list pipeline instance reused across all scans.
     */
    private static readonly pipeline = new FilterListPipeline();

    /**
     * Parser options for filter scanning.
     */
    private static readonly PARSER_OPTIONS: FilterListParseOptions = {
        // We don't want parser to throw errors, so we can collect them all in the result object
        tolerant: true,
        // Location info is needed for source mapping
        isLocIncluded: true,
        // All syntaxes (abp, ubo) should be parsed
        parseAbpSpecificRules: true,
        parseUboSpecificRules: true,
        // We only need to process network rules
        parseHostRules: false,
    };

    /**
     * Scans the list of filters for network rules.
     *
     * @param filters List of {@link IFilter}.
     * @param filterFn If this function is specified, it will be applied to each
     * rule after it has been parsed and transformed. This function is needed
     * for example to apply `$badfilter`: to exclude negated rules from the array
     * of rules that will be returned.
     * @param maxScannedRules Maximum number of network rules to
     * scan, all other rules will be ignored. It will be applied to each filter
     * separately, not for cumulative scope of rules from all filters, because
     * it looks simpler and more predictable solution to prevent too long scan.
     *
     * @returns Result object of {@link ScannedFiltersWithErrors}.
     */
    public static async scanFilters(
        filters: IFilter[],
        filterFn?: (r: Rule) => boolean,
        maxScannedRules?: number,
    ): Promise<ScannedFiltersWithErrors> {
        const result: ScannedFiltersWithErrors = {
            errors: [],
            filters: [],
        };

        for (let i = 0; i < filters.length; i += 1) {
            const filter = filters[i];

            // eslint-disable-next-line no-await-in-loop
            const { errors, rules } = await RulesScanner.scanRules(
                filter,
                filterFn,
                maxScannedRules,
            );
            const badFilterRules = rules.filter(RulesScanner.isBadFilterRule);

            result.errors = result.errors.concat(errors);
            result.filters.push({
                id: filter.getId(),
                rules,
                badFilterRules,
            });
        }

        return result;
    }

    /**
     * Extracts only the network rules (ignore cosmetic and host rules)
     * and tries to convert each line into {@link Rule}.
     *
     * @param filter From which filter the rules should be scanned.
     * @param filterFn If this function is specified, it will be applied to each
     * rule after it has been parsed and transformed. This function is needed
     * for example to apply `$badfilter`: to exclude negated rules from the array
     * of rules that will be returned.
     * @param maxScannedRules Maximum number of network rules to
     * scan, all other rules will be ignored and an error {@link MaxScannedRulesError}
     * will be added to the list of result errors.
     *
     * @returns Result object of {@link ScannedRulesWithErrors}.
     */
    private static async scanRules(
        filter: IFilter,
        filterFn?: (r: Rule) => boolean,
        maxScannedRules?: number,
    ): Promise<ScannedRulesWithErrors> {
        const id = filter.getId();
        const content = await filter.getContent();

        // Parse filter content into AST
        const ast = RulesScanner.pipeline.parse(content, RulesScanner.PARSER_OPTIONS);

        // Build result object
        let scannedRulesCount = 0;
        const result: ScannedRulesWithErrors = {
            errors: [],
            rules: [],
        };

        for (let i = 0; i < ast.children.length; i += 1) {
            const node = ast.children[i];

            // Skip empty lines and comments — they are not convertible rules.
            if (node.category === RuleCategory.Empty || node.category === RuleCategory.Comment) {
                continue;
            }

            /**
             * We use `!` because location info is always included in our parser options.
             *
             * @see {@link RulesScanner.PARSER_OPTIONS}
             */
            const index = node.start!;
            const raw = content.slice(node.start!, node.end!);

            if (node.category === RuleCategory.Invalid) {
                const { name, message } = node.error;
                const msg = `[${name}] ${message}: filter id - ${id}, line index - ${index}, line - ${raw}`;
                result.errors.push(new Error(msg));
                continue;
            }

            try {
                const rules = Rule.parseFromNode(id, index, node);

                const filteredRules = filterFn
                    ? rules.filter(filterFn)
                    : rules;

                result.rules.push(...filteredRules);

                scannedRulesCount += filteredRules.length;

                if (
                    maxScannedRules !== undefined
                    && scannedRulesCount >= maxScannedRules
                ) {
                    const lastRuleLineIndex = rules[rules.length - 1].index;
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
     * @param rule {@link Rule} to check.
     *
     * @returns `true` if the rule is a bad filter rule, `false` otherwise.
     */
    private static isBadFilterRule(rule: Rule): boolean {
        return rule.isModifierEnabled(OPTION_NAMES.BADFILTER);
    }
}
