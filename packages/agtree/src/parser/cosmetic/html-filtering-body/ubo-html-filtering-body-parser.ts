import { getFormattedTokenName, TokenType } from '@adguard/css-tokenizer';
import { sprintf } from 'sprintf-js';

import {
    type Value,
    type SelectorList,
    type ComplexSelector,
    type PseudoClassSelector,
    type HtmlFilteringRuleBody,
} from '../../../nodes';
import { BaseParser } from '../../base-parser';
import { CssTokenStream } from '../../css/css-token-stream';
import { defaultParserOptions } from '../../options';
import { AdblockSyntaxError } from '../../../errors/adblock-syntax-error';
import { ValueParser } from '../../misc/value-parser';
import { UBO_RESPONSEHEADER_FN } from '../../../utils/constants';
import { HtmlFilteringBodyParser } from './html-filtering-body-parser';

/**
 * `UboHtmlFilteringBodyParser` is responsible for parsing the body of
 * an uBlock-style HTML filtering rule, and also uBlock-style response header removal rule.
 *
 * Please note that the parser will parse any HTML filtering rule if it is syntactically correct.
 * For example, it will parse this:
 * ```adblock
 * example.com##^script:pseudo(content)
 * example.com##^responseheader(header-name)
 * ```
 *
 * but it didn't check if the pseudo selector `pseudo` or if
 * the header name `header-name` actually supported by any adblocker.
 *
 * @see {@link https://www.w3.org/TR/selectors-4}
 * @see {@link https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#html-filters}
 * @see {@link https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#response-header-filtering}
 */
export class UboHtmlFilteringBodyParser extends BaseParser {
    /**
     * Parses the body of an uBlock-style HTML filtering rule
     * and also uBlock-style response header removal rule.
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
     * div:has-text(Example)
     * responseheader(header-name)
     * ```
     */
    public static parse(
        raw: string,
        options = defaultParserOptions,
        baseOffset = 0,
    ): Value | HtmlFilteringRuleBody {
        // First, check if it's a response header removal rule and return if so
        const responseHeaderBody = UboHtmlFilteringBodyParser.parseResponseHeaderRule(raw, options, baseOffset);
        if (responseHeaderBody !== null) {
            return responseHeaderBody;
        }

        return HtmlFilteringBodyParser.parse(raw, options, baseOffset);
    }

    /**
     * Parses uBlock-style response header removal rule body.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     *
     * @returns Node of the parsed response header removal rule body
     * or `null` if the body is not a response header removal rule.
     *
     * @throws If the body is syntactically incorrect.
     *
     * @example
     * ```
     * responseheader(header-name)
     * ```
     *
     * @note This method returns `HtmlFilteringRuleBody` because,
     * response header removal rule syntax is same as uBlock-style
     * HTML filtering rule syntax.
     */
    public static parseResponseHeaderRule(
        raw: string,
        options = defaultParserOptions,
        baseOffset = 0,
    ): HtmlFilteringRuleBody | null {
        // If HTML filtering rules parsing is disabled, return null
        if (!options.parseHtmlFilteringRuleBodies) {
            return null;
        }

        // Construct the stream
        const stream = new CssTokenStream(raw, baseOffset);

        // Skip whitespaces before function
        stream.skipWhitespace();

        // Get token
        let token = stream.get();

        // Token should be a function
        if (!token || token.type !== TokenType.Function) {
            return null;
        }

        // Save the function start position
        const { start } = token;

        // Extract function name raw value (without opening parenthesis)
        const functionNameRaw = raw.slice(token.start, token.end - 1);

        // Check if it's `responseheader` function
        if (functionNameRaw !== UBO_RESPONSEHEADER_FN) {
            return null;
        }

        // Advance function token
        stream.advance();

        // Skip whitespaces after opening parenthesis
        stream.skipWhitespace();

        // Get argument token
        token = stream.getOrFail();

        // Save argument start position (starts after opening parenthesis and whitespaces)
        const argumentStart = token.start;

        // Skip until balanced (search for closing parenthesis)
        stream.skipUntilBalanced();

        // Get closing parenthesis token
        token = stream.getOrFail();

        // Save argument end position (ends before closing parenthesis)
        const argumentEnd = token.start;

        // Extract argument raw value
        const argumentRaw = raw.slice(argumentStart, argumentEnd).trimEnd();

        // Throw if the argument is empty
        if (argumentRaw.length === 0) {
            throw new AdblockSyntaxError(
                `Empty parameter for '${UBO_RESPONSEHEADER_FN}' function`,
                argumentStart + baseOffset,
                argumentEnd + baseOffset,
            );
        }

        // Expect closing parenthesis
        stream.expect(TokenType.CloseParenthesis);

        // Advance closing parenthesis token
        stream.advance();

        // Skip whitespaces after closing parenthesis
        stream.skipWhitespace();

        // Expect the end of the rule - so nothing should be left in the stream
        if (!stream.isEof()) {
            token = stream.getOrFail();
            throw new AdblockSyntaxError(
                sprintf(
                    "Expected end of rule, but got '%s'",
                    getFormattedTokenName(token.type),
                ),
                token.start + baseOffset,
                token.end + baseOffset,
            );
        }

        // Construct pseudo-class selector node
        const pseudoClassSelectorNode: PseudoClassSelector = {
            type: 'PseudoClassSelector',
            name: ValueParser.parse(
                functionNameRaw,
                options,
                start + baseOffset,
            ),
            argument: ValueParser.parse(
                argumentRaw,
                options,
                argumentStart + baseOffset,
            ),
        };

        // Construct complex selector node
        const complexSelectorNode: ComplexSelector = {
            type: 'ComplexSelector',
            children: [pseudoClassSelectorNode],
        };

        // Construct selector list node
        const selectorList: SelectorList = {
            type: 'SelectorList',
            children: [complexSelectorNode],
        };

        // Construct body node
        const result: HtmlFilteringRuleBody = {
            type: 'HtmlFilteringRuleBody',
            selectorList,
        };

        // Get last non-whitespace token
        const lastNonWsToken = stream.lookbehindForNonWs();

        // It shouldn't be null here, but just to be safe if it is
        // it means that raw is empty or contains only whitespaces
        if (!lastNonWsToken) {
            return null;
        }

        // Include locations info if needed
        if (options.isLocIncluded) {
            result.start = baseOffset;
            result.end = raw.length + baseOffset;

            selectorList.start = start + baseOffset;
            selectorList.end = lastNonWsToken.end + baseOffset;

            complexSelectorNode.start = selectorList.start;
            complexSelectorNode.end = selectorList.end;

            pseudoClassSelectorNode.start = complexSelectorNode.start;
            pseudoClassSelectorNode.end = complexSelectorNode.end;
        }

        return result;
    }
}
