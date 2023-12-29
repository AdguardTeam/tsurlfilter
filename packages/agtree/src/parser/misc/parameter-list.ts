import { StringUtils } from '../../utils/string';
import { locRange } from '../../utils/location';
import { type ParameterList, type Parameter } from '../common';
import { COMMA, SPACE } from '../../utils/constants';
import { type ListParserOptions } from './list-helpers';
import { getParserOptions } from '../options';

export class ParameterListParser {
    /**
     * Parses a raw parameter list.
     *
     * @param raw Raw parameter list
     * @param options List parser options. See {@link ListParserOptions}.
     * @returns Parameter list AST
     */
    public static parse(raw: string, options: Partial<ListParserOptions> = {}): ParameterList {
        const separator = options.separator ?? COMMA;
        const { baseLoc, isLocIncluded } = getParserOptions(options);

        // Prepare the parameter list node
        const params: ParameterList = {
            type: 'ParameterList',
            children: [],
        };

        if (isLocIncluded) {
            params.loc = locRange(baseLoc, 0, raw.length);
        }

        let offset = 0;

        // Skip leading whitespace (if any)
        offset = StringUtils.skipWS(raw, offset);

        // Parse parameters: skip whitespace before and after each parameter, and
        // split parameters by the separator character.
        while (offset < raw.length) {
            // Skip whitespace before parameter
            offset = StringUtils.skipWS(raw, offset);

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
                value: raw.substring(paramStart, paramEnd + 1),
            };

            if (isLocIncluded) {
                param.loc = locRange(baseLoc, paramStart, paramEnd + 1);
            }

            params.children.push(param);

            // Set offset to the next separator position + 1
            offset = nextSeparator !== -1 ? nextSeparator + 1 : raw.length;
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
