import { IndexedRule } from '../rule';
import { RuleFactory } from '../rule-factory';

import { IFilter } from './filter';

/**
 * IFilterScanner describes a method that should return indexed rules.
 */
interface IFilterScanner {
    getIndexedRules(): IndexedRule[];
}

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
     * Gets the entire contents of the filter,
     * extracts only the network rules (ignore cosmetic and host rules)
     * and tries to convert each line into an indexed rule.
     *
     * @returns List of indexed rules.
     */
    public getIndexedRules(): IndexedRule[] {
        const lines = this.filterContent;
        const { filterId } = this;

        const indexedRules = lines
            .map((line, idx): IndexedRule | null => {
                if (!line) {
                    return null;
                }

                // TODO: Add error capture
                const rule = RuleFactory.createRule(
                    line,
                    filterId,
                    false,
                    true, // ignore cosmetic rules
                    true, // ignore host rules
                );

                return rule
                    ? new IndexedRule(rule, idx)
                    : null;
            })
            .filter((rule): rule is IndexedRule => rule !== null);

        return indexedRules;
    }
}
