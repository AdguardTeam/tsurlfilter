import { CosmeticRule } from '../../rules/cosmetic-rule';
import { CosmeticContentResult } from './cosmetic-content-result';

/**
 * This class stores found script rules content in the appropriate collections
 * It is primarily used by the {@see CosmeticResult}
 */
export class CosmeticScriptsResult implements CosmeticContentResult {
    /**
     * Collection of generic (domain insensitive) rules
     */
    public generic: CosmeticRule[];

    /**
     * Collection of domain specific rules
     */
    public specific: CosmeticRule[];

    /**
     * Constructor
     */
    constructor() {
        this.generic = [];
        this.specific = [];
    }

    /**
     * Appends rule to appropriate collection
     * @param rule
     */
    append(rule: CosmeticRule): void {
        if (rule.isGeneric()) {
            this.generic.push(rule);
        } else {
            this.specific.push(rule);
        }
    }

    /**
     * Returns rules collected
     */
    getRules(): CosmeticRule[] {
        return [...this.generic, ...this.specific];
    }
}
