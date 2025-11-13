import { InputByteBuffer } from '@adguard/agtree';

import { MaxScannedRulesError } from '../errors/limitation-errors';
import { type IFilter, type PreprocessedFilterList } from '../filter';
import { NetworkRule } from '../network-rule';
import { getRuleSourceIndex, getRuleSourceText } from '../utils/source-map';

import { BufferReader } from './readers/buffer-reader';

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
     * The filter from which rules are scanned.
     */
    private readonly filter: PreprocessedFilterList;

    /**
     * The filter ID.
     */
    private readonly filterId: number;

    /**
     * Constructor.
     *
     * @param filter From which filter the rules should be scanned.
     * @param filterId The filter ID.
     */
    private constructor(filter: PreprocessedFilterList, filterId: number) {
        this.filter = filter;
        this.filterId = filterId;
    }

    /**
     * Creates new filter scanner.
     *
     * @param filter From which filter the rules should be scanned.
     *
     * @returns New FilterScanner.
     */
    public static async createNew(filter: IFilter): Promise<FilterScanner> {
        const content = await filter.getContent();
        return new FilterScanner(content, filter.getId());
    }

    /**
     * Retrieves the entire contents of the filter, extracts only the network rules
     * (ignore cosmetic and host rules) and tries to convert each line into {@link NetworkRule}.
     *
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
    public getNetworkRules(
        filterFn?: (r: NetworkRule) => boolean,
        maxNumberOfScannedNetworkRules?: number,
    ): ScannedRulesWithErrors {
        const {
            filterList,
            sourceMap,
            rawFilterList,
            conversionMap,
        } = this.filter;

        const result: ScannedRulesWithErrors = {
            errors: [],
            rules: [],
        };

        const buffer = new InputByteBuffer(filterList);
        const reader = new BufferReader(buffer);

        let ruleBufferIndex = reader.getCurrentPos();
        let ruleNode = reader.readNext();
        let curNumberOfScannedNetworkRules = 0;

        while (ruleNode) {
            let networkRules: NetworkRule[] = [];

            try {
                networkRules = NetworkRule.parseFromNode(
                    this.filterId,
                    ruleBufferIndex,
                    ruleNode,
                );
            } catch (e) {
                if (e instanceof Error) {
                    result.errors.push(e);
                } else {
                    const lineIndex = getRuleSourceIndex(ruleBufferIndex, sourceMap);
                    const rawRule = getRuleSourceText(lineIndex, rawFilterList);
                    const originalRawRule = conversionMap[lineIndex];
                    // eslint-disable-next-line max-len
                    let errorMessage = `Unknown error during creating indexed rule with hash from raw string: filter id - ${this.filterId}, line index - ${lineIndex}, line - ${rawRule}`;
                    if (originalRawRule) {
                        errorMessage += `, original line - ${originalRawRule}`;
                    }
                    const err = new Error(errorMessage);
                    result.errors.push(err);
                }
                continue;
            } finally {
                ruleBufferIndex = reader.getCurrentPos();
                ruleNode = reader.readNext();
            }

            const filteredRules = filterFn
                ? networkRules.filter(filterFn)
                : networkRules;

            result.rules.push(...filteredRules);

            curNumberOfScannedNetworkRules += filteredRules.length;

            if (
                maxNumberOfScannedNetworkRules !== undefined
                && curNumberOfScannedNetworkRules >= maxNumberOfScannedNetworkRules
            ) {
                const lastScannedRule = networkRules[networkRules.length - 1];
                const lineIndex = getRuleSourceIndex(lastScannedRule.getIndex(), sourceMap);
                // This error needed for future improvements, for example
                // to show in the UI which rules were skipped.
                const err = new MaxScannedRulesError(
                    `Maximum number of scanned network rules reached at line index ${lineIndex}.`,
                    lineIndex,
                );
                result.errors.push(err);
                break;
            }
        }

        return result;
    }
}
