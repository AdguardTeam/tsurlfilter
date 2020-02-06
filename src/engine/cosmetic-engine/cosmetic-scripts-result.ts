import { CosmeticRule } from '../../cosmetic-rule';

export class CosmeticScriptsResult {
    public generic: string[];

    public specific: string[];

    constructor() {
        this.generic = [] as string[];
        this.specific = [] as string[];
    }

    append(rule: CosmeticRule): void {
        const ruleContent = rule.getContent();
        if (rule.isGeneric()) {
            this.generic.push(ruleContent);
        } else {
            this.specific.push(ruleContent);
        }
    }
}
