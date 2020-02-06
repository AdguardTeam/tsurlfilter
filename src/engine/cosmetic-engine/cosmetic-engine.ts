import { RuleStorage } from '../../filterlist/rule-storage';
import { CosmeticLookupTable } from './cosmetic-lookup-table';
import { CosmeticRule, CosmeticRuleType } from '../../cosmetic-rule';
import { CosmeticResult } from './cosmetic-result';
import { CosmeticStylesResult } from './cosmetic-styles-result';
import { CosmeticScriptsResult } from './cosmetic-scripts-result';

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
            // TODO add Scriptlet + HTML
            default: {
                break;
            }
        }
    }

    match(hostname: string, includeCss: boolean, includeJs: boolean, includeGeneric: boolean): CosmeticResult {
        const cosmeticResult = new CosmeticResult();

        if (includeCss) {
            if (includeGeneric) {
                CosmeticEngine.appendGenericRules(cosmeticResult.elementHiding, this.cosmeticElementHiding, hostname);
                CosmeticEngine.appendGenericRules(cosmeticResult.CSS, this.cosmeticCss, hostname);
            }

            CosmeticEngine.appendSpecificRules(cosmeticResult.elementHiding, this.cosmeticElementHiding, hostname);
            CosmeticEngine.appendSpecificRules(cosmeticResult.CSS, this.cosmeticCss, hostname);
        }

        if (includeJs) {
            if (includeGeneric) {
                CosmeticEngine.appendGenericRules(cosmeticResult.JS, this.cosmeticJs, hostname);
            }
            CosmeticEngine.appendSpecificRules(cosmeticResult.JS, this.cosmeticJs, hostname);
        }

        return cosmeticResult;
    }

    private static appendGenericRules(
        cosmeticResult: CosmeticStylesResult | CosmeticScriptsResult,
        lookupTable: CosmeticLookupTable,
        hostname: string,
    ): void {
        for (const genericRule of lookupTable.genericRules) {
            if (!lookupTable.isWhitelisted(hostname, genericRule)
                && genericRule.match(hostname)) {
                cosmeticResult.append(genericRule);
            }
        }
    }

    private static appendSpecificRules(
        cosmeticResult: CosmeticScriptsResult | CosmeticStylesResult,
        lookupTable: CosmeticLookupTable,
        hostname: string,
    ): void {
        const jsHostnameRules = lookupTable.findByHostname(hostname);
        if (jsHostnameRules.length > 0) {
            for (const jsHostnameRule of jsHostnameRules) {
                cosmeticResult.append(jsHostnameRule);
            }
        }
    }
}
