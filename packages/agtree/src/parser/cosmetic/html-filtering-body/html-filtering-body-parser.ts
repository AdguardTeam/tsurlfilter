import { type Value, type HtmlFilteringRuleBody } from '../../../nodes';
import { BaseParser } from '../../base-parser';
import { defaultParserOptions } from '../../options';
import { SelectorListParser } from '../selector/selector-list-parser';

/**
 * Class responsible for parsing HTML filtering rule body.
 *
 * Please note that the parser will parse any HTML filtering rule body if it is syntactically correct.
 * For example, it will parse this:
 * ```adblock
 * span[special-attr="Example"]
 * div:special-pseudo(Example)
 * ```
 *
 * but it didn't check if the pseudo selector `special-pseudo` or if
 * the attribute selector `special-attr` actually supported by any adblocker.
 *
 * @see {@link https://www.w3.org/TR/selectors-4}
 * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#html-filtering-rules}
 * @see {@link https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#html-filters}
 */
export class HtmlFilteringBodyParser extends BaseParser {
    /**
     * Parses a HTML filtering rule body.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     *
     * @returns Node of the parsed HTML filtering rule body.
     *
     * @throws If the body is syntactically incorrect.
     *
     * @example
     * ```
     * span[tag-content="Example"]
     * div:has-text(Example)
     * ```
     */
    public static parse(
        raw: string,
        options = defaultParserOptions,
        baseOffset = 0,
    ): Value | HtmlFilteringRuleBody {
        // If HTML filtering rules parsing is disabled, return raw value node
        let result: Value | HtmlFilteringRuleBody;
        if (options.parseHtmlFilteringRuleBodies) {
            result = {
                type: 'HtmlFilteringRuleBody',
                selectorList: SelectorListParser.parse(
                    raw,
                    options,
                    baseOffset,
                ),
            };
        } else {
            result = {
                type: 'Value',
                value: raw,
            };
        }

        // Include body locations if needed
        if (options.isLocIncluded) {
            result.start = baseOffset;
            result.end = baseOffset + raw.length;
        }

        return result;
    }
}
