import { CosmeticRule } from '../../rules/cosmetic-rule';

/**
 * This class stores found cosmetic css rules content in the appropriate collections
 * It is primarily used by the {@see CosmeticResult}
 */
export class CosmeticStylesResult {
    /**
     * Collection of generic rules
     */
    public generic: string[];

    /**
     * Collection of specific rules
     */
    public specific: string[];

    /**
     * Collection of generic extcss rules
     */
    public genericExtCss: string[];

    /**
     * Collection of specific extcss rules
     */
    public specificExtCss: string[];

    constructor() {
        this.generic = [] as string[];
        this.specific = [] as string[];
        this.genericExtCss = [] as string[];
        this.specificExtCss = [] as string[];
    }

    /**
     * Appends rule to the appropriate collection
     * @param rule
     */
    append(rule: CosmeticRule): void {
        const ruleContent = rule.getContent();
        if (rule.isGeneric()) {
            if (rule.isExtendedCss()) {
                this.genericExtCss.push(ruleContent);
            } else {
                this.generic.push(ruleContent);
            }
        } else if (rule.isExtendedCss()) {
            this.specificExtCss.push(ruleContent);
        } else {
            this.specific.push(ruleContent);
        }
    }
}
