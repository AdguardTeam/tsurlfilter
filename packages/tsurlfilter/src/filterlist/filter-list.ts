import {
    type ConversionSourceMap,
    conversionSourceMapValidator,
    FilterListConversionResult,
    ProductCode,
    RawFilterListConverter,
} from '@adguard/agtree';

import { EMPTY_STRING } from '../common/constants';
import { FILTER_LIST_ID_NONE } from '../rules/rule';

/**
 * Conversion data validator (re-exported from agtree; unchanged shape).
 */
export const conversionDataValidator = conversionSourceMapValidator;

/**
 * Serializable conversion data. Alias of the agtree source map.
 */
export type ConversionData = ConversionSourceMap;

/**
 * Conversion error tagged with the source filter id.
 */
export interface FilterListConversionError {
    /**
     * Original rule text that failed to convert.
     */
    rule: string;

    /**
     * UTF-16 code-unit offset of the rule in the original content.
     */
    offset: number;

    /**
     * Error message.
     */
    message: string;

    /**
     * Filter id associated with the error.
     */
    filterId: number;
}

/**
 * Thin adapter over the agtree {@link FilterListConversionResult}.
 * Kept for API compatibility across the monorepo.
 */
export class FilterList {
    /**
     * Underlying agtree conversion result.
     */
    private readonly result: FilterListConversionResult;

    /**
     * Filter id used to tag conversion errors.
     */
    private readonly filterId: number;

    /**
     * Conversion errors tagged with the filter id.
     */
    private readonly errors: FilterListConversionError[];

    /**
     * Creates a filter list.
     *
     * @param content Filter list content (raw when `data` is omitted, already
     * converted when `data` is provided).
     * @param filterId Optional filter id used to tag conversion errors.
     * @param data Optional stored conversion data. When provided, the content is
     * treated as already converted and is NOT re-converted.
     */
    constructor(content: string, filterId?: number, data?: ConversionData) {
        this.filterId = filterId ?? FILTER_LIST_ID_NONE;

        if (data !== undefined) {
            const isConverted = Object.keys(data.conversions).length > 0;
            this.result = new FilterListConversionResult(content, ProductCode.Adg, data, [], isConverted);
            this.errors = [];
            return;
        }

        this.result = RawFilterListConverter.convertToAdg(content);
        this.errors = this.result.errors.map((e) => ({ ...e, filterId: this.filterId }));
    }

    /**
     * Creates an empty filter list.
     *
     * @returns Empty filter list.
     */
    public static createEmpty(): FilterList {
        return new FilterList(EMPTY_STRING, FILTER_LIST_ID_NONE, FilterList.createEmptyConversionData());
    }

    /**
     * Creates empty conversion data.
     *
     * @returns Empty conversion data.
     */
    public static createEmptyConversionData(): ConversionData {
        return { originals: [], conversions: {} };
    }

    /**
     * Returns the converted content.
     *
     * @returns Converted filter list.
     */
    public getContent(): string {
        return this.result.converted;
    }

    /**
     * Returns the conversion data.
     *
     * @returns Conversion data.
     */
    public getConversionData(): ConversionData {
        return this.result.sourceMap;
    }

    /**
     * Returns conversion errors.
     *
     * @returns Conversion errors.
     */
    public getConversionErrors(): readonly FilterListConversionError[] {
        return this.errors;
    }

    /**
     * Returns the (possibly converted) rule text at an offset.
     *
     * @param offset Line start offset in the converted content.
     *
     * @returns Rule text or null.
     */
    public getRuleText(offset: number): string | null {
        return this.result.getRuleText(offset);
    }

    /**
     * Returns the original rule text at an offset.
     *
     * @param offset Line start offset in the converted content.
     *
     * @returns Original rule text or null.
     */
    public getOriginalRuleText(offset: number): string | null {
        return this.result.getOriginalRuleText(offset);
    }

    /**
     * Returns the original rule text only if the rule was converted.
     *
     * @param offset Line start offset in the converted content.
     *
     * @returns Original rule text or null.
     */
    public getConvertedRuleOriginal(offset: number): string | null {
        return this.result.getConvertedRuleOriginal(offset);
    }

    /**
     * Reconstructs the original content.
     *
     * @returns Original filter list content.
     */
    public getOriginalContent(): string {
        return this.result.getOriginalContent();
    }
}
