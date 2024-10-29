import { type CosmeticRule } from '../../rules/cosmetic-rule';
import { type WebRequest } from '../../web-request';

/**
 * Cosmetic results interface
 */
export interface CosmeticContentResult {
    /**
     * Append rule to result
     * @param rule to add
     * @param request used to provide domain information to scriptlet rule
     */
    append(rule: CosmeticRule, request?: WebRequest): void;

    /**
     * Collection of generic (domain insensitive) rules
     */
    generic: CosmeticRule[];

    /**
     * Collection of domain specific rules
     */
    specific: CosmeticRule[];
}
