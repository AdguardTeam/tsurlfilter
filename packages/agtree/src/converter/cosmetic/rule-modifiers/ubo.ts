/**
 * @file Cosmetic rule modifier converter from ADG to UBO
 */

import { type Modifier, type ModifierList } from '../../../nodes';
import { createModifierNode } from '../../../ast-utils/modifiers';
import { RegExpUtils } from '../../../utils/regexp';
import {
    CLOSE_SQUARE_BRACKET,
    COMMA,
    ESCAPE_CHARACTER,
    OPEN_SQUARE_BRACKET,
} from '../../../utils/constants';
import { StringUtils } from '../../../utils/string';
import { MultiValueMap } from '../../../utils/multi-value-map';
import { clone } from '../../../utils/clone';
import { type ConversionResult, createConversionResult } from '../../base-interfaces/conversion-result';

const UBO_MATCHES_PATH_OPERATOR = 'matches-path';
const ADG_PATH_MODIFIER = 'path';

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
 * Helper class for converting cosmetic rule modifiers from ADG to uBO
 */
export class UboCosmeticRuleModifierConverter {
    /**
     * Converts a ADG cosmetic rule modifier list to uBO, if possible.
     *
     * @param modifierList Cosmetic rule modifier list node to convert
     * @returns An object which follows the {@link ConversionResult} interface. Its `result` property contains
     * the converted node, and its `isConverted` flag indicates whether the original node was converted.
     * If the node was not converted, the result will contain the original node with the same object reference
     * @throws If the modifier list cannot be converted
     * @see {@link https://github.com/gorhill/uBlock/wiki/Procedural-cosmetic-filters#cosmetic-filter-operators}
     */
    public static convertFromAdg(modifierList: ModifierList): ConversionResult<ModifierList> {
        const conversionMap = new MultiValueMap<number, Modifier>();

        modifierList.children.forEach((modifier, index) => {
            // $path=...
            if (modifier.name.value === ADG_PATH_MODIFIER) {
                let value: string | undefined;
                let { exception } = modifier;

                if (!modifier.value) {
                    // To only match the main page but not any of the subpages,
                    // use: example.com##:matches-path(/^/$/) p
                    // From: https://github.com/gorhill/uBlock/wiki/Procedural-cosmetic-filters#subjectmatches-patharg
                    value = '/^/$/';
                } else if (RegExpUtils.isNegatedRegexPattern(modifier.value.value)) {
                    exception = true;
                    value = StringUtils.escapeCharacters(
                        RegExpUtils.removeNegationFromRegexPattern(modifier.value.value),
                        SPECIAL_MODIFIER_REGEX_CHARS,
                    );
                } else {
                    value = RegExpUtils.isRegexPattern(modifier.value.value)
                        ? StringUtils.escapeCharacters(modifier.value.value, SPECIAL_MODIFIER_REGEX_CHARS)
                        : modifier.value.value;
                }

                // Convert ADG's `$path=...` operator to Ubo's `:matches-path(...)` modifier
                conversionMap.add(
                    index,
                    createModifierNode(
                        UBO_MATCHES_PATH_OPERATOR,
                        value,
                        exception,
                    ),
                );
            }
        });

        // FIXME: Handle domains modifier as regular domain list in Ubo
        // Check if we have any converted modifiers
        if (conversionMap.size) {
            const modifierListClone = clone(modifierList);

            // Replace the original modifiers with the converted ones
            modifierListClone.children = modifierListClone.children.map((modifier, index) => {
                const convertedModifier = conversionMap.get(index);

                return convertedModifier ?? modifier;
            }).flat();

            return createConversionResult(modifierListClone, true);
        }

        // Otherwise, just return the original modifier list
        return createConversionResult(modifierList, false);
    }
}
