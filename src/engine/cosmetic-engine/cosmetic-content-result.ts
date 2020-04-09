import { CosmeticRule } from '../../rules/cosmetic-rule';

/**
 * Cosmetic results interface
 */
export interface CosmeticContentResult {
    /**
     * Append rule to result
     * @param rule to add
     */
    append(rule: CosmeticRule): void;

    /**
     * Collection of generic (domain insensitive) rules
     */
    generic: CosmeticRule[];

    /**
     * Collection of domain specific rules
     */
    specific: CosmeticRule[];
}
