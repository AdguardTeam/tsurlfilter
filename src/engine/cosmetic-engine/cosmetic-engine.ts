import { RuleStorage } from '../../filterlist/rule-storage';
import { CosmeticLookupTable } from './cosmetic-lookup-table';
import { CosmeticRule, CosmeticRuleType } from '../../rules/cosmetic-rule';
import { CosmeticResult } from './cosmetic-result';
import { CosmeticContentResult } from './cosmetic-content-result';
import { CosmeticOption } from '../cosmetic-option';

/**
 * CosmeticEngine combines all the cosmetic rules and allows to quickly
 * find all rules matching this or that hostname
 * It is primarily used by the {@see Engine}
 */
export class CosmeticEngine {
    /**
     * Rules storage
     */
    private ruleStorage: RuleStorage;

    /**
     * Lookup table for elemhide rules
     */
    private elementHidingLookupTable: CosmeticLookupTable;

    /**
     * Lookup table for css rules
     */
    private cssLookupTable: CosmeticLookupTable;

    /**
     * Lookup table for js and scriptlets rules
     */
    private jsLookupTable: CosmeticLookupTable;

    /**
     * Lookup table for html filtering rules
     */
    private htmlLookupTable: CosmeticLookupTable;

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
        this.htmlLookupTable = new CosmeticLookupTable();

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
    private addRule(rule: CosmeticRule): void {
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
            case CosmeticRuleType.Html: {
                this.htmlLookupTable.addRule(rule);
                break;
            }
            default: {
                break;
            }
        }
    }

    /**
     * Prepares cosmetic result by hostname
     *
     * @param hostname domain to check
     * @param option mask of enabled cosmetic types
     * @return CosmeticResult
     */
    match(hostname: string, option: CosmeticOption): CosmeticResult {
        const includeCss = (option & CosmeticOption.CosmeticOptionCSS) === CosmeticOption.CosmeticOptionCSS;
        const includeGeneric = (option
            & CosmeticOption.CosmeticOptionGenericCSS) === CosmeticOption.CosmeticOptionGenericCSS;

        const includeJs = (option & CosmeticOption.CosmeticOptionJS) === CosmeticOption.CosmeticOptionJS;
        const includeHtml = (option & CosmeticOption.CosmeticOptionHtml) === CosmeticOption.CosmeticOptionHtml;

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

        if (includeHtml) {
            if (includeGeneric) {
                CosmeticEngine.appendGenericRules(cosmeticResult.Html, this.htmlLookupTable, hostname);
            }
            CosmeticEngine.appendSpecificRules(cosmeticResult.Html, this.htmlLookupTable, hostname);
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
        cosmeticResult: CosmeticContentResult,
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
        cosmeticResult: CosmeticContentResult,
        lookupTable: CosmeticLookupTable,
        hostname: string,
    ): void {
        const hostnameRules = lookupTable.findByHostname(hostname);
        if (hostnameRules.length > 0) {
            for (const rule of hostnameRules) {
                if (!lookupTable.isWhitelisted(hostname, rule)) {
                    cosmeticResult.append(rule);
                }
            }
        }
    }
}
