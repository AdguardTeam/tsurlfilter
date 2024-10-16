import { StringUtils } from '../../utils/string';
import { type ParameterList } from '../../nodes';
import { COMMA } from '../../utils/constants';
import { defaultParserOptions } from '../options';
import { ValueParser } from './value-parser';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { QUOTE_SET } from '../../utils/quotes';
import { ParameterListParser } from './parameter-list-parser';

export class UboParameterListParser extends ParameterListParser {
    /**
     * Parses an "uBO-specific parameter list".
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @param separator Separator character (default: comma).
     * @param requireQuotes Whether to require quotes around the parameter values (default: false).
     * @param supportedQuotes Set of accepted quotes (default: {@link QUOTE_SET}).
     * @returns Parameter list node.
     *
     * @note Based on {@link https://github.com/gorhill/uBlock/blob/f9ab4b75041815e6e5690d80851189ae3dc660d0/src/js/static-filtering-parser.js#L607-L699} to provide consistency.
     */
    public static parse(
        raw: string,
        options = defaultParserOptions,
        baseOffset = 0,
        separator: string = COMMA,
        requireQuotes = false,
        supportedQuotes = QUOTE_SET,
    ): ParameterList {
        // Prepare the parameter list node
        const params: ParameterList = {
            type: 'ParameterList',
            children: [],
        };

        const { length } = raw;

        if (options.isLocIncluded) {
            params.start = baseOffset;
            params.end = baseOffset + length;
        }

        let offset = 0;
        // TODO: Eliminate the need for extraNull
        let extraNull = false;

        while (offset < length) {
            offset = StringUtils.skipWS(raw, offset);
            const paramStart = offset;
            let paramEnd = offset;

            if (supportedQuotes.has(raw[offset])) {
                // Find the closing quote
                const possibleClosingQuoteIndex = StringUtils.findNextUnescapedCharacter(raw, raw[offset], offset + 1);

                if (possibleClosingQuoteIndex !== -1) {
                    // Next non-whitespace character after the closing quote should be the separator
                    const nextSeparatorIndex = StringUtils.skipWS(raw, possibleClosingQuoteIndex + 1);

                    if (nextSeparatorIndex === length) {
                        if (requireQuotes) {
                            throw new AdblockSyntaxError(
                                'Expected separator, got end of string',
                                baseOffset + nextSeparatorIndex,
                                baseOffset + length,
                            );
                        }
                        // If the separator is not found, the param end is the end of the string
                        paramEnd = StringUtils.skipWSBack(raw, length - 1) + 1;
                        offset = length;
                    } else if (raw[nextSeparatorIndex] === separator) {
                        // If the quote is followed by a separator, we can use it as a closing quote
                        paramEnd = possibleClosingQuoteIndex + 1;
                        offset = nextSeparatorIndex + 1;
                    } else {
                        if (requireQuotes) {
                            throw new AdblockSyntaxError(
                                `Expected separator, got: '${raw[nextSeparatorIndex]}'`,
                                baseOffset + nextSeparatorIndex,
                                baseOffset + length,
                            );
                        }
                        // Param end should be the last separator before the quote
                        offset = StringUtils.findNextUnescapedCharacterBackwards(
                            raw,
                            separator,
                            possibleClosingQuoteIndex,
                        ) + 1;
                        paramEnd = StringUtils.skipWSBack(raw, offset - 2) + 1;
                    }
                } else {
                    if (requireQuotes) {
                        throw new AdblockSyntaxError(
                            'Expected closing quote, got end of string',
                            baseOffset + offset,
                            baseOffset + length,
                        );
                    }
                    // If the closing quote is not found, the param end is the end of the string
                    paramEnd = StringUtils.skipWSBack(raw, length - 1) + 1;
                    offset = length;
                }
            } else {
                if (requireQuotes) {
                    throw new AdblockSyntaxError(
                        `Expected quote, got: '${raw[offset]}'`,
                        baseOffset + offset,
                        baseOffset + length,
                    );
                }
                const nextSeparator = StringUtils.findNextUnescapedCharacter(raw, separator, offset);

                if (nextSeparator === -1) {
                    // If the separator is not found, the param end is the end of the string
                    paramEnd = StringUtils.skipWSBack(raw, length - 1) + 1;
                    offset = length;
                } else {
                    // Param end should be the last non-whitespace character before the separator
                    paramEnd = StringUtils.skipWSBack(raw, nextSeparator - 1) + 1;
                    offset = nextSeparator + 1;

                    if (StringUtils.skipWS(raw, length - 1) === nextSeparator) {
                        extraNull = true;
                    }
                }
            }

            if (paramStart < paramEnd) {
                params.children.push(ValueParser.parse(
                    raw.slice(paramStart, paramEnd),
                    options,
                    baseOffset + paramStart,
                ));
            } else {
                params.children.push(null);
            }
        }

        if (extraNull) {
            params.children.push(null);
        }

        return params;
    }
}
