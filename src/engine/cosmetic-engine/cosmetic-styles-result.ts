import { CosmeticRule } from '../../cosmetic-rule';

export class CosmeticStylesResult {
    public generic: string[];

    public specific: string[];

    public genericExtCss: string[];

    public specificExtCss: string[];

    constructor() {
        this.generic = [] as string[];
        this.specific = [] as string[];
        this.genericExtCss = [] as string[];
        this.specificExtCss = [] as string[];
    }

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
