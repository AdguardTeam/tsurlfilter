import { AdblockSyntaxError } from '../../../errors/adblock-syntax-error';
import {
    type HtmlFilteringRuleBody,
    type PseudoClassSelector,
    type SelectorCombinator,
    type SelectorList,
    type Value,
} from '../../../nodes';
import {
    BACKSLASH,
    CLOSE_PARENTHESIS,
    COLON,
    DOUBLE_QUOTE,
    SINGLE_QUOTE,
    SPACE,
} from '../../../utils/constants';
import { QuoteUtils } from '../../../utils/quotes';
import { SPECIAL_PSEUDO_CLASS_NAMES } from '../../../utils/special-pseudo-classes';
import { StringUtils } from '../../../utils/string';
import { BaseParser } from '../../base-parser';
import { defaultParserOptions, type ParserOptions } from '../../options';
import { SelectorListParser } from '../selector/selector-list-parser';

import { HtmlFilteringBodyParser } from './html-filtering-body-parser';

/**
 * Special pseudo-class marker found in a raw HTML filtering rule body,
 * e.g. `:contains(` — see {@link SPECIAL_PSEUDO_CLASS_NAMES}.
 */
interface SpecialPseudoClassMarker {
    /**
     * Name of the special pseudo-class, e.g. `contains`.
     */
    name: string;

    /**
     * Index of the leading colon of the special pseudo-class marker.
     */
    markerIndex: number;

    /**
     * Index of the opening parenthesis of the special pseudo-class marker.
     */
    openParenIndex: number;
}

/**
 * `AdgHtmlFilteringBodyParser` is responsible for parsing the body of an AdGuard-style HTML filtering rule.
 *
 * Please note that the parser will parse any HTML filtering rule if it is syntactically correct.
 * For example, it will parse this:.
 * ```adblock
 * example.com$$div[special-attr="value"]
 * ```
 *
 * But it didn't check if the attribute `special-attr` actually supported by any adblocker..
 *
 * @see {@link https://www.w3.org/TR/selectors-4}
 * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#html-filtering-rules}
 */
export class AdgHtmlFilteringBodyParser extends BaseParser {
    /**
     * Parses the body of an AdGuard-style HTML filtering rule.
     *
     * Bodies that are not syntactically correct CSS selector lists, but are
     * still accepted by AdGuard products (CoreLibs), are parsed leniently:
     * a special pseudo-class with a raw-text argument
     * (`:contains`, `:-abp-contains`, `:has-text`) may have an unbalanced
     * or unterminated argument, e.g. `script:contains((function(g,b,a,c,e,d)`,
     * which CoreLibs accepts — see {@link SPECIAL_PSEUDO_CLASS_NAMES}.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     *
     * @returns Node of the parsed HTML filtering rule body.
     *
     * @throws If the body is syntactically incorrect and cannot be parsed
     * leniently either.
     *
     * @example
     * ```
     * div[some_attribute="some_value"]
     * ```
     */
    public static parse(
        raw: string,
        options = defaultParserOptions,
        baseOffset = 0,
    ): Value | HtmlFilteringRuleBody {
        // Only escape AdGuard's `""` → `\"` when the body will actually be
        // CSS-parsed. When `parseHtmlFilteringRuleBodies` is false the raw
        // string is stored as-is in a Value node; escaping here would cause
        // double-escaping when the converter later re-parses it.
        //
        // Needed for proper `[tag-content]` conversion (to `:contains()`)
        // where `""` must be used to escape `"`:
        // https://adguard.com/kb/general/ad-filtering/create-own-filters/#tag-content
        const input = options.parseHtmlFilteringRuleBodies
            ? QuoteUtils.escapeAttributeDoubleQuotes(raw)
            : raw;

        if (!options.parseHtmlFilteringRuleBodies) {
            return HtmlFilteringBodyParser.parse(input, options, baseOffset);
        }

        try {
            return HtmlFilteringBodyParser.parse(input, options, baseOffset);
        } catch (error) {
            // Tolerant fallback, mirroring CoreLibs: special pseudo-classes
            // with a raw-text argument accept arguments with unbalanced
            // parentheses or unterminated strings. Such bodies do not parse
            // as CSS selector lists, so we retry leniently here, taking the
            // argument as-is. If the body cannot be parsed leniently either,
            // the original error is rethrown.
            if (!(error instanceof AdblockSyntaxError)) {
                throw error;
            }

            const lenientResult = AdgHtmlFilteringBodyParser.parseRawSpecialPseudoClassArgument(
                input,
                options,
                baseOffset,
            );

            if (lenientResult === null) {
                throw error;
            }

            return lenientResult;
        }
    }

    /**
     * Leniently parses a body whose last special pseudo-class has a
     * raw-text argument (unbalanced parentheses, unterminated string,
     * etc.), mirroring the CoreLibs behavior: the part of the body before
     * that pseudo-class is parsed as a regular selector list, and the
     * pseudo-class itself is built manually with the raw argument — the
     * text between the opening parenthesis of the pseudo-class and the
     * last closing parenthesis of the body.
     *
     * @param input Raw input to parse (already attribute-escaped).
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input.
     *
     * @returns Parsed body, or `null` if the body cannot be parsed
     * leniently (no special pseudo-class marker, argument not closed by the
     * last `)` of the body, or unparsable selector part before it).
     */
    private static parseRawSpecialPseudoClassArgument(
        input: string,
        options: ParserOptions,
        baseOffset: number,
    ): HtmlFilteringRuleBody | null {
        // CoreLibs requires the argument to be closed by the last `)` of the
        // body, so trailing whitespace is not a part of the argument
        const trimmedInput = input.trimEnd();

        // Find the last special pseudo-class marker outside of quoted text
        const marker = AdgHtmlFilteringBodyParser.findLastSpecialPseudoClassMarker(trimmedInput);

        if (marker === null) {
            return null;
        }

        // The argument ends at the last closing parenthesis of the body
        if (!trimmedInput.endsWith(CLOSE_PARENTHESIS)) {
            return null;
        }

        // The raw argument: everything between the opening parenthesis of
        // the pseudo-class and the last closing parenthesis of the body
        const argumentRaw = trimmedInput.slice(marker.openParenIndex + 1, -1);

        // CoreLibs rejects empty arguments
        if (argumentRaw.length === 0) {
            return null;
        }

        // The part of the body before the special pseudo-class must be a
        // valid selector list; anything else (e.g. unbalanced brackets)
        // cannot be parsed leniently
        let selectorList: SelectorList;
        try {
            selectorList = SelectorListParser.parse(
                trimmedInput.slice(0, marker.markerIndex),
                options,
                baseOffset,
            );
        } catch {
            return null;
        }

        // Build the special pseudo-class node manually with the raw argument
        const name: Value = {
            type: 'Value',
            value: marker.name,
        };

        const argument: Value = {
            type: 'Value',
            value: argumentRaw,
        };

        const pseudoClassSelector: PseudoClassSelector = {
            type: 'PseudoClassSelector',
            name,
            argument,
        };

        if (options.isLocIncluded) {
            const nameStart = baseOffset + marker.markerIndex + 1;
            const argumentStart = baseOffset + marker.openParenIndex + 1;
            const bodyEnd = baseOffset + trimmedInput.length;

            pseudoClassSelector.start = baseOffset + marker.markerIndex;
            pseudoClassSelector.end = bodyEnd;
            name.start = nameStart;
            name.end = nameStart + marker.name.length;
            argument.start = argumentStart;
            argument.end = bodyEnd - 1;
        }

        // The pseudo-class extends the last compound selector of the last
        // complex selector, e.g. `script` in `script:contains(...)`
        const complexSelectors = selectorList.children;
        const lastComplexSelector = complexSelectors[complexSelectors.length - 1];

        // If the pseudo-class is preceded by whitespace, the whitespace is a
        // descendant combinator, e.g. `div :has-text(...)`. The prefix parser
        // drops a trailing descendant space, so the combinator must be
        // restored explicitly — otherwise the appended pseudo-class would be
        // glued to the last compound selector, turning `div :has-text(...)`
        // into `div:contains(...)` with different matching semantics (the
        // whole `div` would match instead of the matching descendant)
        if (
            marker.markerIndex > 0
            && StringUtils.isWhitespace(trimmedInput[marker.markerIndex - 1])
        ) {
            const combinator: SelectorCombinator = {
                type: 'SelectorCombinator',
                value: SPACE,
            };

            if (options.isLocIncluded) {
                // Cover the first character of the whitespace run before the
                // marker, the same way the regular parser locates the
                // descendant combinator
                let whitespaceStart = marker.markerIndex - 1;
                while (
                    whitespaceStart > 0
                    && StringUtils.isWhitespace(trimmedInput[whitespaceStart - 1])
                ) {
                    whitespaceStart -= 1;
                }

                combinator.start = baseOffset + whitespaceStart;
                combinator.end = combinator.start + SPACE.length;
            }

            lastComplexSelector.children.push(combinator);
        }

        lastComplexSelector.children.push(pseudoClassSelector);

        // The appended pseudo-class (and the restored combinator, if any)
        // extends the last complex selector, so the parent ranges must be
        // extended to cover it — otherwise slicing the selector list or the
        // last complex selector range would omit the pseudo-class
        if (options.isLocIncluded) {
            lastComplexSelector.end = pseudoClassSelector.end;
            selectorList.end = pseudoClassSelector.end;
        }

        const result: HtmlFilteringRuleBody = {
            type: 'HtmlFilteringRuleBody',
            selectorList,
        };

        if (options.isLocIncluded) {
            result.start = baseOffset;
            result.end = baseOffset + input.length;
        }

        return result;
    }

    /**
     * Finds the last special pseudo-class marker (e.g. `:contains(`) in a
     * raw HTML filtering rule body, skipping over quoted text, where
     * marker-like substrings may occur as plain text of an argument or an
     * attribute value, e.g. the `:has-text(` in `[data-x=":has-text(foo"]`.
     *
     * Quote handling:
     * - both single and double quotes toggle the quoted state;
     * - a backslash-escaped quote (`\"`) does not toggle the quoted state;
     * - a doubled quote (`""`) inside a quoted section is treated as an
     *   escaped quote (AdGuard escaping convention for `[tag-content]` values).
     *
     * @param raw Raw HTML filtering rule body.
     *
     * @returns Last special pseudo-class marker, or `null` if none found.
     */
    private static findLastSpecialPseudoClassMarker(raw: string): SpecialPseudoClassMarker | null {
        let lastMarker: SpecialPseudoClassMarker | null = null;
        let quote: string | null = null;

        for (let i = 0; i < raw.length; i += 1) {
            const char = raw[i];

            if (quote !== null) {
                // A backslash escapes the next character inside quoted text
                if (char === BACKSLASH) {
                    i += 1;
                    continue;
                }

                // A doubled quote is an escaped quote
                // (AdGuard escaping convention for [tag-content] values)
                if (char === quote && raw[i + 1] === quote) {
                    i += 1;
                    continue;
                }

                // Closing quote
                if (char === quote) {
                    quote = null;
                }

                continue;
            }

            if (char === DOUBLE_QUOTE || char === SINGLE_QUOTE) {
                quote = char;
                continue;
            }

            // Outside of quoted text — check for special pseudo-class markers
            if (char === COLON) {
                for (const name of SPECIAL_PSEUDO_CLASS_NAMES) {
                    if (raw.startsWith(`:${name}(`, i)) {
                        lastMarker = {
                            name,
                            markerIndex: i,
                            openParenIndex: i + name.length + 1,
                        };
                        break;
                    }
                }
            }
        }

        return lastMarker;
    }
}
