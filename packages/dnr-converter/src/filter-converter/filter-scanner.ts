import { FilterListParser, type ParserOptions } from '@adguard/agtree/parser';

import { MaxScannedRulesError } from '../errors/limitation-errors';
import { NetworkRule } from '../network-rule';

import { type Filter } from './types';

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
export class FilterScanner {
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
     * Retrieves the entire contents of the filter, extracts only the network rules
     * (ignore cosmetic and host rules) and tries to convert each line into {@link NetworkRule}.
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
    public static getNetworkRules(
        filter: Filter,
        filterFn?: (r: NetworkRule) => boolean,
        maxNumberOfScannedNetworkRules?: number,
    ): ScannedRulesWithErrors {
        const { id, content } = filter;

        // Parse filter content into AST
        const ast = FilterListParser.parse(content, FilterScanner.PARSER_OPTIONS);

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
             * @see {@link FilterScanner.PARSER_OPTIONS}
             */
            const node = ast.children[i];
            const index = node.start!;
            const raw = node.raws!.text!;

            if (node.type === 'InvalidRule') {
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
}
