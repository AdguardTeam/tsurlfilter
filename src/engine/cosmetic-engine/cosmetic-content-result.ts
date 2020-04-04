import { CosmeticRule } from '../../rules/cosmetic-rule';

export interface CosmeticContentResult {
    /**
     * Append rule to result
     * @param rule
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
