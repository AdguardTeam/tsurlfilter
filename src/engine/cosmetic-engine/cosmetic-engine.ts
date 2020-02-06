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

    private elementHidingLookupTable: CosmeticLookupTable;

    private cssLookupTable: CosmeticLookupTable;

    private jsLookupTable: CosmeticLookupTable;

    /**
     * Builds instance of cosmetic engine
     *
     * @param ruleStorage
     */
    constructor(ruleStorage: RuleStorage) {
        this.ruleStorage = ruleStorage;

        this.elementHidingLookupTable = new CosmeticLookupTable();
        this.cssLookupTable = new CosmeticLookupTable();
        this.jsLookupTable = new CosmeticLookupTable();

        const scanner = this.ruleStorage.createRuleStorageScanner();

        while (scanner.scan()) {
            const indexedRule = scanner.getRule();
            if (indexedRule
                && indexedRule.rule instanceof CosmeticRule) {
                this.addRule(indexedRule.rule);
            }
        }
    }

    /**
     * Adds rules into appropriate tables
     * @param rule
     */
    addRule(rule: CosmeticRule): void {
        switch (rule.getType()) {
            case CosmeticRuleType.ElementHiding: {
                this.elementHidingLookupTable.addRule(rule);
                break;
            }
            case CosmeticRuleType.Css: {
                this.cssLookupTable.addRule(rule);
                break;
            }
            case CosmeticRuleType.Js: {
                this.jsLookupTable.addRule(rule);
                break;
            }
            // TODO add Scriptlet + HTML
            default: {
                break;
            }
        }
    }

    /**
     * Prepares cosmetic result by hostname
     * @param hostname
     * @param includeCss
     * @param includeJs
     * @param includeGeneric
     */
    match(hostname: string, includeCss: boolean, includeJs: boolean, includeGeneric: boolean): CosmeticResult {
        const cosmeticResult = new CosmeticResult();

        if (includeCss) {
            if (includeGeneric) {
                CosmeticEngine.appendGenericRules(
                    cosmeticResult.elementHiding,
                    this.elementHidingLookupTable,
                    hostname,
                );
                CosmeticEngine.appendGenericRules(cosmeticResult.CSS, this.cssLookupTable, hostname);
            }

            CosmeticEngine.appendSpecificRules(cosmeticResult.elementHiding, this.elementHidingLookupTable, hostname);
            CosmeticEngine.appendSpecificRules(cosmeticResult.CSS, this.cssLookupTable, hostname);
        }

        if (includeJs) {
            if (includeGeneric) {
                CosmeticEngine.appendGenericRules(cosmeticResult.JS, this.jsLookupTable, hostname);
            }
            CosmeticEngine.appendSpecificRules(cosmeticResult.JS, this.jsLookupTable, hostname);
        }

        return cosmeticResult;
    }

    /**
     * Selects generic rules and appends rules content to cosmetic result
     * @param cosmeticResult
     * @param lookupTable
     * @param hostname
     */
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


    /**
     * Selects specific rules and appends rules content to cosmetic result
     * @param cosmeticResult
     * @param lookupTable
     * @param hostname
     */
    private static appendSpecificRules(
        cosmeticResult: CosmeticScriptsResult | CosmeticStylesResult,
        lookupTable: CosmeticLookupTable,
        hostname: string,
    ): void {
        const jsHostnameRules = lookupTable.findByHostname(hostname);
        if (jsHostnameRules.length > 0) {
            for (const jsHostnameRule of jsHostnameRules) {
                if (!lookupTable.isWhitelisted(hostname, jsHostnameRule)) {
                    cosmeticResult.append(jsHostnameRule);
                }
            }
        }
    }
}
