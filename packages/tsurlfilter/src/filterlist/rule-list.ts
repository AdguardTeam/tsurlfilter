import { RuleScanner } from './scanner/rule-scanner';
import { ScannerType } from './scanner/scanner-type';

/**
 * List identifier max value.
 * We use "number" type for storage indexes, so we have some limits for list
 * identifiers.
 * We use line number for rule index, so if we save 11 ranks for rules, then we
 * have 6 ranks left for list ids. Check RuleStorageScanner class for more info.
 */
export const LIST_ID_MAX_VALUE = 10 ** 6;

/**
 * RuleList represents a set of filtering rules.
 */
export interface IRuleList {
    /**
     * Returns the rule list identifier.
     */
    getId(): number;

    /**
     * Creates a new scanner that reads the list contents.
     */
    newScanner(scannerType: ScannerType): RuleScanner;

    /**
     * Retrieves rule text by its index.
     *
     * @param ruleIdx - Rule index in the storage.
     */
    retrieveRuleText(ruleIdx: number): string | null;

    /**
     * Closes the rules list.
     */
    close(): void;
}
