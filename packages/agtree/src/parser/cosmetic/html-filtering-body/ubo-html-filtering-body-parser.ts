import { getFormattedTokenName, TokenType } from '@adguard/css-tokenizer';
import { sprintf } from 'sprintf-js';

import {
    type HtmlFilteringRuleSelector,
    type HtmlFilteringRuleBody,
    type HtmlFilteringRuleSelectorPseudoClass,
    type HtmlFilteringRuleSelectorList,
    type HtmlFilteringRuleBodyParsed,
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
     * Error messages used in the parser.
     */
    private static readonly ERROR_MESSAGES = {
        EMPTY_RESPONSEHEADER_PARAMETER: `Empty parameter for '${UBO_RESPONSEHEADER_FN}' function`,
        EXPECTED_END_OF_RULE: "Expected end of rule, but got '%s'",
    };

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
    ): HtmlFilteringRuleBody {
        // First, check if it's a response header removal rule and return if so
        // only if parsing of HTML filtering rules is option is enabled
        if (options.parseHtmlFilteringRules) {
            const responseHeaderBody = UboHtmlFilteringBodyParser.parseResponseHeaderRule(raw, options, baseOffset);
            if (responseHeaderBody !== null) {
                return responseHeaderBody;
            }
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
     * @note This method returns `HtmlFilteringRuleBodyParsed` because,
     * response header removal rule syntax is same as uBlock-style
     * HTML filtering rule syntax.
     */
    public static parseResponseHeaderRule(
        raw: string,
        options = defaultParserOptions,
        baseOffset = 0,
    ): HtmlFilteringRuleBodyParsed | null {
        const stream = new CssTokenStream(raw, baseOffset);

        // Skip whitespaces before function
        stream.skipWhitespace();

        // Get token
        let token = stream.get();

        // Token should be a function
        if (!token || token.type !== TokenType.Function) {
            return null;
        }

        // Save the selector start position
        const selectorStart = token.start;

        // Extract pseudo-class name raw value
        const pseudoClassNameRaw = raw.slice(token.start, token.end - 1);

        // Check if it's `responseheader` function
        if (pseudoClassNameRaw !== UBO_RESPONSEHEADER_FN) {
            return null;
        }

        // Advance function token
        stream.advance();

        // Construct pseudo-class name node
        const pseudoClassNameNode = ValueParser.parse(
            pseudoClassNameRaw,
            options,
            selectorStart + baseOffset,
        );

        // Skip whitespaces after opening parenthesis
        stream.skipWhitespace();

        // Get next token (argument)
        token = stream.getOrFail();

        // Save pseudo-class argument start position (starts after opening parenthesis)
        const pseudoClassArgumentStart = token.start;

        // Skip until balanced closing parenthesis
        stream.skipUntilBalanced();

        // Get next token (closing parenthesis)
        token = stream.getOrFail();

        // Save pseudo-class argument end position (ends before closing parenthesis)
        const pseudoClassArgumentEnd = token.start;

        // Extract pseudo-class argument raw value
        const param = raw
            .slice(pseudoClassArgumentStart, pseudoClassArgumentEnd)
            .trimEnd();

        // Throw if the parameter is empty
        if (param.length === 0) {
            throw new AdblockSyntaxError(
                UboHtmlFilteringBodyParser.ERROR_MESSAGES.EMPTY_RESPONSEHEADER_PARAMETER,
                pseudoClassArgumentStart + baseOffset,
                pseudoClassArgumentEnd + baseOffset,
            );
        }

        // Construct pseudo-class argument node
        const pseudoClassArgumentNode = ValueParser.parse(
            param,
            options,
            pseudoClassArgumentStart + baseOffset,
        );

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
                    UboHtmlFilteringBodyParser.ERROR_MESSAGES.EXPECTED_END_OF_RULE,
                    getFormattedTokenName(token.type),
                ),
                token.start + baseOffset,
                token.end + baseOffset,
            );
        }

        // Construct pseudo-class node
        const pseudoClassNode: HtmlFilteringRuleSelectorPseudoClass = {
            type: 'HtmlFilteringRuleSelectorPseudoClass',
            name: pseudoClassNameNode,
            isFunction: true,
            argument: pseudoClassArgumentNode,
        };

        // Construct selector node
        const selector: HtmlFilteringRuleSelector = {
            type: 'HtmlFilteringRuleSelector',
            children: [pseudoClassNode],
        };

        // Construct selector list node
        const selectorList: HtmlFilteringRuleSelectorList = {
            type: 'HtmlFilteringRuleSelectorList',
            children: [selector],
        };

        // Construct body node
        const result: HtmlFilteringRuleBody = {
            type: 'HtmlFilteringRuleBodyParsed',
            children: [selectorList],
        };

        // Include location info if needed
        if (options.isLocIncluded) {
            result.start = baseOffset;
            result.end = raw.length + baseOffset;

            // Get last non-whitespace token
            const lastNonWsToken = stream.lookbehindForNonWs();

            // It shouldn't be null here, but just to be safe if it is
            // it means that raw is empty or contains only whitespaces
            if (!lastNonWsToken) {
                return null;
            }

            selectorList.start = selectorStart + baseOffset;
            selectorList.end = lastNonWsToken.end + baseOffset;

            selector.start = selectorList.start;
            selector.end = selectorList.end;

            pseudoClassNode.start = selector.start;
            pseudoClassNode.end = selector.end;
        }

        return result;
    }
}
