/**
 * @file Cosmetic rule modifier converter from ADG to uBO
 */

import { type DomainList, type Modifier, type ModifierList } from '../../../nodes';
import { createModifierNode } from '../../../ast-utils/modifiers';
import { createDomainList, parseDomains } from '../../../ast-utils/domains';
import { RegExpUtils } from '../../../utils/regexp';
import {
    CLOSE_SQUARE_BRACKET,
    COMMA_DOMAIN_LIST_SEPARATOR,
    ESCAPE_CHARACTER,
    OPEN_SQUARE_BRACKET,
    ADG_APP_MODIFIER,
    ADG_DOMAINS_MODIFIER,
    ADG_URL_MODIFIER,
    UBO_MATCHES_PATH_OPERATOR,
    ADG_PATH_MODIFIER,
    PIPE_MODIFIER_SEPARATOR,
} from '../../../utils/constants';
import { StringUtils } from '../../../utils/string';
import { MultiValueMap } from '../../../utils/multi-value-map';
import { clone } from '../../../utils/clone';
import { type ConversionResult, createConversionResult } from '../../base-interfaces/conversion-result';

/**
 * Regular expression pattern for matching the main page
 * https://github.com/gorhill/uBlock/wiki/Procedural-cosmetic-filters#subjectmatches-patharg
 */
const UBO_MAIN_PAGE_MATCHER = '/^/$/';

/**
 * Special characters in modifier regexps that should be escaped
 */
const SPECIAL_MODIFIER_REGEX_CHARS = new Set([
    OPEN_SQUARE_BRACKET,
    CLOSE_SQUARE_BRACKET,
    COMMA_DOMAIN_LIST_SEPARATOR,
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
    public static convertFromAdg(
        modifierList: ModifierList,
    ): ConversionResult<{ modifierList: ModifierList, domains?: DomainList }> {
        const conversionMap = new MultiValueMap<number, Modifier | null>();
        let domainList: DomainList | null = null;

        modifierList.children.forEach((modifier, index) => {
            let value: string | undefined;
            let { exception } = modifier;
            switch (modifier.name.value) {
                // Special case: ADG's $app modifier
                case ADG_APP_MODIFIER:
                    throw new Error('The $app modifier is not supported by uBO');
                // Special case: ADG's $domains modifier
                case ADG_DOMAINS_MODIFIER: {
                    // Use PIPE_MODIFIER_SEPARATOR for domain lists
                    const domains = parseDomains(modifier.value?.value ?? '', PIPE_MODIFIER_SEPARATOR);
                    domainList = createDomainList(
                        domains,
                        ADG_DOMAINS_MODIFIER,
                        PIPE_MODIFIER_SEPARATOR,
                        modifier.start,
                        modifier.end,
                    );
                    if (!domainList) {
                        break;
                    }
                    conversionMap.add(index, null);
                    break;
                }
                // Special case: ADG's $url modifier
                case ADG_URL_MODIFIER: {
                    // Use COMMA_DOMAIN_LIST_SEPARATOR for URL lists
                    const domains = parseDomains(modifier.value?.value ?? '', COMMA_DOMAIN_LIST_SEPARATOR);
                    domainList = createDomainList(
                        domains,
                        ADG_URL_MODIFIER,
                        COMMA_DOMAIN_LIST_SEPARATOR,
                        modifier.start,
                        modifier.end,
                    );
                    if (!domainList) {
                        break;
                    }
                    conversionMap.add(index, null);
                    break;
                }
                // Special case: ADG's $path modifier
                case ADG_PATH_MODIFIER:
                    if (!modifier.value) {
                        value = UBO_MAIN_PAGE_MATCHER;
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
                    conversionMap.add(
                        index,
                        createModifierNode(
                            UBO_MATCHES_PATH_OPERATOR,
                            value,
                            exception,
                        ),
                    );
                    break;
                default:
                    break;
            }
        });

        // Check if we have any converted modifiers
        if (conversionMap.size) {
            const modifierListClone = clone(modifierList);

            // Replace the original modifiers with the converted ones
            modifierListClone.children = modifierListClone.children
                .map((modifier, index) => {
                    const convertedModifier = conversionMap.get(index);
                    return convertedModifier ?? modifier;
                })
                .flat()
                .filter((modifier): modifier is Modifier => modifier !== null);

            return createConversionResult({ modifierList: modifierListClone, domains: domainList || undefined }, true);
        }

        // Otherwise, just return the original modifier list without any changes
        return createConversionResult({ modifierList, domains: undefined }, false);
    }
}
