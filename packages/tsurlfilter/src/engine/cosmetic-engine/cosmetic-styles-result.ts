import { type CosmeticRule } from '../../rules/cosmetic-rule';
import { type CosmeticContentResult } from './cosmetic-content-result';

/**
 * @typedef {import('./cosmetic-result').CosmeticResult} CosmeticResult
 */

/**
 * This class stores found cosmetic css rules content in the appropriate collections
 * It is primarily used by the {@link CosmeticResult}.
 */
export class CosmeticStylesResult implements CosmeticContentResult {
    /**
     * Collection of generic rules.
     */
    public generic: CosmeticRule[];

    /**
     * Collection of specific rules.
     */
    public specific: CosmeticRule[];

    /**
     * Collection of generic ext-css rules.
     */
    public genericExtCss: CosmeticRule[];

    /**
     * Collection of specific ext-css rules.
     */
    public specificExtCss: CosmeticRule[];

    /**
     * Constructor.
     */
    constructor() {
        this.generic = [];
        this.specific = [];
        this.genericExtCss = [];
        this.specificExtCss = [];
    }

    /**
     * Appends rule to the appropriate collection.
     *
     * @param rule Cosmetic rule.
     */
    append(rule: CosmeticRule): void {
        if (rule.isGeneric()) {
            if (rule.isExtendedCss()) {
                this.genericExtCss.push(rule);
            } else {
                this.generic.push(rule);
            }
        } else if (rule.isExtendedCss()) {
            this.specificExtCss.push(rule);
        } else {
            this.specific.push(rule);
        }
    }
}
