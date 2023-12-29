/**
 * @file AdGuard Hints
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#hints}
 */

import { locRange, shiftLoc } from '../../utils/location';
import {
    CLOSE_PARENTHESIS,
    COMMA,
    EMPTY,
    OPEN_PARENTHESIS,
    SPACE,
    UNDERSCORE,
} from '../../utils/constants';
import { StringUtils } from '../../utils/string';
import { type Hint, type Value } from '../common';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { ParameterListParser } from '../misc/parameter-list';
import { getParserOptions, type ParserOptions } from '../options';

/**
 * `HintParser` is responsible for parsing AdGuard hints.
 *
 * @example
 * If the hint rule is
 * ```adblock
 * !+ NOT_OPTIMIZED PLATFORM(windows)
 * ```
 * then the hints are `NOT_OPTIMIZED` and `PLATFORM(windows)`, and this
 * class is responsible for parsing them. The rule itself is parsed by
 * the `HintRuleParser`, which uses this class to parse single hints.
 */
export class HintParser {
    /**
     * Parses a raw rule as a hint.
     *
     * @param raw Raw rule
     * @param options Parser options. See {@link ParserOptions}.
     * @returns Hint rule AST or null
     * @throws If the syntax is invalid
     */
    public static parse(raw: string, options: Partial<ParserOptions> = {}): Hint {
        const { baseLoc, isLocIncluded } = getParserOptions(options);
        let offset = 0;

        // Skip whitespace characters before the hint
        offset = StringUtils.skipWS(raw);

        // Hint should start with the hint name in every case

        // Save the start offset of the hint name
        const nameStartIndex = offset;

        // Parse the hint name
        for (; offset < raw.length; offset += 1) {
            const char = raw[offset];

            // Abort consuming the hint name if we encounter a whitespace character
            // or an opening parenthesis, which means 'HIT_NAME(' case
            if (char === OPEN_PARENTHESIS || char === SPACE) {
                break;
            }

            // Hint name should only contain letters, digits, and underscores
            if (!StringUtils.isAlphaNumeric(char) && char !== UNDERSCORE) {
                throw new AdblockSyntaxError(
                    `Invalid character "${char}" in hint name: "${char}"`,
                    locRange(baseLoc, nameStartIndex, offset),
                );
            }
        }

        // Save the end offset of the hint name
        const nameEndIndex = offset;

        // Save the hint name token
        const name = raw.substring(nameStartIndex, nameEndIndex);

        // Hint name cannot be empty
        if (name === EMPTY) {
            throw new AdblockSyntaxError('Empty hint name', locRange(baseLoc, 0, nameEndIndex));
        }

        // Now we have two case:
        //  1. We have HINT_NAME and should return it
        //  2. We have HINT_NAME(PARAMS) and should continue parsing

        // Skip whitespace characters after the hint name
        offset = StringUtils.skipWS(raw, offset);

        // Throw error for 'HINT_NAME (' case
        if (offset > nameEndIndex && raw[offset] === OPEN_PARENTHESIS) {
            throw new AdblockSyntaxError(
                // eslint-disable-next-line max-len
                'Unexpected whitespace(s) between hint name and opening parenthesis',
                locRange(baseLoc, nameEndIndex, offset),
            );
        }

        // Create the hint name node (we can reuse it in the 'HINT_NAME' case, if needed)
        const nameNode: Value = {
            type: 'Value',
            value: name,
        };

        if (isLocIncluded) {
            nameNode.loc = locRange(baseLoc, nameStartIndex, nameEndIndex);
        }

        // Just return the hint name if we have 'HINT_NAME' case (no params)
        if (raw[offset] !== OPEN_PARENTHESIS) {
            const result: Hint = {
                type: 'Hint',
                name: nameNode,
            };

            if (isLocIncluded) {
                result.loc = locRange(baseLoc, 0, offset);
            }

            return result;
        }

        // Skip the opening parenthesis
        offset += 1;

        // Find closing parenthesis
        const closeParenthesisIndex = raw.lastIndexOf(CLOSE_PARENTHESIS);

        // Throw error if we don't have closing parenthesis
        if (closeParenthesisIndex === -1) {
            throw new AdblockSyntaxError(
                `Missing closing parenthesis for hint "${name}"`,
                locRange(baseLoc, nameStartIndex, raw.length),
            );
        }

        // Save the start and end index of the params
        const paramsStartIndex = offset;
        const paramsEndIndex = closeParenthesisIndex;

        // Parse the params
        const params = ParameterListParser.parse(
            raw.substring(paramsStartIndex, paramsEndIndex),
            {
                isLocIncluded,
                separator: COMMA,
                baseLoc: shiftLoc(baseLoc, paramsStartIndex),
            },
        );

        offset = closeParenthesisIndex + 1;

        // Skip whitespace characters after the closing parenthesis
        offset = StringUtils.skipWS(raw, offset);

        // Throw error if we don't reach the end of the input
        if (offset !== raw.length) {
            throw new AdblockSyntaxError(
                // eslint-disable-next-line max-len
                `Unexpected input after closing parenthesis for hint "${name}": "${raw.substring(closeParenthesisIndex + 1, offset + 1)}"`,
                locRange(baseLoc, closeParenthesisIndex + 1, offset + 1),
            );
        }

        // Return the HINT_NAME(PARAMS) case AST
        const result: Hint = {
            type: 'Hint',
            name: nameNode,
            params,
        };

        if (isLocIncluded) {
            result.loc = locRange(baseLoc, 0, offset);
        }

        return result;
    }

    /**
     * Converts a single hint AST to a string.
     *
     * @param hint Hint AST
     * @returns Hint string
     */
    public static generate(hint: Hint): string {
        let result = EMPTY;

        result += hint.name.value;

        if (hint.params && hint.params.children.length > 0) {
            result += OPEN_PARENTHESIS;
            result += ParameterListParser.generate(hint.params, COMMA);
            result += CLOSE_PARENTHESIS;
        }

        return result;
    }
}
