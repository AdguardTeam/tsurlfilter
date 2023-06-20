import { IndexedRule } from '../rule';
import { RuleConverter } from '../rule-converter';
import { RuleFactory } from '../rule-factory';

import { IFilter } from './filter';

/**
 * IFilterScanner describes a method that should return indexed rules.
 */
interface IFilterScanner {
    getIndexedRules(): ScannedRulesWithErrors;
}

export type ScannedRulesWithErrors = {
    errors: Error[],
    rules: IndexedRule[],
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
     * Gets the entire contents of the filter,
     * extracts only the network rules (ignore cosmetic and host rules)
     * and tries to convert each line into an indexed rule.
     *
     * @returns List of indexed rules.
     */
    public getIndexedRules(): ScannedRulesWithErrors {
        const { filterContent, filterId } = this;

        const errors: Error[] = [];
        const rules: IndexedRule[] = [];

        for (let lineIndex = 0; lineIndex < filterContent.length; lineIndex += 1) {
            const line = filterContent[lineIndex];
            if (!line) {
                continue;
            }

            let rulesConvertedToAGSyntax: string[] = [];

            // Try to convert to AG syntax.
            try {
                rulesConvertedToAGSyntax = RuleConverter.convertRule(line);
            } catch (e: unknown) {
                errors.push(e as Error);

                // Skip this line because it does not convert to AG syntax.
                continue;
            }

            // Now convert to IRule and then IndexedRule.
            for (let rulesIndex = 0; rulesIndex < rulesConvertedToAGSyntax.length; rulesIndex += 1) {
                const ruleConvertedToAGSyntax = rulesConvertedToAGSyntax[rulesIndex];

                try {
                    // Create IndexedRule from AG rule
                    const rule = RuleFactory.createRule(
                        ruleConvertedToAGSyntax,
                        filterId,
                        false,
                        true, // ignore cosmetic rules
                        true, // ignore host rules
                        false, // throw exception on creating rule error.
                    );

                    // If rule is not empty - pack to IndexedRule
                    // and add it to the result array.
                    const indexedRule = rule
                        ? new IndexedRule(rule, lineIndex)
                        : null;
                    if (indexedRule) {
                        rules.push(indexedRule);
                    }
                } catch (e: unknown) {
                    errors.push(e as Error);
                }
            }
        }

        return {
            errors,
            rules,
        };
    }
}
