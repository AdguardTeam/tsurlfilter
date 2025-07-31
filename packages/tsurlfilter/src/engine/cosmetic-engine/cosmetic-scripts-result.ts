import { type CosmeticRule } from '../../rules/cosmetic-rule';

import { type CosmeticContentResult } from './cosmetic-content-result';

/**
 * @typedef {import('./cosmetic-result').CosmeticResult} CosmeticResult
 */

/**
 * This class stores found script rules content in the appropriate collections
 * It is primarily used by the {@link CosmeticResult}.
 */
export class CosmeticScriptsResult implements CosmeticContentResult {
    /**
     * Collection of generic (domain insensitive) rules.
     */
    public generic: CosmeticRule[];

    /**
     * Collection of domain specific rules.
     */
    public specific: CosmeticRule[];

    /**
     * Constructor.
     */
    constructor() {
        this.generic = [];
        this.specific = [];
    }

    /**
     * Appends rule to appropriate collection.
     *
     * @param rule Cosmetic rule.
     */
    public append(rule: CosmeticRule): void {
        if (rule.isGeneric()) {
            this.generic.push(rule);
        } else {
            this.specific.push(rule);
        }
    }

    /**
     * Returns collected cosmetic rules — both generic and specific.
     *
     * @returns Array of collected cosmetic rules.
     */
    public getRules(): CosmeticRule[] {
        return [...this.generic, ...this.specific];
    }
}
