/* eslint-disable no-param-reassign */
import { MODIFIERS_SEPARATOR } from '../../utils/constants';
import { StringUtils } from '../../utils/string';
import { type ModifierList } from '../../nodes';
import { BaseParser } from '../base-parser';
import { defaultParserOptions } from '../options';
import { ModifierParser } from './modifier-parser';

/**
 * `ModifierListParser` is responsible for parsing modifier lists. Please note that the name is not
 * uniform, "modifiers" are also known as "options".
 *
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#basic-rules-modifiers}
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#non-basic-rules-modifiers}
 * @see {@link https://help.eyeo.com/adblockplus/how-to-write-filters#options}
 */
export class ModifierListParser extends BaseParser {
    /**
     * Parses the cosmetic rule modifiers, eg. `third-party,domain=example.com|~example.org`.
     *
     * _Note:_ you should remove `$` separator before passing the raw modifiers to this function,
     *  or it will be parsed in the first modifier.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @returns Parsed modifiers interface
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): ModifierList {
        const result: ModifierList = {
            type: 'ModifierList',
            children: [],
        };

        if (options.isLocIncluded) {
            result.start = baseOffset;
            result.end = baseOffset + raw.length;
        }

        let offset = StringUtils.skipWS(raw);

        let separatorIndex = -1;

        // Split modifiers by unescaped commas
        while (offset < raw.length) {
            // Skip whitespace before the modifier
            offset = StringUtils.skipWS(raw, offset);

            const modifierStart = offset;

            // Check if this modifier has an incomplete regexp pattern
            // Look for the `=` sign to find where the modifier value starts
            let useSimpleSearch = false;
            const equalsIndex = raw.indexOf('=', offset);
            if (equalsIndex !== -1 && equalsIndex < raw.length - 1) {
                const valueStart = equalsIndex + 1;
                // Check if value starts with / (potential regex)
                if (raw[valueStart] === '/' && raw[valueStart + 1] !== '/') {
                    // Look for a closing / for the regex pattern
                    // Search through the rest of the string for an unescaped /
                    let firstClosingSlashIndex = -1;
                    for (let i = valueStart + 1; i < raw.length; i += 1) {
                        if (raw[i] === '/' && raw[i - 1] !== '\\') {
                            firstClosingSlashIndex = i;
                            break;
                        }
                    }

                    if (firstClosingSlashIndex === -1) {
                        // No closing slash found anywhere - incomplete regex pattern
                        // Use simple search to allow it to work when it's the last modifier
                        useSimpleSearch = true;
                    } else {
                        // Found a closing slash - check if there are MORE slashes after it
                        // If yes, this might be a complex pattern like replace=/pattern/replacement/flags
                        // and we should use simple search to avoid breaking it
                        let hasMoreSlashes = false;
                        for (let i = firstClosingSlashIndex + 1; i < raw.length; i += 1) {
                            if (raw[i] === '/' && raw[i - 1] !== '\\') {
                                hasMoreSlashes = true;
                                break;
                            }
                        }

                        // Use simple search if there are more slashes (complex pattern)
                        if (hasMoreSlashes) {
                            useSimpleSearch = true;
                        }
                    }
                }
            }

            // Find the index of the first unescaped comma
            let nextSeparator;
            if (useSimpleSearch) {
                // Use simple search for incomplete regex patterns
                nextSeparator = StringUtils.findNextUnescapedCharacter(
                    raw,
                    MODIFIERS_SEPARATOR,
                    offset,
                );
            } else {
                // Use regex-aware search to handle complete regex patterns
                nextSeparator = StringUtils.findUnescapedNonStringNonRegexChar(
                    raw,
                    MODIFIERS_SEPARATOR,
                    offset,
                );
            }

            separatorIndex = nextSeparator;

            const modifierEnd = separatorIndex === -1
                ? raw.length
                : StringUtils.skipWSBack(raw, separatorIndex - 1) + 1;

            // Parse the modifier
            const modifier = ModifierParser.parse(
                raw.slice(modifierStart, modifierEnd),
                options,
                baseOffset + modifierStart,
            );

            result.children.push(modifier);

            // Increment the offset to the next modifier (or the end of the string)
            offset = separatorIndex === -1 ? raw.length : separatorIndex + 1;
        }

        // Check if there are any modifiers after the last separator
        if (separatorIndex !== -1) {
            const modifierStart = StringUtils.skipWS(raw, separatorIndex + 1);

            result.children.push(
                ModifierParser.parse(
                    raw.slice(modifierStart, raw.length),
                    options,
                    baseOffset + modifierStart,
                ),
            );
        }

        return result;
    }
}
