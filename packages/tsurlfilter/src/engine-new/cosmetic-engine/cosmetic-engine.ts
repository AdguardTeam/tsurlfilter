import { type RuleStorage } from '../../filterlist/rule-storage-new';
import { CosmeticLookupTable } from './cosmetic-lookup-table';
import { CosmeticResult } from './cosmetic-result';
import { type CosmeticContentResult } from './cosmetic-content-result';
import { CosmeticOption } from '../cosmetic-option';
import { ScannerType } from '../../filterlist/scanner-new/scanner-type';
import { type Request } from '../../request';
import { type CosmeticRuleParts, CosmeticRuleType, RuleCategory } from '../../filterlist/rule-parts';

/**
 * CosmeticEngine combines all the cosmetic rules and allows to quickly
 * find all rules matching this or that hostname
 * It is primarily used by the {@link Engine}.
 */
export class CosmeticEngine {
    /**
     * Rules storage.
     */
    private ruleStorage: RuleStorage;

    /**
     * Count of rules added to the engine.
     */
    public rulesCount: number;

    /**
     * Lookup table for elemhide rules.
     */
    private elementHidingLookupTable: CosmeticLookupTable;

    /**
     * Lookup table for css rules.
     */
    private cssLookupTable: CosmeticLookupTable;

    /**
     * Lookup table for js and scriptlets rules.
     */
    private jsLookupTable: CosmeticLookupTable;

    /**
     * Lookup table for html filtering rules.
     */
    private htmlLookupTable: CosmeticLookupTable;

    /**
     * Builds instance of cosmetic engine.
     *
     * @param ruleStorage Rule storage.
     * @param skipStorageScan Create an instance without storage scanning.
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

            if (!indexedRule) {
                continue;
            }

            const ruleParts = indexedRule.rule;

            // FIXME (David): Probably we have a possible optimization step here.
            // When initial scan is enabled, the core engine passes it to its network and cosmetic engines,
            // and they creates their own scanners.
            // However, `list.newScanner` using the list own `ignoreCosmetic` etc props,
            // so we need to filter out cosmetic rules here now.
            if (ruleParts.category !== RuleCategory.Cosmetic) {
                continue;
            }

            this.addRule(ruleParts, indexedRule.index);
        }
    }

    /**
     * Adds rules into appropriate tables.
     *
     * @param rule Rule to add.
     * @param storageIdx Index of the rule in the storage.
     */
    public addRule(rule: CosmeticRuleParts, storageIdx: number): void {
        switch (rule.type) {
            case CosmeticRuleType.ElementHidingRule: {
                this.elementHidingLookupTable.addRule(rule, storageIdx);
                break;
            }
            case CosmeticRuleType.CssInjectionRule: {
                this.cssLookupTable.addRule(rule, storageIdx);
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
     * Checks if bitwise mask matches option.
     *
     * @param option Option to match.
     * @param targetOption Target option.
     *
     * @returns True if option matches targetOption.
     */
    static matchOption(option: CosmeticOption, targetOption: CosmeticOption): boolean {
        return (option & targetOption) === targetOption;
    }

    /**
     * Prepares cosmetic result by request.
     *
     * @param request Request to match.
     * @param option Mask of enabled cosmetic types.
     *
     * @returns CosmeticResult.
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
     * Selects generic rules and appends rules content to cosmetic result.
     *
     * @param cosmeticResult Cosmetic result.
     * @param lookupTable Lookup table.
     * @param request Request.
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
     * Selects specific rules and appends rules content to cosmetic result.
     *
     * @param cosmeticResult Cosmetic result.
     * @param lookupTable Lookup table.
     * @param request Request.
     */
    private static appendSpecificRules(
        cosmeticResult: CosmeticContentResult,
        lookupTable: CosmeticLookupTable,
        request: Request,
    ): void {
        const specificRules = lookupTable.findByHostname(request);

        if (specificRules.length === 0) {
            return;
        }

        for (const rule of specificRules) {
            if (!lookupTable.isAllowlisted(request, rule)) {
                cosmeticResult.append(rule, request);
            }
        }
    }
}
