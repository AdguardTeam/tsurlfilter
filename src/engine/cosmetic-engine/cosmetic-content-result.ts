import { CosmeticRule } from '../../rules/cosmetic-rule';

export interface CosmeticContentResult {
    /**
     * Append rule to result
     * @param rule
     */
    append(rule: CosmeticRule): void;

    /**
     * Returns collected rules
     */
    getRules(): CosmeticRule[];
}
