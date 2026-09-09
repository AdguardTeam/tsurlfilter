/**
 * @file Serializable result of converting a raw filter list: the converted
 * text, the target product, a reverse source map, non-fatal per-rule errors,
 * and reverse-lookup helpers. Owns behavior previously implemented in
 * tsurlfilter's `FilterList`.
 */

import type { ProductCode } from '../compatibility-tables';

import { type ConversionSourceMap, createEmptyConversionSourceMap } from './source-map';

/**
 * Non-fatal error recorded when a single rule fails to parse/convert in
 * tolerant mode. Filter-id agnostic — consumers may tag it further.
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
}

/**
 * Finds the next line break at or after `offset`.
 *
 * @param source Text to scan.
 * @param offset Start offset.
 *
 * @returns Tuple of the line-break index and its length (0 length at EOF).
 */
function findNextLineBreak(source: string, offset: number): [index: number, length: number] {
    const { length } = source;
    for (let i = offset; i < length; i += 1) {
        const c = source.charCodeAt(i);
        if (c === 0x0a) {
            return [i, 1];
        }
        if (c === 0x0d) {
            return [i, i + 1 < length && source.charCodeAt(i + 1) === 0x0a ? 2 : 1];
        }
    }
    return [length, 0];
}

/**
 * Result of a raw filter list conversion with a reverse source map.
 */
export class FilterListConversionResult {
    /**
     * Creates a conversion result.
     *
     * @param converted Converted filter list text.
     * @param product Target product the list was converted to (never `Any`).
     * @param sourceMap Source map linking converted lines to originals.
     * @param errors Non-fatal per-rule conversion errors.
     * @param isConverted Whether at least one rule was converted.
     */
    constructor(
        public readonly converted: string,
        public readonly product: ProductCode,
        public readonly sourceMap: ConversionSourceMap,
        public readonly errors: readonly FilterListConversionError[],
        public readonly isConverted: boolean,
    ) {}

    /**
     * Creates an empty result for the given target product.
     *
     * @param product Target product.
     *
     * @returns Empty conversion result.
     */
    public static empty(product: ProductCode): FilterListConversionResult {
        return new FilterListConversionResult('', product, createEmptyConversionSourceMap(), [], false);
    }

    /**
     * Returns the (possibly converted) rule text at a converted-line offset.
     *
     * @param offset Line start offset in the converted content.
     *
     * @returns Rule text, or null if out of range.
     */
    public getRuleText(offset: number): string | null {
        if (offset >= this.converted.length) {
            return null;
        }
        const [lineBreakStartIndex] = findNextLineBreak(this.converted, offset);
        return this.converted.slice(offset, lineBreakStartIndex);
    }

    /**
     * Returns the original rule text at a converted-line offset, falling back to
     * the converted rule text when the rule was not converted.
     *
     * @param offset Line start offset in the converted content.
     *
     * @returns Original rule text, or null if out of range.
     */
    public getOriginalRuleText(offset: number): string | null {
        if (offset < 0 || offset >= this.converted.length) {
            return null;
        }
        const originalRuleIndex = this.sourceMap.conversions[offset];
        if (originalRuleIndex !== undefined) {
            return this.sourceMap.originals[originalRuleIndex];
        }
        return this.getRuleText(offset);
    }

    /**
     * Returns the original rule text only when the rule at the offset was
     * actually converted; otherwise null.
     *
     * @param offset Line start offset in the converted content.
     *
     * @returns Original rule text if converted, else null.
     */
    public getConvertedRuleOriginal(offset: number): string | null {
        if (offset < 0 || offset >= this.converted.length) {
            return null;
        }
        const originalRuleIndex = this.sourceMap.conversions[offset];
        if (originalRuleIndex !== undefined) {
            return this.sourceMap.originals[originalRuleIndex];
        }
        return null;
    }

    /**
     * Reconstructs the original filter list content from the converted content.
     *
     * @returns Original filter list content.
     */
    public getOriginalContent(): string {
        if (this.sourceMap.originals.length === 0) {
            return this.converted;
        }

        let originalBuffer = '';
        const { length } = this.converted;
        let offset = 0;

        while (offset < length) {
            let [nextLineBreakIndex, nextLineBreakLength] = findNextLineBreak(this.converted, offset);
            const currentLine = this.converted.slice(offset, nextLineBreakIndex);
            const firstOriginalRuleIndex = this.sourceMap.conversions[offset];

            if (firstOriginalRuleIndex !== undefined) {
                originalBuffer += this.sourceMap.originals[firstOriginalRuleIndex];

                let nextOffset = nextLineBreakIndex + nextLineBreakLength;
                while (this.sourceMap.conversions[nextOffset] === firstOriginalRuleIndex) {
                    [nextLineBreakIndex, nextLineBreakLength] = findNextLineBreak(this.converted, nextOffset);
                    nextOffset = nextLineBreakIndex + nextLineBreakLength;
                }
                offset = nextLineBreakIndex + nextLineBreakLength;
            } else {
                originalBuffer += currentLine;
                offset = nextLineBreakIndex + nextLineBreakLength;
            }

            originalBuffer += this.converted.slice(nextLineBreakIndex, nextLineBreakIndex + nextLineBreakLength);
        }

        return originalBuffer;
    }
}
