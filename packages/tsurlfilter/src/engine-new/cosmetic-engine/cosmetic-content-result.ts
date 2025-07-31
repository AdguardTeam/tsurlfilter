import { type Request } from '../../request';
import { type CosmeticRule } from '../../rules/cosmetic-rule';

/**
 * Cosmetic results interface.
 */
export interface CosmeticContentResult {
    /**
     * Append rule to result.
     *
     * @param rule Rules to add.
     * @param request Used to provide domain information to scriptlet rule.
     */
    append(rule: CosmeticRule, request?: Request): void;

    /**
     * Collection of generic (domain insensitive) rules.
     */
    generic: CosmeticRule[];

    /**
     * Collection of domain specific rules.
     */
    specific: CosmeticRule[];
}
