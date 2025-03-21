/**
 * @file Cosmetic rule modifier converter from ADG to uBO
 */

import { DomainListParser } from '../../../parser/misc/domain-list-parser';
import {
    type DomainList,
    ListNodeType,
    type Modifier,
    type ModifierList,
} from '../../../nodes';
import { createModifierNode } from '../../../ast-utils/modifiers';
import { RegExpUtils } from '../../../utils/regexp';
import {
    CLOSE_SQUARE_BRACKET,
    COMMA,
    PIPE,
    ESCAPE_CHARACTER,
    OPEN_SQUARE_BRACKET,
    REGEX_MARKER,
} from '../../../utils/constants';
import { StringUtils } from '../../../utils/string';
import { MultiValueMap } from '../../../utils/multi-value-map';
import { clone } from '../../../utils/clone';
import { type ConversionResult, createConversionResult } from '../../base-interfaces/conversion-result';

const UBO_MATCHES_PATH_OPERATOR = 'matches-path';
const ADG_PATH_MODIFIER = 'path';
const ADG_DOMAINS_MODIFIER = 'domain';
const ADG_APP_MODIFIER = 'app';
const ADG_URL_MODIFIER = 'url'

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
    // eslint-disable-next-line max-len
    public static convertFromAdg(modifierList: ModifierList): ConversionResult<{ modifierList: ModifierList, domains?: DomainList }> {
        const conversionMap = new MultiValueMap<number, Modifier | null>();
        let domainList: DomainList | null = null;

        modifierList.children.forEach((modifier, index) => {

            // Special case: ADG's $app modifier
            if (modifier.name.value === ADG_APP_MODIFIER) {
                throw new Error('The $app modifier is not supported by uBO');
            }

            // Special case: ADG's $domain modifier
            if (modifier.name.value === ADG_DOMAINS_MODIFIER) {
                if (!domainList) {
                    domainList = {
                        type: ListNodeType.DomainList,
                        separator: COMMA,
                        children: [],
                        start: modifier.start,
                        end: modifier.end,
                    };
                }
            
                if(!modifier?.value?.value){
                    return;
                }
                
                domainList = DomainListParser.parse(modifier.value.value, {}, modifier.start, PIPE);

                conversionMap.add(index, null);
                return;
            }

            // Special case: ADG's $url modifier
            if (modifier.name.value === ADG_URL_MODIFIER) {
                if (!domainList) {
                    domainList = {
                        type: ListNodeType.DomainList,
                        separator: COMMA,
                        children: [],
                        start: modifier.start,
                        end: modifier.end,
                    };
                }

                if (!modifier?.value?.value) {
                    return;
                }

                const regexDomainValue = RegExpUtils.patternToRegexp(modifier.value.value);

                domainList = {
                    type: ListNodeType.DomainList,
                    separator: COMMA,
                    children: [
                        {
                            type: 'Domain',
                            value: REGEX_MARKER + regexDomainValue + REGEX_MARKER,
                            exception: modifier?.exception ?? false,
                        },
                    ],
                    start: modifier.start,
                    end: modifier.end,
                };

                conversionMap.add(index, null);
                return;
            }
            
            // Special case: ADG's $path modifier
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
                        modifier.value.value,
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

        // Check if we have any converted modifiers
        if (conversionMap.size) {
            const modifierListClone = clone(modifierList);

            // Replace the original modifiers with the converted ones
            modifierListClone.children = modifierListClone.children.map((modifier, index) => {
                const convertedModifier = conversionMap.get(index);

                return convertedModifier ?? modifier;
            }).flat().filter((modifier): modifier is Modifier => modifier !== null);

            return createConversionResult({ modifierList: modifierListClone, domains: domainList || undefined }, true);
        }

        // Otherwise, just return the original modifier list without any changes
        return createConversionResult({ modifierList, domains: undefined }, false);
    }
}
