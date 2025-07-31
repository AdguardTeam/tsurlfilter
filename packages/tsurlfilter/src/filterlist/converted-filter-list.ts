/* eslint-disable @typescript-eslint/no-loop-func */
import { RawRuleConverter } from '@adguard/agtree';

import { findNextLineBreakIndex } from '../utils/string-utils';
import { EMPTY_STRING, LF } from '../common/constants';

/**
 * Conversion data.
 * With this data we can revert the conversion and get the original filter list.
 * It is designed to provide O(1) access to the original filtering rules.
 */
export type ConversionData = {
    /**
     * Original filter list rules.
     */
    originals: string[];

    /**
     * Conversion map.
     * Maps line numbers in the converted content to indexes in the `originals` array.
     *
     * Keys are 1-based line numbers in the converted content.
     * Values are 0-based indexes in the `originals` array.
     */
    conversions: Record<number, number>;
};

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
        const convertedBuffer: string[] = [];
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
                        const convertedLine = conversionResult.result[i];

                        if (lineBreak.length > 0) {
                            convertedBuffer.push(convertedLine + lineBreak);
                        } else if (i < conversionResult.result.length - 1) {
                            // If the file has no final line break, but we converted the last rule into multiple lines,
                            // we need to add a line break after each converted line, except the last one
                            convertedBuffer.push(`${convertedLine}${LF}`);
                        } else {
                            convertedBuffer.push(convertedLine);
                        }

                        const conversionIndex = convertedBuffer.length;
                        data.conversions[conversionIndex] = originalIndex;
                    }
                } else {
                    convertedBuffer.push(line + lineBreak);
                }
            } catch {
                convertedBuffer.push(line + lineBreak);
            }

            offset = lineBreakIndex + lineBreakLen;
        }

        this.data = data;
        this.content = convertedBuffer.join('');

        this.prepared = true;
    }

    /**
     * Returns the original rule text for a given converted line number.
     *
     * @param lineNumber Line number in the converted content (1-based).
     *
     * @returns Original rule as string, or null if not found.
     * Please note that this function also returns null for valid line numbers,
     * if they do not have a corresponding original rule in the conversion data.
     */
    public getOriginalRuleText(lineNumber: number): string | null {
        const originalRuleIndex = this.data.conversions[lineNumber];

        if (originalRuleIndex === undefined) {
            return null;
        }

        return this.data.originals[originalRuleIndex] ?? null;
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

        const originalBuffer: string[] = [];
        const { length } = this.content;

        let offset = 0;
        let lineNumber = 1;

        while (offset < length) {
            let [nextLineBreakIndex, nextLineBreakLength] = findNextLineBreakIndex(this.content, offset);

            const currentLine = this.content.slice(offset, nextLineBreakIndex);
            const firstOriginalRuleIndex = this.data.conversions[lineNumber];

            if (firstOriginalRuleIndex !== undefined) {
                originalBuffer.push(this.data.originals[firstOriginalRuleIndex]);

                // Maybe a single original rule is converted to multiple rules
                // In this case we should skip the next lines
                while (this.data.conversions[lineNumber + 1] === firstOriginalRuleIndex) {
                    lineNumber += 1;
                    offset = nextLineBreakIndex + nextLineBreakLength;
                    [nextLineBreakIndex, nextLineBreakLength] = findNextLineBreakIndex(this.content, offset);
                }
            } else {
                originalBuffer.push(currentLine);
            }

            // Preserve original line breaks, including final line break, if any
            originalBuffer.push(this.content.slice(nextLineBreakIndex, nextLineBreakIndex + nextLineBreakLength));

            offset = nextLineBreakIndex + nextLineBreakLength;
            lineNumber += 1;
        }

        return originalBuffer.join(EMPTY_STRING);
    }
}
