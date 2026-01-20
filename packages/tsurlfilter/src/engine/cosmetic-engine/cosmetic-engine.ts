import { type CosmeticRuleParts, CosmeticRuleType } from '../../filterlist/rule-parts';
import { type RuleStorage } from '../../filterlist/rule-storage';
import { type Request } from '../../request';
import { type IndexedStorageCosmeticRuleParts } from '../../rules/rule';
import { CHUNK_SIZE } from '../constants';
import { CosmeticOption } from '../cosmetic-option';

import { type CosmeticContentResult } from './cosmetic-content-result';
import { CosmeticLookupTable } from './cosmetic-lookup-table';
import { CosmeticResult } from './cosmetic-result';

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
     * Creates an instance of the network engine in sync mode.
     *
     * @param indexedRulesParts Array of indexed storage cosmetic rules.
     * @param storage An object for a rules storage.
     *
     * @returns An instance of the network engine.
     */
    public static createSync(
        indexedRulesParts: IndexedStorageCosmeticRuleParts[],
        storage: RuleStorage,
    ): CosmeticEngine {
        const engine = new CosmeticEngine(storage);

        for (const indexedRuleParts of indexedRulesParts) {
            engine.addRule(indexedRuleParts.ruleParts, indexedRuleParts.index);
        }

        return engine;
    }

    /**
     * Creates an instance of the network engine in async mode.
     *
     * @param indexedRulesParts Array of indexed storage cosmetic rules.
     * @param storage An object for a rules storage.
     *
     * @returns An instance of the network engine.
     */
    public static async createAsync(
        indexedRulesParts: IndexedStorageCosmeticRuleParts[],
        storage: RuleStorage,
    ): Promise<CosmeticEngine> {
        const engine = new CosmeticEngine(storage);

        let counter = 0;

        for (const indexedRuleParts of indexedRulesParts) {
            counter += 1;

            if (counter >= CHUNK_SIZE) {
                counter = 0;

                // eslint-disable-next-line no-await-in-loop, no-promise-executor-return
                await Promise.resolve();
            }

            engine.addRule(indexedRuleParts.ruleParts, indexedRuleParts.index);
        }

        return engine;
    }

    /**
     * Builds instance of cosmetic engine.
     *
     * @param ruleStorage Rule storage.
     */
    private constructor(ruleStorage: RuleStorage) {
        this.ruleStorage = ruleStorage;
        this.rulesCount = 0;

        this.elementHidingLookupTable = new CosmeticLookupTable(ruleStorage);
        this.cssLookupTable = new CosmeticLookupTable(ruleStorage);
        this.jsLookupTable = new CosmeticLookupTable(ruleStorage);
        this.htmlLookupTable = new CosmeticLookupTable(ruleStorage);
    }

    /**
     * Adds rules into appropriate tables.
     *
     * @param ruleParts Cosmetic rule parts to add.
     * @param storageIdx Index of the rule in the storage.
     */
    private addRule(ruleParts: CosmeticRuleParts, storageIdx: number): void {
        switch (ruleParts.type) {
            case CosmeticRuleType.ElementHidingRule: {
                this.elementHidingLookupTable.addRule(ruleParts, storageIdx);
                break;
            }
            case CosmeticRuleType.CssInjectionRule: {
                this.cssLookupTable.addRule(ruleParts, storageIdx);
                break;
            }
            case CosmeticRuleType.JsInjectionRule: {
                this.jsLookupTable.addRule(ruleParts, storageIdx);
                break;
            }
            case CosmeticRuleType.HtmlFilteringRule: {
                this.htmlLookupTable.addRule(ruleParts, storageIdx);
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
    public static matchOption(option: CosmeticOption, targetOption: CosmeticOption): boolean {
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
    public match(request: Request, option: CosmeticOption): CosmeticResult {
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
