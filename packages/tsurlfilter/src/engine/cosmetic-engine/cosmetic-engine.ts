import { CosmeticRuleType } from '@adguard/agtree';

import { RuleStorage } from '../../filterlist/rule-storage';
import { CosmeticLookupTable } from './cosmetic-lookup-table';
import { CosmeticRule } from '../../rules/cosmetic-rule';
import { CosmeticResult } from './cosmetic-result';
import { CosmeticContentResult } from './cosmetic-content-result';
import { CosmeticOption } from '../cosmetic-option';
import { ScannerType } from '../../filterlist/scanner/scanner-type';
import { Request } from '../../request';

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
     * Count of rules added to the engine
     */
    public rulesCount: number;

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
     * @param skipStorageScan create an instance without storage scanning
     */
    constructor(ruleStorage: RuleStorage, skipStorageScan = false) {
        this.ruleStorage = ruleStorage;
        this.rulesCount = 0;

        this.elementHidingLookupTable = new CosmeticLookupTable(ruleStorage);
        this.cssLookupTable = new CosmeticLookupTable(ruleStorage);
        this.jsLookupTable = new CosmeticLookupTable(ruleStorage);
        this.htmlLookupTable = new CosmeticLookupTable(ruleStorage);

        if (skipStorageScan) {
            return;
        }

        const scanner = this.ruleStorage.createRuleStorageScanner(ScannerType.CosmeticRules);

        while (scanner.scan()) {
            const indexedRule = scanner.getRule();
            if (indexedRule
                && indexedRule.rule instanceof CosmeticRule) {
                this.addRule(indexedRule.rule, indexedRule.index);
            }
        }
    }

    /**
     * Adds rules into appropriate tables
     * @param rule
     * @param storageIdx
     */
    public addRule(rule: CosmeticRule, storageIdx: number): void {
        switch (rule.getType()) {
            case CosmeticRuleType.ElementHidingRule: {
                this.elementHidingLookupTable.addRule(rule, storageIdx);
                break;
            }
            case CosmeticRuleType.CssInjectionRule: {
                this.cssLookupTable.addRule(rule, storageIdx);
                break;
            }
            case CosmeticRuleType.ScriptletInjectionRule: {
                this.jsLookupTable.addRule(rule, storageIdx);
                break;
            }
            case CosmeticRuleType.JsInjectionRule: {
                this.jsLookupTable.addRule(rule, storageIdx);
                break;
            }
            case CosmeticRuleType.HtmlFilteringRule: {
                this.htmlLookupTable.addRule(rule, storageIdx);
                break;
            }
            default: {
                break;
            }
        }

        this.rulesCount += 1;
    }

    /**
     * Checks if bitwise mask matches option
     * @param option
     * @param targetOption
     */
    static matchOption(option: CosmeticOption, targetOption: CosmeticOption): boolean {
        return (option & targetOption) === targetOption;
    }

    /**
     * Prepares cosmetic result by request
     *
     * @param request - request to match
     * @param option mask of enabled cosmetic types
     * @return CosmeticResult
     */
    match(request: Request, option: CosmeticOption): CosmeticResult {
        const includeGeneric = CosmeticEngine.matchOption(option, CosmeticOption.CosmeticOptionGenericCSS);
        const includeSpecific = CosmeticEngine.matchOption(option, CosmeticOption.CosmeticOptionSpecificCSS);

        const includeJs = CosmeticEngine.matchOption(option, CosmeticOption.CosmeticOptionJS);
        const includeHtml = CosmeticEngine.matchOption(option, CosmeticOption.CosmeticOptionHtml);

        const cosmeticResult = new CosmeticResult();

        if (includeGeneric) {
            CosmeticEngine.appendGenericRules(cosmeticResult.elementHiding, this.elementHidingLookupTable, request);
            CosmeticEngine.appendGenericRules(cosmeticResult.CSS, this.cssLookupTable, request);
        }

        if (includeSpecific) {
            CosmeticEngine.appendSpecificRules(cosmeticResult.elementHiding, this.elementHidingLookupTable, request);
            CosmeticEngine.appendSpecificRules(cosmeticResult.CSS, this.cssLookupTable, request);
        }

        if (includeJs) {
            CosmeticEngine.appendGenericRules(cosmeticResult.JS, this.jsLookupTable, request);
            CosmeticEngine.appendSpecificRules(cosmeticResult.JS, this.jsLookupTable, request);
        }

        if (includeHtml) {
            if (includeGeneric) {
                CosmeticEngine.appendGenericRules(cosmeticResult.Html, this.htmlLookupTable, request);
            }
            CosmeticEngine.appendSpecificRules(cosmeticResult.Html, this.htmlLookupTable, request);
        }

        return cosmeticResult;
    }

    /**
     * Selects generic rules and appends rules content to cosmetic result
     * @param cosmeticResult
     * @param lookupTable
     * @param request
     */
    private static appendGenericRules(
        cosmeticResult: CosmeticContentResult,
        lookupTable: CosmeticLookupTable,
        request: Request,
    ): void {
        for (const genericRule of lookupTable.genericRules) {
            if (!lookupTable.isAllowlisted(request, genericRule)
                && genericRule.match(request)) {
                cosmeticResult.append(genericRule, request);
            }
        }
    }

    /**
     * Selects specific rules and appends rules content to cosmetic result
     * @param cosmeticResult
     * @param lookupTable
     * @param request
     */
    private static appendSpecificRules(
        cosmeticResult: CosmeticContentResult,
        lookupTable: CosmeticLookupTable,
        request: Request,
    ): void {
        const hostnameRules = lookupTable.findByHostname(request);
        if (hostnameRules.length > 0) {
            for (const rule of hostnameRules) {
                if (!lookupTable.isAllowlisted(request, rule)) {
                    cosmeticResult.append(rule, request);
                }
            }
        }
    }
}
