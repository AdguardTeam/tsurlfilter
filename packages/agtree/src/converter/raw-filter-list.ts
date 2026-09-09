/**
 * @file Raw filter list → raw filter list converter.
 *
 * Walks the source line by line, running exactly ONE structural parse per line
 * via {@link RuleParserPipeline.parseStructural} (tokenize + structural parse,
 * no AST). Non-candidate rules are copied verbatim from their source span with
 * zero AST allocation; only conversion candidates build an AST — from the SAME
 * populated context via {@link RuleParserPipeline.parseFromCurrentCtx}, so a
 * candidate is never parsed twice. Produces a {@link FilterListConversionResult}
 * with a reverse source map.
 *
 * @todo Implement `convertToUbo` and `convertToAbp`.
 */

import { RuleParserPipeline } from '../ast-builder/rule-parser';
import { ProductCode } from '../compatibility-tables';
import { RuleGenerator } from '../generator';
import { getErrorMessage } from '../utils/error';

import { BaseConverter } from './base-interfaces/base-converter';
import { isConversionCandidate } from './candidate-filter';
import { type FilterListConversionError, FilterListConversionResult } from './filter-list-conversion-result';
import { CONVERTER_PARSE_OPTIONS } from './parse-options';
import { RuleConverter } from './rule';
import { type ConversionSourceMap } from './source-map';

const LF = '\n';

/**
 * Dedicated pipeline for whole-list conversion. Kept separate from the pipeline
 * used by RawRuleConverter so the two never clobber each other's shared context.
 */
const listParser = new RuleParserPipeline();

/**
 * Options for {@link RawFilterListConverter.convertToAdg}.
 */
export interface FilterListConvertOptions {
    /**
     * Tolerant mode: invalid/failed rules are kept verbatim and recorded in
     * `errors` instead of throwing. Defaults to `true`.
     */
    tolerant?: boolean;
}

/**
 * Finds the next line break at or after `offset`.
 *
 * @param source Source text.
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
 * Whether the `[start, end)` slice is empty or whitespace-only (no allocation).
 *
 * @param source Source text.
 * @param start Slice start (inclusive).
 * @param end Slice end (exclusive).
 *
 * @returns True when the slice contains only spaces/tabs (or is empty).
 */
function isBlank(source: string, start: number, end: number): boolean {
    for (let i = start; i < end; i += 1) {
        const c = source.charCodeAt(i);
        if (c !== 0x20 && c !== 0x09 && c !== 0x0c && c !== 0x0b) {
            return false;
        }
    }
    return true;
}

/**
 * Raw filter list converter.
 */
export class RawFilterListConverter extends BaseConverter {
    /**
     * Converts a raw filter list to AdGuard format, producing a reverse source
     * map.
     *
     * @param rawFilterList Raw filter list text.
     * @param options Conversion options.
     *
     * @returns Conversion result whose `product` is `ProductCode.Adg`.
     *
     * @throws In strict mode (`tolerant: false`), rethrows the first rule error.
     */
    public static convertToAdg(
        rawFilterList: string,
        options: FilterListConvertOptions = {},
    ): FilterListConversionResult {
        const tolerant = options.tolerant ?? true;

        if (rawFilterList.length === 0) {
            return FilterListConversionResult.empty(ProductCode.Adg);
        }

        const parts: string[] = [];
        let convertedLength = 0;
        let isConverted = false;
        const sourceMap: ConversionSourceMap = { originals: [], conversions: {} };
        const errors: FilterListConversionError[] = [];

        const append = (chunk: string): void => {
            parts.push(chunk);
            convertedLength += chunk.length;
        };

        const { length } = rawFilterList;
        let offset = 0;

        while (offset < length) {
            const [lineBreakIndex, lineBreakLen] = findNextLineBreak(rawFilterList, offset);
            const line = rawFilterList.slice(offset, lineBreakIndex);
            const lineBreak = rawFilterList.slice(lineBreakIndex, lineBreakIndex + lineBreakLen);
            const nextOffset = lineBreakIndex + lineBreakLen;

            // Blank lines are copied verbatim and never parsed.
            if (isBlank(rawFilterList, offset, lineBreakIndex)) {
                append(line + lineBreak);
                offset = nextOffset;
                continue;
            }

            try {
                // ONE structural parse per line (tokenize + structural, no AST).
                const { kind, ctx } = listParser.parseStructural(line, CONVERTER_PARSE_OPTIONS);

                if (!isConversionCandidate(kind, ctx)) {
                    // Non-candidate: verbatim copy, zero AST allocation.
                    append(line + lineBreak);
                    offset = nextOffset;
                    continue;
                }

                // Candidate: build the AST from the SAME ctx (no re-tokenize),
                // then convert + generate.
                const ast = listParser.parseFromCurrentCtx(line, kind, CONVERTER_PARSE_OPTIONS);
                const conversion = RuleConverter.convertToAdg(ast);

                if (!conversion.isConverted) {
                    append(line + lineBreak);
                    offset = nextOffset;
                    continue;
                }

                isConverted = true;
                const originalIndex = sourceMap.originals.length;
                sourceMap.originals.push(line);

                const { result } = conversion;
                for (let i = 0; i < result.length; i += 1) {
                    const conversionIndex = convertedLength;
                    const convertedLine = RuleGenerator.generate(result[i]);

                    if (lineBreak.length > 0) {
                        append(convertedLine + lineBreak);
                    } else if (i < result.length - 1) {
                        // No final line break, but the last rule expanded to
                        // multiple lines: separate them with LF.
                        append(`${convertedLine}${LF}`);
                    } else {
                        append(convertedLine);
                    }

                    sourceMap.conversions[conversionIndex] = originalIndex;
                }
            } catch (e) {
                if (!tolerant) {
                    throw e;
                }
                errors.push({ rule: line, offset, message: getErrorMessage(e) });
                append(line + lineBreak);
            }

            offset = nextOffset;
        }

        // Shrink any grown parser buffers so a large list does not retain peak
        // memory after conversion.
        listParser.reset();

        return new FilterListConversionResult(
            parts.join(''),
            ProductCode.Adg,
            sourceMap,
            errors,
            isConverted,
        );
    }
}
