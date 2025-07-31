import { InputByteBuffer } from '@adguard/agtree';

import { type PreprocessedFilterList } from '../../filterlist/preprocessor';
import { BufferReader } from '../../filterlist/reader/buffer-reader';
import { getRuleSourceIndex, getRuleSourceText } from '../../filterlist/source-map';

import { IndexedNetworkRuleWithHash } from './network-indexed-rule-with-hash';
import { type IFilter } from './filter';
import { MaxScannedRulesError } from './errors/limitation-errors';

/**
 * IFilterScanner describes a method that should return indexed network rules
 * with theirs hashes.
 */
interface IFilterScanner {
    getIndexedRules(): ScannedRulesWithErrors;
}

/**
 * Contains scanned indexed rules with theirs hashes and list of errors.
 */
type ScannedRulesWithErrors = {
    rules: IndexedNetworkRuleWithHash[];
    errors: Error[];
};

/**
 * FilterScanner returns indexed, only network rules from IFilter's content.
 */
export class FilterScanner implements IFilterScanner {
    private readonly filter: PreprocessedFilterList;

    private readonly filterId: number;

    /**
     * Constructor of FilterScanner.
     *
     * @param filter From which filter the rules should be scanned.
     * @param filterId Id of filter.
     */
    constructor(filter: PreprocessedFilterList, filterId: number) {
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
     * Gets the entire contents of the filter, extracts only the network rules
     * (ignore cosmetic and host rules) and tries to convert each line into an
     * indexed rule with hash.
     *
     * @param filterFn If this function is specified, it will be applied to each
     * rule after it has been parsed and transformed. This function is needed
     * for example to apply $badfilter: to exclude negated rules from the array
     * of rules that will be returned.
     * @param maxNumberOfScannedNetworkRules Maximum number of network rules to
     * scan, all other rules will be ignored and an error {@link MaxScannedRulesError}
     * will be added to the list of result errors.
     *
     * @returns List of indexed rules with hash. If filterFn was specified then
     * out values will be filtered with this function.
     */
    public getIndexedRules(
        filterFn?: (r: IndexedNetworkRuleWithHash) => boolean,
        maxNumberOfScannedNetworkRules?: number,
    ): ScannedRulesWithErrors {
        const { filterList } = this.filter;

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
            let indexedNetworkRulesWithHash: IndexedNetworkRuleWithHash[] = [];

            try {
                indexedNetworkRulesWithHash = IndexedNetworkRuleWithHash.createFromNode(
                    this.filterId,
                    ruleBufferIndex,
                    ruleNode,
                );
            } catch (e) {
                if (e instanceof Error) {
                    result.errors.push(e);
                } else {
                    const lineIndex = getRuleSourceIndex(ruleBufferIndex, this.filter.sourceMap);
                    const rawRule = getRuleSourceText(lineIndex, this.filter.rawFilterList);
                    const originalRawRule = this.filter.conversionMap[lineIndex];
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
                ? indexedNetworkRulesWithHash.filter(filterFn)
                : indexedNetworkRulesWithHash;

            result.rules.push(...filteredRules);

            curNumberOfScannedNetworkRules += filteredRules.length;

            if (maxNumberOfScannedNetworkRules !== undefined
                && curNumberOfScannedNetworkRules >= maxNumberOfScannedNetworkRules) {
                const lastScannedRule = indexedNetworkRulesWithHash[indexedNetworkRulesWithHash.length - 1];
                const lineIndex = getRuleSourceIndex(lastScannedRule.index, this.filter.sourceMap);
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
