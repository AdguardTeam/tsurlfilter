import { RawRuleConverter } from '@adguard/agtree';
import { type FilterListConversionMap, type ConvertedFilterList } from './schema';
import { logger } from '../../utils/logger';
import { getErrorMessage } from '../../common/error';
import { CR, EMPTY_STRING, LF } from '../../common/constants';
import { type FilterListSourceMap } from '../source-map/schema';

/**
 * Concept:
 *
 * Right after a filter list is downloaded, we:
 *   1. Parse it to AST.
 *   2. Convert its rules to AdGuard format where it's possible.
 *
 * During this conversion, we also produce two maps:
 *    - Source map:     For performance reasons, we don't store the original rule text in the AST.
 *                      We store AST in a binary serialized format.
 *                      This source map is used to map the rule start index from the serialized filter list to
 *                      its start index in the raw filter list (converted filter list). This is needed to show
 *                      the exact applied rule in the filtering log. This rule text maybe a converted rule,
 *                      but in this case, we can get its original rule text from the conversion map
 *                      (for filtering engine, only the converted filter list is needed).
 *    - Conversion map: Maps the converted rule text to its original rule text. This is needed to show the
 *                      original rule text in the filtering log if a converted rule is applied.
 */

// TODO(David): Change converted filter list to a byte buffer.

/**
 * Utility class for converting rules to AdGuard format.
 */
export class FilterListConverter {
    /**
     * Converts a filter list to AdGuard format.
     *
     * @param filterList Raw filter list to convert.
     * @returns A {@link ConvertedFilterList} object which contains the converted filter list,
     * the mapping between the original and converted rules, and the source map.
     */
    public static convertFilter(filterList: string): ConvertedFilterList {
        const filterListLength = filterList.length;

        const sourceMap: FilterListSourceMap = {};
        const conversionMap: FilterListConversionMap = {};
        const convertedRules: string[] = [];

        let inputOffset = 0;
        let outputOffset = 0;

        /**
         * Simple helper function to store the converted rule in the filter list.
         *
         * @param ruleText Rule text to store.
         */
        const pushRuleToOutput = (ruleText: string) => {
            convertedRules.push(ruleText);
            sourceMap[outputOffset] = inputOffset;
            // increase offset + calculate the length of the rule + 1 for the line break
            outputOffset += ruleText.length + 1;
        };

        while (inputOffset < filterListLength) {
            // find next line break (\n or \r\n)
            let lineBreakIndex = filterList.indexOf(LF, inputOffset);
            let crlf = false;
            if (lineBreakIndex === -1) {
                lineBreakIndex = filterListLength;
            } else if (lineBreakIndex > 0 && filterList[lineBreakIndex - 1] === CR) {
                lineBreakIndex -= 1;
                crlf = true;
            }

            // get the line (rule text)
            const ruleText = filterList.slice(inputOffset, lineBreakIndex).trim();

            // skip empty lines
            if (ruleText !== EMPTY_STRING) {
                try {
                    // convert the rule to AdGuard format
                    // please note that one input rule can be converted to multiple output rules
                    const conversionResult = RawRuleConverter.convertToAdg(ruleText);

                    if (conversionResult.isConverted) {
                        for (const convertedRuleText of conversionResult.result) {
                            // store the converted rules and the mapping between the original and converted rules
                            conversionMap[convertedRuleText] = ruleText;

                            // store the converted rule in the filter list
                            pushRuleToOutput(convertedRuleText);
                        }

                        // eslint-disable-next-line max-len
                        logger.debug(`Converted rule: '${ruleText}' -> ${conversionResult.result.map((rule) => `'${rule}'`).join(', ')}`);
                    } else {
                        // store the original rule in the filter list
                        pushRuleToOutput(ruleText);
                    }
                } catch (error: unknown) {
                    logger.error(`Failed to convert rule: '${ruleText}' due to ${getErrorMessage(error)}`);

                    // store the rule as is, we'll handle it later when we validate the rules
                    pushRuleToOutput(ruleText);
                }
            }

            // move to the next line
            inputOffset = lineBreakIndex + (crlf ? 2 : 1);
        }

        return {
            convertedFilterList: convertedRules.join(LF),
            conversionMap,
            sourceMap,
        };
    }
}
