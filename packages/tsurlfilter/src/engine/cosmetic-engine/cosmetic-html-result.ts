import { type CosmeticRule } from '../../rules/cosmetic-rule';

import { type CosmeticContentResult } from './cosmetic-content-result';

/**
 * @typedef {import('./cosmetic-result').CosmeticResult} CosmeticResult
 */

/**
 * This class stores found cosmetic html rules content in the appropriate collections
 * It is primarily used by the {@link CosmeticResult}.
 */
export class CosmeticHtmlResult implements CosmeticContentResult {
    /**
     * Collection of generic rules.
     */
    public generic: CosmeticRule[];

    /**
     * Collection of specific rules.
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
     * Appends rule to the appropriate collection.
     *
     * @param rule Rule to process.
     */
    public append(rule: CosmeticRule): void {
        if (rule.isGeneric()) {
            this.generic.push(rule);
        } else {
            this.specific.push(rule);
        }
    }

    /**
     * Returns collected cosmetic **HTML** rules — both generic and specific.
     *
     * @returns Array of collected rules.
     */
    public getRules(): CosmeticRule[] {
        return [...this.generic, ...this.specific];
    }
}
