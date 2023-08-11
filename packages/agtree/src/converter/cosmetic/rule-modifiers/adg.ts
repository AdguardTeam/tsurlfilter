/**
 * @file Cosmetic rule modifier converter from uBO to ADG
 */

import { type ModifierList } from '../../../parser/common';
import { RuleConversionError } from '../../../errors/rule-conversion-error';
import { type ConverterFunction } from '../../base-interfaces/converter-function';
import { createModifierListNode, createModifierNode } from '../../../ast-utils/modifiers';
import { RegExpUtils } from '../../../utils/regexp';
import {
    CLOSE_SQUARE_BRACKET,
    COMMA,
    ESCAPE_CHARACTER,
    OPEN_SQUARE_BRACKET,
    REGEX_MARKER,
} from '../../../utils/constants';
import { StringUtils } from '../../../utils/string';

const UBO_MATCHES_PATH_OPERATOR = 'matches-path';
const ADG_PATH_MODIFIER = 'path';

type ModifierConverterFunction = ConverterFunction<ModifierList>;

/**
 * Special characters in modifier regexps that should be escaped
 */
const SPECIAL_MODIFIER_REGEX_CHARS = new Set([
    OPEN_SQUARE_BRACKET,
    CLOSE_SQUARE_BRACKET,
    COMMA,
    ESCAPE_CHARACTER,
]);

/**
 * Helper class for converting cosmetic rule modifiers from uBO to ADG
 */
export class AdgCosmeticRuleModifierConverter {
    /**
     * Converts a uBO cosmetic rule modifier list to ADG, if possible.
     *
     * @param modifierList Cosmetic rule modifier list node to convert
     * @returns Converted cosmetic rule modifier list node
     * @throws If the modifier list cannot be converted
     * @see {@link https://github.com/gorhill/uBlock/wiki/Procedural-cosmetic-filters#cosmetic-filter-operators}
     */
    public static convertFromUbo: ModifierConverterFunction = (modifierList) => {
        const convertedModifierList = createModifierListNode();

        for (const modifier of modifierList.children) {
            let modifierValue: string;

            switch (modifier.modifier.value) {
                case UBO_MATCHES_PATH_OPERATOR:
                    // :matches-path() should have a value
                    if (!modifier.value) {
                        throw new RuleConversionError('Missing value for :matches-path(...)');
                    }

                    modifierValue = RegExpUtils.isRegexPattern(modifier.value.value)
                        ? StringUtils.escapeCharacters(modifier.value.value, SPECIAL_MODIFIER_REGEX_CHARS)
                        : modifier.value.value;

                    // Convert uBO's `:matches-path(...)` operator to ADG's `$path=...` modifier
                    convertedModifierList.children.push(
                        createModifierNode(
                            ADG_PATH_MODIFIER,
                            // We should negate the regexp if the modifier is an exception
                            modifier.exception
                                // eslint-disable-next-line max-len
                                ? `${REGEX_MARKER}${RegExpUtils.negateRegexPattern(RegExpUtils.patternToRegexp(modifierValue))}${REGEX_MARKER}`
                                : modifierValue,
                        ),
                    );

                    break;

                default:
                    // Leave the modifier as-is
                    convertedModifierList.children.push(modifier);
            }
        }

        return convertedModifierList;
    };
}
