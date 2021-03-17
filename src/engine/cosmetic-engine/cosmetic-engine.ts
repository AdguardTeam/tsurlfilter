import { RuleStorage } from '../../filterlist/rule-storage';
import { CosmeticLookupTable } from './cosmetic-lookup-table';
import { CosmeticRule, CosmeticRuleType } from '../../rules/cosmetic-rule';
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

        this.elementHidingLookupTable = new CosmeticLookupTable();
        this.cssLookupTable = new CosmeticLookupTable();
        this.jsLookupTable = new CosmeticLookupTable();
        this.htmlLookupTable = new CosmeticLookupTable();

        if (skipStorageScan) {
            return;
        }

        const scanner = this.ruleStorage.createRuleStorageScanner(ScannerType.CosmeticRules);

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
    public addRule(rule: CosmeticRule): void {
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

        this.rulesCount += 1;
    }

    /**
     * Prepares cosmetic result by request
     *
     * @param request - request to match
     * @param option mask of enabled cosmetic types
     * @return CosmeticResult
     */
    match(request: Request, option: CosmeticOption): CosmeticResult {
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
                    request,
                );
                CosmeticEngine.appendGenericRules(cosmeticResult.CSS, this.cssLookupTable, request);
            }

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
            if (!lookupTable.isWhitelisted(request.hostname, genericRule)
                && genericRule.match(request.hostname)) {
                cosmeticResult.append(genericRule);
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
        const hostnameRules = lookupTable.findByHostname(request.hostname, request.subdomains);
        if (hostnameRules.length > 0) {
            for (const rule of hostnameRules) {
                if (!lookupTable.isWhitelisted(request.hostname, rule)) {
                    cosmeticResult.append(rule);
                }
            }
        }
    }
}
