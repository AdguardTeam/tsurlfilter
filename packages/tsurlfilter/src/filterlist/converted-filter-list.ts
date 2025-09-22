/* eslint-disable @typescript-eslint/no-loop-func */
import { RawRuleConverter } from '@adguard/agtree';
import { z as zod } from 'zod';

import { EMPTY_STRING, LF } from '../common/constants';
import { findNextLineBreakIndex } from '../utils/string-utils';

/**
 * Conversion data validator.
 * With this data we can revert the conversion and get the original filter list.
 * It is designed to provide O(1) access to the original filtering rules.
 */
export const conversionDataValidator = zod.object({
    /**
     * Original filter list rules.
     */
    originals: zod.string().array(),
    /**
     * Conversion map.
     * Maps line start offsets in the converted content to indexes in the `originals` array.
     *
     * Keys are 0-based line start offsets in the converted content.
     * Values are 0-based indexes in the `originals` array.
     */
    conversions: zod.record(zod.number(), zod.number()),
});

export type ConversionData = zod.infer<typeof conversionDataValidator>;

/**
 * ConvertedFilterList is a class that represents a converted filter list.
 * It is designed to provide O(1) access to the original filtering rules.
 */
export class ConvertedFilterList {
    /**
     * Content of the converted filter list.
     */
    private content: string;

    /**
     * Conversion data.
     * With this data we can revert the conversion and get the original filter list.
     * It is designed to provide O(1) access to the original filtering rules.
     */
    private data!: ConversionData;

    /**
     * Whether the filter list has been prepared.
     */
    private prepared: boolean;

    /**
     * Creates a new ConvertedFilterList instance.
     *
     * @param content Filter list content.
     * @param data Optional conversion data. If not provided, the filter list will be prepared.
     * If provided, this class trusts the data and does not prepare the filter list.
     */
    constructor(content: string, data?: ConversionData) {
        if (data !== undefined) {
            this.prepared = true;
            this.content = content;
            this.data = data;
        } else {
            this.prepared = false;
            this.content = content;
            this.prepare(content);
        }
    }

    /**
     * Creates an empty converted filter list.
     *
     * @returns Empty converted filter list.
     */
    public static createEmpty(): ConvertedFilterList {
        return new ConvertedFilterList(EMPTY_STRING, ConvertedFilterList.createEmptyConversionData());
    }

    /**
     * Creates an empty conversion data.
     *
     * @returns Empty conversion data.
     */
    public static createEmptyConversionData(): ConversionData {
        return {
            originals: [],
            conversions: {},
        };
    }

    /**
     * Returns the converted content.
     *
     * @returns Converted filter list as a string.
     */
    public getContent(): string {
        return this.content;
    }

    /**
     * Returns the conversion data.
     *
     * @returns Conversion data.
     */
    public getConversionData(): ConversionData {
        return this.data;
    }

    /**
     * Prepares the filter list by converting it and recording conversion data.
     *
     * @param original The original unconverted filter list.
     */
    private prepare(original: string) {
        if (this.prepared) {
            return;
        }

        const { length } = original;
        let convertedBuffer = EMPTY_STRING;
        const data: ConversionData = {
            originals: [],
            conversions: {},
        };

        let offset = 0;

        while (offset < length) {
            const [lineBreakIndex, lineBreakLen] = findNextLineBreakIndex(original, offset);
            const lineBreak = original.slice(lineBreakIndex, lineBreakIndex + lineBreakLen);
            const line = original.slice(offset, lineBreakIndex);

            try {
                const conversionResult = RawRuleConverter.convertToAdg(line);
                if (conversionResult.isConverted) {
                    const originalIndex = data.originals.length;
                    data.originals.push(line);

                    for (let i = 0; i < conversionResult.result.length; i += 1) {
                        const conversionIndex = convertedBuffer.length;
                        const convertedLine = conversionResult.result[i];

                        if (lineBreak.length > 0) {
                            convertedBuffer += convertedLine + lineBreak;
                        } else if (i < conversionResult.result.length - 1) {
                            // If the file has no final line break, but we converted the last rule into multiple lines,
                            // we need to add a line break after each converted line, except the last one
                            convertedBuffer += `${convertedLine}${LF}`;
                        } else {
                            convertedBuffer += convertedLine;
                        }

                        data.conversions[conversionIndex] = originalIndex;
                    }
                } else {
                    convertedBuffer += line + lineBreak;
                }
            } catch {
                convertedBuffer += line + lineBreak;
            }

            offset = lineBreakIndex + lineBreakLen;
        }

        this.data = data;
        this.content = convertedBuffer;

        this.prepared = true;
    }

    /**
     * Returns the rule text for a given converted line number.
     * This rule may be converted from an original rule.
     * If you need the original rule, use `getOriginalRuleText`.
     *
     * @param offset Line start offset in the converted content.
     *
     * @returns Rule as string, or null if not found.
     */
    public getRuleText(offset: number): string | null {
        const [lineBreakStartIndex] = findNextLineBreakIndex(this.content, offset);
        return this.content.slice(offset, lineBreakStartIndex);
    }

    /**
     * Returns the original rule text for a given converted line number.
     *
     * @param offset Line start offset in the converted content.
     *
     * @returns Original rule as string, or null if not found.
     * Please note that this function also returns null for valid line numbers,
     * if they do not have a corresponding original rule in the conversion data.
     */
    public getOriginalRuleText(offset: number): string | null {
        if (offset < 0 || offset >= this.content.length) {
            return null;
        }

        const originalRuleIndex = this.data.conversions[offset];

        if (originalRuleIndex !== undefined) {
            return this.data.originals[originalRuleIndex];
        }

        return this.getRuleText(offset);
    }

    /**
     * Restores the original filter list content from the converted content.
     *
     * @returns Original filter list content.
     */
    public getOriginalContent(): string {
        // Trivial case
        if (this.data.originals.length === 0) {
            return this.content;
        }

        let originalBuffer = EMPTY_STRING;
        const { length } = this.content;

        let offset = 0;

        while (offset < length) {
            let [nextLineBreakIndex, nextLineBreakLength] = findNextLineBreakIndex(this.content, offset);

            const currentLine = this.content.slice(offset, nextLineBreakIndex);
            const firstOriginalRuleIndex = this.data.conversions[offset]; // use char offset as key

            if (firstOriginalRuleIndex !== undefined) {
                // Write original rule
                originalBuffer += this.data.originals[firstOriginalRuleIndex];

                // Skip any subsequent converted lines that came from the same original rule
                let nextOffset = nextLineBreakIndex + nextLineBreakLength;
                while (this.data.conversions[nextOffset] === firstOriginalRuleIndex) {
                    [nextLineBreakIndex, nextLineBreakLength] = findNextLineBreakIndex(this.content, nextOffset);
                    nextOffset = nextLineBreakIndex + nextLineBreakLength;
                }

                // Update offset to the end of this group
                offset = nextLineBreakIndex + nextLineBreakLength;
            } else {
                // No mapping, just copy the line
                originalBuffer += currentLine;
                offset = nextLineBreakIndex + nextLineBreakLength;
            }

            // Preserve original line breaks, including final break if present
            originalBuffer += this.content.slice(nextLineBreakIndex, nextLineBreakIndex + nextLineBreakLength);
        }

        return originalBuffer;
    }
}
