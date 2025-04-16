import { type RuleStorage } from '../../filterlist/rule-storage';
import { CosmeticLookupTable } from './cosmetic-lookup-table';
import { CosmeticResult } from './cosmetic-result';
import { type CosmeticContentResult } from './cosmetic-content-result';
import { CosmeticOption } from '../cosmetic-option';
import { type Request } from '../../request';
import { type ByteBuffer } from '../../utils/byte-buffer';
import { CosmeticEngineByteOffsets } from '../byte-offsets';

/**
 * CosmeticEngine combines all the cosmetic rules and allows to quickly
 * find all rules matching this or that hostname
 * It is primarily used by the {@link Engine}.
 */
export class CosmeticEngine {
    public readonly offset: number;

    public readonly buffer: ByteBuffer;

    private readonly elementHidingLookupTable: CosmeticLookupTable;

    private readonly cssLookupTable: CosmeticLookupTable;

    private readonly jsLookupTable: CosmeticLookupTable;

    private readonly htmlLookupTable: CosmeticLookupTable;

    constructor(
        storage: RuleStorage,
        buffer: ByteBuffer,
        offset: number,
    ) {
        this.buffer = buffer;
        this.offset = offset;

        this.elementHidingLookupTable = new CosmeticLookupTable(
            storage,
            buffer,
            offset + CosmeticEngineByteOffsets.ElementHidingLookupTable,
        );
        this.cssLookupTable = new CosmeticLookupTable(
            storage,
            buffer,
            offset + CosmeticEngineByteOffsets.CssLookupTable,
        );
        this.jsLookupTable = new CosmeticLookupTable(
            storage,
            buffer,
            offset + CosmeticEngineByteOffsets.JsLookupTable,
        );
        this.htmlLookupTable = new CosmeticLookupTable(
            storage,
            buffer,
            offset + CosmeticEngineByteOffsets.HtmlLookupTable,
        );
    }

    public get rulesCount(): number {
        return this.buffer.getUint32(this.offset + CosmeticEngineByteOffsets.RulesCount);
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
