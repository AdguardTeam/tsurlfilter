import { EMPTY, MODIFIER_ASSIGN_OPERATOR, MODIFIER_EXCEPTION_MARKER } from '../../utils/constants';
import { locRange } from '../../utils/location';
import { StringUtils } from '../../utils/string';
import { AdblockSyntaxError } from '../errors/adblock-syntax-error';
import { Modifier, Value, defaultLocation } from '../common';

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
     * @param loc Location of the modifier
     *
     * @returns Parsed modifier
     * @throws An error if modifier name or value is empty.
     */
    public static parse(raw: string, loc = defaultLocation): Modifier {
        let offset = 0;

        // Skip leading whitespace
        offset = StringUtils.skipWS(raw, offset);

        // Save the offset of the first character of the modifier (whole modifier)
        const modifierStart = offset;

        // Check if the modifier is an exception
        let exception = false;

        if (raw[offset] === MODIFIER_EXCEPTION_MARKER) {
            offset += MODIFIER_EXCEPTION_MARKER.length;
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
                'Modifier name can\'t be empty',
                locRange(loc, 0, raw.length),
            );
        }

        let modifier: Value;
        let value: Value | undefined;

        // If there is no assignment operator, the whole modifier is the name
        // without a value
        if (assignmentIndex === -1) {
            modifier = {
                type: 'Value',
                loc: locRange(loc, modifierNameStart, modifierEnd),
                value: raw.slice(modifierNameStart, modifierEnd),
            };
        } else {
            // If there is an assignment operator, first we need to find the
            // end of the modifier name, then we can parse the value
            const modifierNameEnd = StringUtils.skipWSBack(raw, assignmentIndex - 1) + 1;

            modifier = {
                type: 'Value',
                loc: locRange(loc, modifierNameStart, modifierNameEnd),
                value: raw.slice(modifierNameStart, modifierNameEnd),
            };

            // Value can't be empty
            if (assignmentIndex + 1 === modifierEnd) {
                throw new AdblockSyntaxError(
                    'Modifier value can\'t be empty',
                    locRange(loc, 0, raw.length),
                );
            }

            // Skip whitespace after the assignment operator
            const valueStart = StringUtils.skipWS(raw, assignmentIndex + MODIFIER_ASSIGN_OPERATOR.length);

            value = {
                type: 'Value',
                loc: locRange(loc, valueStart, modifierEnd),
                value: raw.slice(valueStart, modifierEnd),
            };
        }

        return {
            type: 'Modifier',
            loc: locRange(loc, modifierStart, modifierEnd),
            modifier,
            value,
            exception,
        };
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
            result += MODIFIER_EXCEPTION_MARKER;
        }

        result += modifier.modifier.value;

        if (modifier.value !== undefined) {
            result += MODIFIER_ASSIGN_OPERATOR;
            result += modifier.value.value;
        }

        return result;
    }
}
