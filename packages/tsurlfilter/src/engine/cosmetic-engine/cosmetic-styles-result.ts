import { CosmeticRule } from '../../rules/cosmetic-rule';
import { CosmeticContentResult } from './cosmetic-content-result';

/**
 * This class stores found cosmetic css rules content in the appropriate collections
 * It is primarily used by the {@see CosmeticResult}
 */
export class CosmeticStylesResult implements CosmeticContentResult {
    /**
     * Collection of generic rules
     */
    public generic: CosmeticRule[];

    /**
     * Collection of specific rules
     */
    public specific: CosmeticRule[];

    /**
     * Collection of generic extcss rules
     */
    public genericExtCss: CosmeticRule[];

    /**
     * Collection of specific extcss rules
     */
    public specificExtCss: CosmeticRule[];

    /**
     * Constructor
     */
    constructor() {
        this.generic = [];
        this.specific = [];
        this.genericExtCss = [];
        this.specificExtCss = [];
    }

    /**
     * Appends rule to the appropriate collection
     * @param rule
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
