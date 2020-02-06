import { RuleStorage } from '../../filterlist/rule-storage';
import { CosmeticLookupTable } from './cosmetic-lookup-table';
import { CosmeticRule, CosmeticRuleType } from '../../cosmetic-rule';
import { CosmeticResult } from './cosmetic-result';

/**
 * CosmeticEngine combines all the cosmetic rules and allows to quickly
 * find all rules matching this or that hostname
 */
export class CosmeticEngine {
    private ruleStorage: RuleStorage;

    private cosmeticElementHiding: CosmeticLookupTable;

    private cosmeticCss: CosmeticLookupTable;

    private cosmeticJs: CosmeticLookupTable;

    /**
     * Constructor
     *
     * @param ruleStorage
     */
    constructor(ruleStorage: RuleStorage) {
        this.ruleStorage = ruleStorage;

        this.cosmeticElementHiding = new CosmeticLookupTable();
        this.cosmeticCss = new CosmeticLookupTable();
        this.cosmeticJs = new CosmeticLookupTable();

        const scanner = this.ruleStorage.createRuleStorageScanner();

        while (scanner.scan()) {
            const indexedRule = scanner.getRule();
            if (indexedRule
                && indexedRule.rule instanceof CosmeticRule) {
                this.addRule(indexedRule.rule);
            }
        }
    }

    addRule(rule: CosmeticRule): void {
        switch (rule.getType()) {
            case CosmeticRuleType.ElementHiding: {
                this.cosmeticElementHiding.addRule(rule);
                break;
            }
            case CosmeticRuleType.Css: {
                this.cosmeticCss.addRule(rule);
                break;
            }
            case CosmeticRuleType.Js: {
                this.cosmeticJs.addRule(rule);
                break;
            }
            // TODO add scriptlet + HTML
            default: {
                break;
            }
        }
    }

    match(hostname: string, includeCss: boolean, includeJs: boolean, includeGenericCss: boolean): CosmeticResult {
        const cosmeticResult = new CosmeticResult();

        if (includeCss) {
            if (includeGenericCss) {
                for (const genericRule of this.cosmeticElementHiding.genericRules) {
                    if (!this.cosmeticElementHiding.isWhitelisted(hostname, genericRule)
                        && genericRule.match(hostname)) {
                        cosmeticResult.elementHiding.append(genericRule);
                    }
                }
            }

            const hostnameRules = this.cosmeticElementHiding.findByHostname(hostname);
            if (hostnameRules.length > 0) {
                for (const hostnameRule of hostnameRules) {
                    cosmeticResult.elementHiding.append(hostnameRule);
                }
            }
        }

        return cosmeticResult;
    }
}
