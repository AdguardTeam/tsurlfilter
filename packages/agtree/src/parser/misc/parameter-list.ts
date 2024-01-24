import { StringUtils } from '../../utils/string';
import { type ParameterList, type Parameter } from '../common';
import { COMMA, EMPTY, SPACE } from '../../utils/constants';
import { defaultParserOptions } from '../options';
import { ParserBase } from '../interface';

export class ParameterListParser extends ParserBase {
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

        if (options.isLocIncluded) {
            params.start = baseOffset;
            params.end = baseOffset + raw.length;
        }

        let offset = 0;

        // Parse parameters: skip whitespace before and after each parameter, and
        // split parameters by the separator character.
        while (offset < raw.length) {
            // Parameter may only contain whitespace
            const realStart = offset;

            // Skip whitespace before parameter
            offset = StringUtils.skipWS(raw, offset);

            // Parameter may only contain whitespace
            // In this case, we reached the end of the parameter list
            if (raw[offset] === separator || offset === raw.length) {
                const param: Parameter = {
                    type: 'Parameter',
                    value: EMPTY,
                };

                if (options.isLocIncluded) {
                    param.start = baseOffset + realStart;
                    param.end = baseOffset + offset;
                }

                params.children.push(param);

                // skip separator
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
                const param: Parameter = {
                    type: 'Parameter',
                    value: raw.slice(paramStart, paramEnd + 1),
                };

                if (options.isLocIncluded) {
                    param.start = baseOffset + paramStart;
                    param.end = baseOffset + paramEnd + 1;
                }

                params.children.push(param);

                // Set offset to the next separator position + 1
                offset = nextSeparator !== -1 ? nextSeparator + 1 : raw.length;
            }
        }

        return params;
    }

    /**
     * Converts a parameter list AST to a string.
     *
     * @param params Parameter list AST
     * @param separator Separator character (default: comma)
     * @returns String representation of the parameter list
     */
    public static generate(params: ParameterList, separator = COMMA): string {
        // Join parameters with the separator character and a space
        return params.children.map((param) => param.value).join(
            // If the separator is a space, do not add an extra space
            separator === SPACE ? separator : separator + SPACE,
        );
    }
}
