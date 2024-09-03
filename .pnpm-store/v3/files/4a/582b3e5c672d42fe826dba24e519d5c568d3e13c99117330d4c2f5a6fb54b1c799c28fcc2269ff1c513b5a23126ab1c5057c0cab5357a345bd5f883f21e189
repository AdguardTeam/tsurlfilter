import { IndexedNetworkRuleWithHash } from './network-indexed-rule-with-hash';
import { IFilter } from './filter';

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
    rules: IndexedNetworkRuleWithHash[],
    errors: Error[],
};

/**
 * FilterScanner returns indexed, only network rules from IFilter's content.
 */
export class FilterScanner implements IFilterScanner {
    // Filter's content
    private readonly filterContent: string[];

    // Filter's id
    private readonly filterId: number;

    /**
     * Constructor of FilterScanner.
     *
     * @param filterContent Filter rules.
     * @param filterId Filter id.
     */
    constructor(filterContent: string[], filterId: number) {
        this.filterContent = filterContent;
        this.filterId = filterId;
    }

    /**
     * Creates new filter scanner.
     *
     * @param filter From which filter the rules should be scanned.
     *
     * @returns New FilterScanner.
     */
    static async createNew(filter: IFilter): Promise<FilterScanner> {
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
     *
     * @returns List of indexed rules with hash. If filterFn was specified then
     * out values will be filtered with this function.
     */
    public getIndexedRules(
        filterFn?: (r: IndexedNetworkRuleWithHash) => boolean,
    ): ScannedRulesWithErrors {
        const { filterContent, filterId } = this;

        const result: ScannedRulesWithErrors = {
            errors: [],
            rules: [],
        };

        for (let lineIndex = 0; lineIndex < filterContent.length; lineIndex += 1) {
            const line = filterContent[lineIndex];
            if (!line) {
                continue;
            }

            let indexedNetworkRulesWithHash: IndexedNetworkRuleWithHash[] = [];

            try {
                indexedNetworkRulesWithHash = IndexedNetworkRuleWithHash.createFromRawString(
                    filterId,
                    lineIndex,
                    line,
                );
            } catch (e) {
                if (e instanceof Error) {
                    result.errors.push(e);
                } else {
                    // eslint-disable-next-line max-len
                    const err = new Error(`Unknown error during creating indexed rule with hash from raw string: filter id - ${filterId}, line index - ${lineIndex}, line - ${line}`);
                    result.errors.push(err);
                }
                continue;
            }

            const filteredRules = filterFn
                ? indexedNetworkRulesWithHash.filter(filterFn)
                : indexedNetworkRulesWithHash;

            result.rules.push(...filteredRules);
        }

        return result;
    }
}
