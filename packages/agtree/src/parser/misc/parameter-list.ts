import { StringUtils } from '../../utils/string';
import { locRange } from '../../utils/location';
import { type Location, type ParameterList, defaultLocation } from '../common';
import { COMMA, SPACE } from '../../utils/constants';

export class ParameterListParser {
    /**
     * Parses a raw parameter list.
     *
     * @param raw Raw parameter list
     * @param separator Separator character (default: comma)
     * @param loc Base location
     * @returns Parameter list AST
     */
    public static parse(raw: string, separator = COMMA, loc: Location = defaultLocation): ParameterList {
        // Prepare the parameter list node
        const params: ParameterList = {
            type: 'ParameterList',
            loc: locRange(loc, 0, raw.length),
            children: [],
        };

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
            params.children.push({
                type: 'Parameter',
                loc: locRange(loc, paramStart, paramEnd + 1),
                value: raw.substring(paramStart, paramEnd + 1),
            });

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
