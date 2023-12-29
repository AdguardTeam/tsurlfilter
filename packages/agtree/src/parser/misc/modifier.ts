import { EMPTY, MODIFIER_ASSIGN_OPERATOR, NEGATION_MARKER } from '../../utils/constants';
import { locRange } from '../../utils/location';
import { StringUtils } from '../../utils/string';
import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import { type Modifier, type Value } from '../common';
import { getParserOptions, type ParserOptions } from '../options';

/**
 * `ModifierParser` is responsible for parsing modifiers.
 *
 * @example
 * `match-case`, `~third-party`, `domain=example.com|~example.org`
 */
export class ModifierParser {
    /**
     * Parses a modifier.
     *
     * @param raw Raw modifier string
     * @param options Parser options. See {@link ParserOptions}.
     *
     * @returns Parsed modifier
     * @throws An error if modifier name or value is empty.
     */
    public static parse(raw: string, options: Partial<ParserOptions> = {}): Modifier {
        const { baseLoc, isLocIncluded } = getParserOptions(options);
        let offset = 0;

        // Skip leading whitespace
        offset = StringUtils.skipWS(raw, offset);

        // Save the offset of the first character of the modifier (whole modifier)
        const modifierStart = offset;

        // Check if the modifier is an exception
        let exception = false;

        if (raw[offset] === NEGATION_MARKER) {
            offset += NEGATION_MARKER.length;
            exception = true;
        }

        // Skip whitespace after the exception marker (if any)
        offset = StringUtils.skipWS(raw, offset);

        // Save the offset of the first character of the modifier name
        const modifierNameStart = offset;

        // Find assignment operator
        const assignmentIndex = StringUtils.findNextUnescapedCharacter(raw, MODIFIER_ASSIGN_OPERATOR);

        // Find the end of the modifier
        const modifierEnd = Math.max(StringUtils.skipWSBack(raw) + 1, modifierNameStart);

        // Modifier name can't be empty
        if (modifierNameStart === modifierEnd) {
            throw new AdblockSyntaxError(
                'Modifier name cannot be empty',
                locRange(baseLoc, 0, raw.length),
            );
        }

        let modifier: Value;
        let value: Value | undefined;

        // If there is no assignment operator, the whole modifier is the name
        // without a value
        if (assignmentIndex === -1) {
            modifier = {
                type: 'Value',
                value: raw.slice(modifierNameStart, modifierEnd),
            };

            if (isLocIncluded) {
                modifier.loc = locRange(baseLoc, modifierNameStart, modifierEnd);
            }
        } else {
            // If there is an assignment operator, first we need to find the
            // end of the modifier name, then we can parse the value
            const modifierNameEnd = StringUtils.skipWSBack(raw, assignmentIndex - 1) + 1;

            modifier = {
                type: 'Value',
                value: raw.slice(modifierNameStart, modifierNameEnd),
            };

            if (isLocIncluded) {
                modifier.loc = locRange(baseLoc, modifierNameStart, modifierNameEnd);
            }

            // Value can't be empty
            if (assignmentIndex + 1 === modifierEnd) {
                throw new AdblockSyntaxError(
                    'Modifier value cannot be empty',
                    locRange(baseLoc, 0, raw.length),
                );
            }

            // Skip whitespace after the assignment operator
            const valueStart = StringUtils.skipWS(raw, assignmentIndex + MODIFIER_ASSIGN_OPERATOR.length);

            value = {
                type: 'Value',
                value: raw.slice(valueStart, modifierEnd),
            };

            if (isLocIncluded) {
                value.loc = locRange(baseLoc, valueStart, modifierEnd);
            }
        }

        const result: Modifier = {
            type: 'Modifier',
            name: modifier,
            value,
            exception,
        };

        if (isLocIncluded) {
            result.loc = locRange(baseLoc, modifierStart, modifierEnd);
        }

        return result;
    }

    /**
     * Generates a string from a modifier (serializes it).
     *
     * @param modifier Modifier to generate string from
     * @returns String representation of the modifier
     */
    public static generate(modifier: Modifier): string {
        let result = EMPTY;

        if (modifier.exception) {
            result += NEGATION_MARKER;
        }

        result += modifier.name.value;

        if (modifier.value !== undefined) {
            result += MODIFIER_ASSIGN_OPERATOR;
            result += modifier.value.value;
        }

        return result;
    }
}
