import { StringUtils } from '../../utils/string.js';
import { type ParameterList } from '../../nodes/index.js';
import { COMMA } from '../../utils/constants.js';
import { defaultParserOptions } from '../options.js';
import { BaseParser } from '../base-parser.js';
import { ValueParser } from './value-parser.js';

/**
 * Parser for parameter lists.
 */
export class ParameterListParser extends BaseParser {
    /**
     * Parses a raw parameter list.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @param separator Separator character (default: comma)
     * @returns Parameter list AST
     */
    public static parse(
        raw: string,
        options = defaultParserOptions,
        baseOffset = 0,
        separator: string = COMMA,
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

        // Parse parameters: skip whitespace before and after each parameter, and
        // split parameters by the separator character.
        while (offset < length) {
            // Skip whitespace before parameter
            offset = StringUtils.skipWS(raw, offset);

            // Parameter may only contain whitespace
            // In this case, we reached the end of the parameter list
            if (raw[offset] === separator || offset === length) {
                // Add a null for empty parameter
                params.children.push(null);

                // Skip separator
                offset += 1;
            } else {
                // Get parameter start position
                const paramStart = offset;

                // Get next unescaped separator position
                const nextSeparator = StringUtils.findUnescapedNonStringNonRegexChar(raw, separator, offset);

                // Get parameter end position
                const paramEnd = nextSeparator !== -1
                    ? StringUtils.skipWSBack(raw, nextSeparator - 1)
                    : StringUtils.skipWSBack(raw);

                // Add parameter to the list
                const param = ValueParser.parse(
                    raw.slice(paramStart, paramEnd + 1),
                    options,
                    baseOffset + paramStart,
                );

                params.children.push(param);

                // Set offset to the next separator position + 1
                offset = nextSeparator !== -1 ? nextSeparator + 1 : length;
            }
        }

        // If the last character was a separator, add an additional null parameter
        if (raw[length - 1] === separator) {
            params.children.push(null);
        }

        return params;
    }
}
