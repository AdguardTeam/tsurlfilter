import { CosmeticRule } from '../../cosmetic-rule';

/**
 * This class stores found script rules content in the appropriate collections
 * It is primarily used by the {@see CosmeticResult}
 */
export class CosmeticScriptsResult {
    /**
     * Collection of generic (domain insensitive) rules
     */
    public generic: string[];

    /**
     * Collection of domain specific rules
     */
    public specific: string[];

    constructor() {
        this.generic = [] as string[];
        this.specific = [] as string[];
    }

    /**
     * Appends rule to appropriate collection
     * @param rule
     */
    append(rule: CosmeticRule): void {
        const ruleContent = rule.getContent();
        if (rule.isGeneric()) {
            this.generic.push(ruleContent);
        } else {
            this.specific.push(ruleContent);
        }
    }
}
